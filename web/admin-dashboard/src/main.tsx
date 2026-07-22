if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('businessOverviewInventoryRiskOverviewLastGoodHtml');
  } catch {
    // Ignore storage cleanup failures.
  }
}



import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
