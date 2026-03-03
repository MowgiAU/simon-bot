import React from 'react';
import ReactDOM from 'react-dom/client';
import { ArtistDiscoveryPage } from './pages/ArtistDiscovery';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="app">
      <ArtistDiscoveryPage />
    </div>
  </React.StrictMode>
);
