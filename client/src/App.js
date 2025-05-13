import React, { useEffect, useState } from 'react';

function App() {
  const [uploadedData, setUploadedData] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [selectedUploadId, setSelectedUploadId] = useState(null);
  
  useEffect(() => {
     // Load upload history
  fetch(`${process.env.REACT_APP_API_URL}/api/uploads`)
    .then(res => res.json())
    .then(data => {
      setUploadHistory(data);
      console.log('Uploads:', data);
      if (data.length > 0 && !selectedUploadId) {
        setSelectedUploadId(data[0].id); // default to latest
      }
    })
    .catch(err => console.error('Upload history fetch failed:', err));
}, []);
  useEffect(() => {
  if (!selectedUploadId) return;

  fetch(`${process.env.REACT_APP_API_URL}/api/portfolio?uploadId=${selectedUploadId}`)
    .then(res => res.json())
    .then(data => {
      console.log('Portfolio data:', data);
      setPortfolio(data.positions || []);
    })
    .catch(err => console.error('Portfolio fetch failed:', err));
}, [selectedUploadId]);

  const totalShares = portfolio.reduce((sum, row) => sum + parseFloat(row.shares || 0), 0);
  const totalMarketValue = portfolio.reduce(
    (sum, row) => sum + (parseFloat(row.shares || 0) * parseFloat(row.avg_price || 0)),
  0
);
return (
  <div style={{ padding: '2rem' }}>
    <h1>📈 Stocky Portfolio</h1>
{uploadHistory.length > 0 && (
  <div style={{ marginTop: '1rem' }}>
    <label htmlFor="uploadSelect"><strong>📂 Select Upload:</strong>{' '}</label>
    <select
      id="uploadSelect"
      value={selectedUploadId || ''}
      onChange={(e) => setSelectedUploadId(e.target.value)}
    >
      {uploadHistory.map((upload) => (
        <option key={upload.id} value={upload.id}>
          {upload.uploaded_at.split('T')[0]} — {upload.source_filename}
        </option>
      ))}
    </select>
  </div>
)}
    {/* --- Portfolio Table --- */}
   {portfolio.length > 0 && (
  <div style={{ marginTop: '2rem' }}>
    <h2>🗂️ Latest Uploaded Portfolio</h2>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#f2f2f2' }}>
          <th style={{ padding: '8px' }}>Ticker</th>
          <th style={{ padding: '8px', textAlign: 'right' }}>Shares</th>
          <th style={{ padding: '8px', textAlign: 'right' }}>Avg. Price</th>
          <th style={{ padding: '8px', textAlign: 'right' }}>Market Value</th>
          <th style={{ padding: '8px', textAlign: 'right' }}>Gain ($)</th>
          <th style={{ padding: '8px', textAlign: 'right' }}>Gain (%)</th>
          <th style={{ padding: '8px' }}>Account</th>
          <th style={{ padding: '8px' }}>Tag</th>
          <th style={{ padding: '8px' }}>Notes</th>
        </tr>
      </thead>
      <tbody>
        {portfolio.map((row, index) => (
          <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '8px', fontWeight: 'bold' }}>{row.ticker}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{parseFloat(row.shares).toLocaleString()}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>${parseFloat(row.avg_price).toFixed(2)}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>${parseFloat(row.market_value || 0).toFixed(2)}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>${parseFloat(row.gain_dollar || 0).toFixed(2)}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{parseFloat(row.gain_percent || 0).toFixed(2)}%</td>
            <td style={{ padding: '8px' }}>{row.account_type || '-'}</td>
            <td style={{ padding: '8px' }}>{row.tag || '-'}</td>
            <td style={{ padding: '8px' }}>{row.notes || '-'}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
          <td style={{ padding: '8px' }}>TOTAL</td>
          <td style={{ padding: '8px', textAlign: 'right' }}>{totalShares.toLocaleString()}</td>
          <td style={{ padding: '8px', textAlign: 'right' }}>${totalMarketValue.toFixed(2)}</td>
          <td colSpan="6" />
        </tr>
      </tfoot>
    </table>
  </div>
)}
    {/* --- Upload Form --- */}
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

    {/* --- Uploaded Data Preview --- */}
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
  </div>
);
}
export default App;