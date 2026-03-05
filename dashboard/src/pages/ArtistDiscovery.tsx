import React from 'react';

export const ArtistDiscoveryPage: React.FC = () => {
    return (
        <div style={{ padding: '40px', textAlign: 'center', background: '#161925', minHeight: '100vh', color: 'white' }}>
            <h1 style={{ fontSize: '48px', color: '#22C55E' }}>FUJI STUDIO - DISCOVERY</h1>
            <p>If you see this, React successfully rendered the discovery component.</p>
            <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #333' }}>
                DEBUG: {window.location.pathname}
            </div>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}>
                Reload Page
            </button>
        </div>
    );
};
