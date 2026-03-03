import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ArtistDiscoveryPage } from './pages/ArtistDiscovery';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <div className="app">
        <ArtistDiscoveryPage />
      </div>
    </BrowserRouter>
  </React.StrictMode>
);
