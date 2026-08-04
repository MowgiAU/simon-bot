/**
 * Alt F — Mobile track link (/profile/:username/:slug and /track/:username/:slug
 * on phones).
 *
 * A shared track link opens the shorts feed *on that track* and keeps scrolling,
 * rather than a static page — the same behaviour as opening a link into TikTok.
 * The full track page stays the desktop experience, and is one tap away from the
 * details sheet.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { AltSidebar, TEXT, SUB, FONT } from '../components/altshell/AltSidebar';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { TrackFeed } from '../components/altshell/trackfeed/TrackFeed';

export const FrontpageAltFTrackFeed: React.FC = () => {
    const location = useLocation();
    const [trackId, setTrackId] = useState<string | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

    // /profile/:username/:slug or /track/:username/:slug
    const parts = location.pathname.split('/').filter(Boolean);
    const username = parts[1];
    const slug = parts[2];

    useEffect(() => {
        if (!username || !slug) { setState('missing'); return; }
        let on = true;
        setState('loading');
        axios.get(`/api/musician/tracks/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`, { withCredentials: true })
            .then(r => {
                if (!on) return;
                if (r.data?.id) {
                    setTrackId(r.data.id);
                    document.title = `${r.data.title} | Fuji Studio`;
                    setState('ready');
                } else setState('missing');
            })
            .catch(() => { if (on) setState('missing'); });
        return () => { on = false; };
    }, [username, slug]);

    if (state !== 'ready') {
        return (
            <div style={{ minHeight: '100vh', background: '#06080e', color: TEXT, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {state === 'loading'
                    ? <AltSpinner />
                    : <div style={{ color: SUB, fontSize: 14, padding: 24, textAlign: 'center' }}>That track isn’t available.</div>}
                <AltSidebar />
            </div>
        );
    }

    return (
        <div style={{ background: '#06080e', color: TEXT, fontFamily: FONT, minHeight: '100vh' }}>
            <TrackFeed
                params={{ startTrackId: trackId! }}
                title={`@${username}`}
                backTo={`/profile/${username}`}
                createLink="/upload"
            />
            <AltSidebar />
        </div>
    );
};
