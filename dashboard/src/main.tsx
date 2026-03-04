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
    console.log('Rendering SIMPLE HTML to root...');
    
    // ATTEMPT 1: DIRECT DOM WRITE (BYPASS REACT)
    rootElement.innerHTML = '<div style="background:purple;color:white;padding:100px;font-size:50px;position:relative;z-index:99999;">DIRECT DOM WRITE SUCCESSFUL</div>';
    
    console.log('Attempting React render...');
    root.render(
       <div style={{ background: 'blue', color: 'white', padding: '100px', fontSize: '50px' }}>
         REACT RENDER SUCCESSFUL
       </div>
    );
    console.log('Render call completed.');
  } catch (err) {
    console.error('FAILED TO RENDER REACT:', err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    document.body.innerHTML = `<div style="background:darkred;color:white;padding:20px;font-family:sans-serif;"><h1>REACT RENDER FAILED</h1><pre>${errorMsg}</pre></div>`;
  }
}
