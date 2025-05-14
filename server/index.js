require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');
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

const getFinnhubQuote = async (symbol) => {
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`;
  const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${process.env.FINNHUB_API_KEY}`;

  try {
    const [quoteRes, metricsRes] = await Promise.all([
      axios.get(url),
      axios.get(metricsUrl)
    ]);

    return {
      currentPrice: quoteRes.data.c,
      peRatio: metricsRes.data.metric?.peBasicExclExtraTTM ?? null,
      dividendYield: metricsRes.data.metric?.dividendYieldIndicatedAnnual ?? null
    };
  } catch (err) {
    console.error(`❌ Finnhub fetch failed for ${symbol}:`, err.message);
    return { currentPrice: null, peRatio: null, dividendYield: null };
  }
};

app.get('/api/version', (req, res) => {
  res.json({ version: 'v1.2.0', deployedAt: new Date().toISOString() });
});

app.get('/api/uploads', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, source_filename, uploaded_at FROM uploads ORDER BY uploaded_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ uploads fetch failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/portfolio', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id FROM uploads ORDER BY uploaded_at DESC LIMIT 1`);
    if (result.rows.length === 0) return res.status(404).json({ message: 'No uploads found' });

    const uploadId = result.rows[0].id;
    const positions = await pool.query(`
      SELECT ticker, shares, avg_price, account_type, tag, notes,
             cost_basis_total, current_price, market_value, gain_dollar, gain_percent,
             dividend_yield, pe_ratio
      FROM positions
      WHERE upload_id = $1
      ORDER BY ticker
    `, [uploadId]);

    res.json({ uploadId, count: positions.rows.length, positions: positions.rows });
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
      let avgCost = parseFloat(row['Average Cost Basis']?.replace(/[$,]/g, '') || 0);
      const account = row['Account Name']?.trim();
      const costBasisTotal = parseFloat(row['Cost Basis Total']?.replace(/[$,]/g, '') || 0);
      if (!symbol || isNaN(quantity)) return;

      const isCash = symbol.startsWith('CORE') || symbol.startsWith('FCASH');
      const parsedShares = isCash ? parseFloat(row['Current Value']?.replace(/[$,]/g, '') || 0) : quantity;
      if (costBasisTotal && parsedShares > 0) avgCost = costBasisTotal / parsedShares;
      const parsedAvgPrice = isCash ? 1 : avgCost;

      results.push({
        ticker: isCash ? 'CASH' : symbol.toUpperCase(),
        shares: parsedShares,
        avg_price: parsedAvgPrice,
        account_type: account || null,
        tag: isCash ? 'Cash' : null,
        notes: row['Description']?.slice(0, 200) || null,
        cost_basis_total: parsedShares * parsedAvgPrice,
        current_price: null,
        market_value: null,
        gain_dollar: null,
        gain_percent: null,
        price_last_updated: new Date().toISOString(),
        dividend_yield: null,
        pe_ratio: null
      });
    })
    .on('end', async () => {
      try {
        const uploadRes = await pool.query(`INSERT INTO uploads (source_filename) VALUES ($1) RETURNING id`, [req.file.originalname]);
        const uploadId = uploadRes.rows[0].id;

        for (const row of results) {
          if (row.ticker === 'CASH') {
            row.current_price = 1;
            row.dividend_yield = 0;
            row.pe_ratio = null;
          } else {
            const quote = await getFinnhubQuote(row.ticker);
            row.current_price = quote.currentPrice ?? row.avg_price;
            row.dividend_yield = quote.dividendYield ?? null;
            row.pe_ratio = quote.peRatio ?? null;
          }

          row.market_value = row.shares * row.current_price;
          row.gain_dollar = row.market_value - row.cost_basis_total;
          row.gain_percent = row.cost_basis_total > 0 ? row.gain_dollar / row.cost_basis_total : 0;

          console.log(`💰 ${row.ticker} | Price: $${row.current_price} | PE: ${row.pe_ratio} | Yield: ${row.dividend_yield}`);
        }

        const insertPromises = results.map((row) =>
          pool.query(
            `INSERT INTO positions
             (upload_id, ticker, shares, avg_price, account_type, tag, notes,
              cost_basis_total, current_price, market_value, gain_dollar, gain_percent,
              price_last_updated, dividend_yield, pe_ratio)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [uploadId, row.ticker, row.shares, row.avg_price, row.account_type, row.tag, row.notes,
             row.cost_basis_total, row.current_price, row.market_value, row.gain_dollar, row.gain_percent,
             row.price_last_updated, row.dividend_yield, row.pe_ratio]
          )
        );

        await Promise.all(insertPromises);

        res.json({ message: 'Upload processed w/ Finnhub prices', count: results.length, data: results });
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