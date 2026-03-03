import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ArtistDiscoveryPage } from './pages/ArtistDiscovery';
import { PlayerProvider } from './components/PlayerProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PlayerProvider>
        <div className="app">
          <ArtistDiscoveryPage />
        </div>
      </PlayerProvider>
    </BrowserRouter>
  </React.StrictMode>
);
