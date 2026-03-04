import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

console.log('--- REACT MAIN ENTRY ---');
const rootElement = document.getElementById('root');
console.log('Root element found:', rootElement);

if (!rootElement) {
  console.error('CRITICAL: Root element #root not found in DOM!');
  document.body.innerHTML = '<div style="background:red;color:white;padding:20px;font-family:sans-serif;"><h1>CRITICAL ERROR</h1><p>The #root element was not found in the DOM. React cannot mount.</p></div>';
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    console.log('Rendering App component...');
    root.render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    console.log('Render call completed.');
  } catch (err) {
    console.error('FAILED TO RENDER REACT:', err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    document.body.innerHTML = `<div style="background:darkred;color:white;padding:20px;font-family:sans-serif;"><h1>REACT RENDER FAILED</h1><pre>${errorMsg}</pre></div>`;
  }
}
