const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');

const app = express();
const PORT = 4000;
const upload = multer({ dest: 'uploads/' });

const pool = new Pool({
  user: 'kbuser',
  host: 'db',
  database: 'stocktracker',
  password: 'supersecure',
  port: 5432,
});

app.use(cors());
app.use(express.json());

const getYahooPrice = async (ticker) => {
  try {
    const res = await fetch(\`https://query1.finance.yahoo.com/v7/finance/quote?symbols=\${ticker}\`);
    const data = await res.json();
    const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
    if (price) {
      console.log(\`💰 \${ticker} → \$\${price}\`);
      return price;
    } else {
      console.warn(\`⚠️ No price found for \${ticker}\`);
      return null;
    }
  } catch (err) {
    console.error(\`❌ Yahoo fetch failed for \${ticker}:\`, err.message);
    return null;
  }
};

app.get('/api/version', (req, res) => {
  res.json({ version: 'v1.1.0', deployedAt: new Date().toISOString() });
});

app.get('/api/uploads', async (req, res) => {
  try {
    const result = await pool.query(\`
      SELECT id, source_filename, uploaded_at
      FROM uploads
      ORDER BY uploaded_at DESC
    \`);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ uploads fetch failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/portfolio', async (req, res) => {
  try {
    const result = await pool.query(\`
      SELECT id FROM uploads ORDER BY uploaded_at DESC LIMIT 1
    \`);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No uploads found' });
    }

    const uploadId = result.rows[0].id;

    const positions = await pool.query(\`
      SELECT ticker, shares, avg_price, account_type, tag, notes,
             cost_basis_total, current_price, market_value, gain_dollar, gain_percent
      FROM positions
      WHERE upload_id = $1
      ORDER BY ticker
    \`, [uploadId]);

    res.json({
      uploadId,
      count: positions.rows.length,
      positions: positions.rows
    });
  } catch (err) {
    console.error('❌ portfolio fetch failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const filePath = req.file.path;
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      const symbol = row['Symbol']?.trim();
      const quantity = parseFloat(row['Quantity']?.replace(/,/g, '') || 0);
      const avgCost = parseFloat(row['Average Cost Basis']?.replace(/[$,]/g, '') || 0);
      const account = row['Account Name']?.trim();

      if (!symbol || isNaN(quantity)) return;

      const isCash = symbol.startsWith('CORE') || symbol.startsWith('FCASH');

      const parsedShares = isCash
        ? parseFloat(row['Current Value']?.replace(/[$,]/g, '') || 0)
        : quantity;

      const parsedAvgPrice = isCash ? 1 : avgCost;
      const costBasisTotal = parsedShares * parsedAvgPrice;

      results.push({
        rawSymbol: symbol,
        ticker: isCash ? 'CASH' : symbol.toUpperCase(),
        shares: parsedShares,
        avg_price: parsedAvgPrice,
        account_type: account || null,
        tag: isCash ? 'Cash' : null,
        notes: row['Description']?.slice(0, 200) || null,
        cost_basis_total: costBasisTotal,
        current_price: null, // will be filled after Yahoo call
        market_value: null,
        gain_dollar: null,
        gain_percent: null,
        price_last_updated: new Date().toISOString()
      });
    })
    .on('end', async () => {
      try {
        const uploadRes = await pool.query(
          \`INSERT INTO uploads (source_filename) VALUES ($1) RETURNING id\`,
          [req.file.originalname]
        );
        const uploadId = uploadRes.rows[0].id;

        // Fetch prices
        for (const row of results) {
          if (row.ticker === 'CASH') {
            row.current_price = 1;
          } else {
            const livePrice = await getYahooPrice(row.ticker);
            row.current_price = livePrice ?? row.avg_price;
          }

          row.market_value = row.shares * row.current_price;
          row.gain_dollar = row.market_value - row.cost_basis_total;
          row.gain_percent = row.cost_basis_total > 0
            ? row.gain_dollar / row.cost_basis_total
            : 0;
        }

        // Insert into DB
        const insertPromises = results.map((row) =>
          pool.query(
            \`INSERT INTO positions
            (upload_id, ticker, shares, avg_price, account_type, tag, notes,
             cost_basis_total, current_price, market_value, gain_dollar, gain_percent, price_last_updated)
            VALUES ($1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13)\`,
            [
              uploadId,
              row.ticker,
              row.shares,
              row.avg_price,
              row.account_type,
              row.tag,
              row.notes,
              row.cost_basis_total,
              row.current_price,
              row.market_value,
              row.gain_dollar,
              row.gain_percent,
              row.price_last_updated
            ]
          )
        );

        await Promise.all(insertPromises);

        res.json({
          message: 'Upload processed w/ live prices',
          count: results.length,
          data: results
        });
      } catch (err) {
        console.error('❌ DB insert failed:', err);
        res.status(500).json({ error: 'Internal error' });
      } finally {
        fs.unlinkSync(filePath);
      }
    });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ API running on port ${PORT}`);
});