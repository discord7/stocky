import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Version check route
app.get('/api/version', (req, res) => {
  const versionInfo = {
    version: 'v1.0.3',
    deployedAt: new Date().toISOString()
  };
  res.json(versionInfo);
});
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
