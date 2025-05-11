const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
const PORT = 4000;

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('📡 Stocky API is live!');
});

app.get('/api/portfolio', (req, res) => {
  res.json([
    { ticker: 'AAPL', shares: 50, avgPrice: 150 },
    { ticker: 'VZ', shares: 100, avgPrice: 35 }
  ]);
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const results = [];

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      results.push({
        ticker: row.symbol,
        shares: parseFloat(row.quantity),
        price: parseFloat(row.price),
        costBasis: parseFloat(row.costBasis),
        marketValue: parseFloat(row.marketValue),
        gainDollar: parseFloat(row.gainLossDollar),
        gainPercent: parseFloat(row.gainLossPercent),
        assetClass: row.assetClass,
        sector: row.sector
      });
    })
    .on('end', () => {
      console.log('Parsed + Normalized CSV:', results);
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Upload successful', data: results });
    });
});

app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});
