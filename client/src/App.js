import React, { useEffect, useState } from 'react';

function App() {
  const [portfolio, setPortfolio] = useState([]);

  useEffect(() => {
    fetch(process.env.REACT_APP_API_URL + '/api/portfolio')
      .then((res) => res.json())
      .then((data) => setPortfolio(data))
      .catch((err) => console.error('API fetch failed:', err));
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>📈 Stocky Portfolio</h1>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Shares</th>
            <th>Avg Price</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.map((stock, index) => (
            <tr key={index}>
              <td>{stock.ticker}</td>
              <td>{stock.shares}</td>
              <td>${stock.avgPrice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;