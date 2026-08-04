/**
 * Alt F — Desktop home feed (/ on tablet and up).
 *
 * Same Reels-style feed as mobile, but kept inside the normal Alt F shell: left
 * nav sidebar, right activity rail, and the feed as the centre column with each
 * track framed in phone proportions. Scroll or ↑/↓ to move between tracks,
 * space to play.
 *
 * The classic home page stays at /home.
 */
import React, { useEffect } from 'react';
import { usePlayer } from '../components/PlayerProvider';
import { AltSidebar, BG, TEXT, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltActivitySidebar } from '../components/altshell/AltActivitySidebar';
import { TrackFeed } from '../components/altshell/trackfeed/TrackFeed';

export const FrontpageAltFDesktopFeed: React.FC = () => {
    const { player } = usePlayer();
    useEffect(() => { document.title = 'Fuji Studio | Feed'; }, []);

    // Leave room for the global player bar, which stays visible on desktop.
    const pb = player.currentTrack ? 90 : 0;

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Home" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Feed' }]} />
                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingBottom: pb }}>
                        <TrackFeed
                            variant="desktop"
                            params={{}}
                            emptyMessage="No tracks have been uploaded yet."
                        />
                    </div>
                    <AltActivitySidebar />
                </div>
            </main>
        </div>
    );
};
