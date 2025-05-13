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
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const results = [];

  try {
    // 1️⃣ Insert metadata
    const uploadResult = await pool.query(
      `INSERT INTO uploads (source_filename) VALUES ($1) RETURNING id`,
      [originalName]
    );
    const uploadId = uploadResult.rows[0].id;

    // 2️⃣ Parse and collect CSV rows
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', async () => {
        // 3️⃣ Insert each position row
        for (let row of results) {
          const { Ticker, Shares, AvgPrice, Account } = row;
          if (!Ticker || !Shares || !AvgPrice) continue;

          await pool.query(
            `INSERT INTO positions
              (upload_id, ticker, shares, avg_price, account_type)
              VALUES ($1, $2, $3, $4, $5)`,
            [uploadId, Ticker.trim(), Shares, AvgPrice, Account || null]
          );
        }

        uploadedPortfolio = results; // save in memory too
        fs.unlinkSync(filePath);
         res.json({
         message: '✅ Upload saved to database',
         uploadId,
         count: results.length,
         data: results  // ← add this line to send the parsed rows back -Kb
});
      });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});