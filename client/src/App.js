import React, { useEffect, useState } from 'react';

function App() {
  const [uploadedData, setUploadedData] = useState([]);
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
      {uploadedData.length > 0 && (
  <div style={{ marginTop: '2rem' }}>
    <h3>📃 Uploaded Portfolio Preview</h3>
    <table border="1" cellPadding="10">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Shares</th>
          <th>Price</th>
          <th>Cost Basis</th>
          <th>Market Value</th>
          <th>Gain ($)</th>
          <th>Gain (%)</th>
          <th>Asset Class</th>
          <th>Sector</th>
        </tr>
      </thead>
      <tbody>
        {uploadedData.map((row, index) => (
          <tr key={index}>
            <td>{row.ticker}</td>
            <td>{row.shares}</td>
            <td>${row.price}</td>
            <td>${row.costBasis}</td>
            <td>${row.marketValue}</td>
            <td>${row.gainDollar}</td>
            <td>{row.gainPercent}%</td>
            <td>{row.assetClass}</td>
            <td>{row.sector}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
<form
  onSubmit={(e) => {
    e.preventDefault();
    const file = e.target.elements.csvFile.files[0];
    const formData = new FormData();
    formData.append('file', file);

    fetch(process.env.REACT_APP_API_URL + '/api/upload', {
      method: 'POST',
      body: formData
    })
      .then((res) => res.json())
      .then((data) => {
      console.log('Upload Response:', data);
      setUploadedData(data.data);  // Save to state
})
      .catch((err) => {
        console.error('Upload failed:', err);
        alert('⚠️ Upload failed.');
      });
  }}
  style={{ marginTop: '2rem' }}
>
  <h3>📤 Upload Portfolio CSV</h3>
  <input type="file" name="csvFile" accept=".csv" required />
  <button type="submit">Upload</button>
</form>
    </div>
  );
}

export default App;