const { Pool } = require('pg');

const pool = new Pool({
  user: 'kbuser',
  host: 'db', // this is the Docker service name from docker-compose.yml
  database: 'stocktracker',
  password: 'supersecure',
  port: 5432
});

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
let uploadedPortfolio = [];  // 🧠 holds the last uploaded CSV
const PORT = 4000;

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('📡 Stocky API is live!');
});

app.get('/api/portfolio', (req, res) => {
  app.get('/api/portfolio', (req, res) => {
  res.json(uploadedPortfolio);
});
});
// Version check route
app.get('/api/version', (req, res) => {
  const versionInfo = {
    version: 'v1.0.3',
    deployedAt: new Date().toISOString()
  };
  res.json(versionInfo);
});
app.post('/api/upload', upload.single('file'), (req, res) => {
  const csv = require('csv-parser');
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const results = [];

  try {
    // 1️⃣ Insert into uploads table
    const uploadResult = await pool.query(
      `INSERT INTO uploads (source_filename) VALUES ($1) RETURNING id`,
      [originalName]
    );
    const uploadId = uploadResult.rows[0].id;

    // 2️⃣ Parse CSV
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', async () => {
        // 3️⃣ Insert each position
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

        fs.unlinkSync(filePath); // clean up uploaded file
        res.json({ message: '✅ Upload saved to database', uploadId, count: results.length });
      });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});