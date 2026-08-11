/**
 * Alt F — 404 / unmatched route.
 * Anything that doesn't match a known path lands here instead of silently
 * falling back to the old ArtistDiscovery design.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { AltSidebar, BG, PRIMARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';

export const NotFoundPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Not found' }]} />
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%', background: `${PRIMARY}18`,
                            border: `1px solid ${PRIMARY}44`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px',
                        }}>
                            <Compass size={28} color={PRIMARY} />
                        </div>
                        <h1 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em' }}>Page not found</h1>
                        <p style={{ margin: '0 0 24px', color: SUB, fontSize: 14 }}>
                            That link doesn't lead anywhere. It may be outdated or mistyped.
                        </p>
                        <button onClick={() => navigate('/')} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: PRIMARY, color: '#0a0d18', border: 'none',
                            padding: '10px 20px', borderRadius: 10, fontWeight: 800, fontSize: 13,
                            cursor: 'pointer', fontFamily: FONT,
                        }}>
                            <ArrowLeft size={15} /> Back to Fuji Studio
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};
