const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 4000;

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

app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});
