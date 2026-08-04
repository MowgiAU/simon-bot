/**
 * Alt F — Mobile home feed (/ on phones).
 *
 * Launching the app on a phone drops straight into the shorts feed: a
 * full-screen, snap-scrolled column of tracks, personalised for signed-in
 * listeners (artists you follow and your genres first) and ranked by
 * freshness + engagement for everyone else.
 *
 * The classic home page stays available at /home via the Browse button.
 */
import React, { useEffect } from 'react';
import { AltSidebar, TEXT, FONT } from '../components/altshell/AltSidebar';
import { TrackFeed } from '../components/altshell/trackfeed/TrackFeed';

export const FrontpageAltFHomeFeed: React.FC = () => {
    useEffect(() => { document.title = 'Fuji Studio | Feed'; }, []);

    return (
        <div style={{ background: '#06080e', color: TEXT, fontFamily: FONT, minHeight: '100vh' }}>
            <TrackFeed
                params={{}}
                title="Fuji Studio"
                browseTo="/home"
                createLink="/upload"
                emptyMessage="No tracks have been uploaded yet. Be the first."
            />
            <AltSidebar active="Home" />
        </div>
    );
};
