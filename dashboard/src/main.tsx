import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import App from './App';
import './index.css';
import { showToast } from './components/Toast';

// Global 429 interceptor — show warning toast instead of breaking the page
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 429) {
      const msg = error.response.data?.error || 'You are doing that too fast. Please wait a moment.';
      showToast(msg, 'warning');
    }
    return Promise.reject(error);
  }
);

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML = '<div style="background:red;color:white;padding:20px;font-family:sans-serif;"><h1>CRITICAL ERROR</h1><p>The #root element was not found in the DOM. React cannot mount.</p></div>';
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    document.body.innerHTML = `<div style="background:darkred;color:white;padding:20px;font-family:sans-serif;"><h1>REACT RENDER FAILED</h1><pre>${errorMsg}</pre></div>`;
  }
}
