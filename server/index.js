const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
const PORT = 4000;

const upload = multer({ dest: 'uploads/' });
let uploadedPortfolio = [];

const pool = new Pool({
  user: 'kbuser',
  host: 'db', // Docker service name
  database: 'stocktracker',
  password: 'supersecure',
  port: 5432
});

const parsedShares = isCash
  ? parseFloat(row['Current Value']?.replace(/[$,]/g, '') || 0)
  : quantity;

const parsedAvgPrice = isCash ? 1 : avgCost;
const costBasisTotal = parsedShares * parsedAvgPrice;
const currentPrice = parsedAvgPrice; // placeholder
const marketValue = parsedShares * currentPrice;
const gainDollar = marketValue - costBasisTotal;
const gainPercent = costBasisTotal > 0 ? gainDollar / costBasisTotal : 0;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('📡 Stocky API is live!');
});

// ✅ Fixed portfolio endpoint
app.get('/api/portfolio', async (req, res) => {
  try {
    const latestUpload = await pool.query(`
      SELECT id FROM uploads ORDER BY uploaded_at DESC LIMIT 1
    `);

    if (latestUpload.rows.length === 0) {
      return res.status(404).json({ message: 'No uploads found' });
    }

    const uploadId = latestUpload.rows[0].id;

    const positions = await pool.query(`
      SELECT ticker, shares, avg_price, account_type, tag, notes
      FROM positions
      WHERE upload_id = $1
      ORDER BY ticker
    `, [uploadId]);

    res.json({
      uploadId,
      count: positions.rows.length,
      positions: positions.rows
    });

  } catch (err) {
    console.error('❌ portfolio error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/api/uploads', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, source_filename, uploaded_at
      FROM uploads
      ORDER BY uploaded_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ uploads fetch failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ✅ Version check route
app.get('/api/version', (req, res) => {
  const versionInfo = {
    version: 'v1.0.3',
    deployedAt: new Date().toISOString()
  };
  res.json(versionInfo);
});

// ✅ CSV Upload + DB insert route
  app.post('/api/upload', upload.single('file'), (req, res) => {
  const filePath = req.file.path;
  const results = [];
const insertPromises = results.map((row) =>
  pool.query(
    `INSERT INTO positions
    (upload_id, ticker, shares, avg_price, account_type, tag, notes,
     cost_basis_total, current_price, market_value, gain_dollar, gain_percent, price_last_updated)
    VALUES ($1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13)`,
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
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      const symbol = row['Symbol']?.trim();
      const isCash = symbol.startsWith('CORE') || symbol.startsWith('FCASH');
      const quantity = parseFloat(row['Quantity']?.replace(/,/g, '') || 0);
      const avgCost = parseFloat(row['Average Cost Basis']?.replace(/[$,]/g, '') || 0);
      const account = row['Account Name']?.trim();
      const type = row['Type']?.trim();

      if (!symbol || isNaN(quantity)) return; // skip empty rows

      const isCash = symbol.startsWith('CORE') || symbol.startsWith('FCASH');

      results.push({
  ticker: isCash ? 'CASH' : symbol.toUpperCase(),
  shares: parsedShares,
  avg_price: parsedAvgPrice,
  account_type: account || null,
  tag: isCash ? 'Cash' : null,
  notes: row['Description']?.slice(0, 200) || null,
  cost_basis_total: costBasisTotal,
  current_price: currentPrice,
  market_value: marketValue,
  gain_dollar: gainDollar,
  gain_percent: gainPercent,
  price_last_updated: new Date().toISOString()
});
    })
    .on('end', async () => {
      try {
        const uploadRes = await pool.query(
          `INSERT INTO uploads (source_filename) VALUES ($1) RETURNING id`,
          [req.file.originalname]
        );
        const uploadId = uploadRes.rows[0].id;

        const insertPromises = results.map((row) =>
          pool.query(
            `INSERT INTO positions
            (upload_id, ticker, shares, avg_price, account_type, tag, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [uploadId, row.ticker, row.shares, row.avg_price, row.account_type, row.tag, row.notes]
          )
        );

        await Promise.all(insertPromises);
        res.json({ message: 'Upload processed', count: results.length, data: results });
      } catch (err) {
        console.error('❌ DB insert failed:', err);
        res.status(500).json({ error: 'Internal error' });
      } finally {
        fs.unlinkSync(filePath);
      }
    });
});
app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});