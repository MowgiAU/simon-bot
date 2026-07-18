/**
 * Alt F — Upload Track page (/upload). Wraps the shared TrackUploadForm in the Alt F
 * shell. Supports battle preselect via ?battle=<idOrSlug> — the upload is then submitted
 * to that battle (fetches the battle for its title + project-file requirement).
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { usePlayer } from '../components/PlayerProvider';
import { TrackUploadForm } from '../components/TrackUploadForm';
import { AltSidebar, BG, S_CONT, PRIMARY, TEXT, SUB, BORDER, FONT, CONTENT_MAX } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { UploadCloud, Swords, LogIn } from 'lucide-react';

const FrontpageAltFUpload: React.FC = () => {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { player } = usePlayer();

    const battleTarget = new URLSearchParams(window.location.search).get('battle') || undefined;
    const [battle, setBattle] = useState<any>(null);
    const [battleLoading, setBattleLoading] = useState(!!battleTarget);

    useEffect(() => {
        if (!battleTarget) return;
        axios.get(`/api/beat-battle/battles/${encodeURIComponent(battleTarget)}`)
            .then(r => setBattle(r.data))
            .catch(() => {})
            .finally(() => setBattleLoading(false));
    }, [battleTarget]);

    const onUploaded = (track: any) => {
        if (battle) { navigate(`/battles/${battle.slug || battle.id}`); return; }
        const username = track?.profile?.username || (user as any)?.profileUsername;
        const slug = track?.slug;
        navigate(username && slug ? `/profile/${username}/${slug}` : '/my-tracks');
    };
    const onCancel = () => navigate(battle ? `/battles/${battle.slug || battle.id}` : '/my-tracks');

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={battle ? [{ label: 'Battles', to: '/battles' }, { label: battle.title, to: `/battles/${battle.slug || battle.id}` }, { label: 'Enter' }] : [{ label: 'Upload' }]} />
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
                    <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: '24px 32px 60px', boxSizing: 'border-box' }}>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${PRIMARY}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {battle ? <Swords size={26} color={PRIMARY} /> : <UploadCloud size={26} color={PRIMARY} />}
                            </div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{battle ? 'Enter Battle' : 'Upload a Track'}</h1>
                                <p style={{ margin: '4px 0 0', color: SUB, fontSize: 14 }}>
                                    {battle ? <>Submitting to <strong style={{ color: TEXT }}>{battle.title}</strong></> : 'Share your music — audio, artwork, FL Studio project files, and stems.'}
                                </p>
                            </div>
                        </div>

                        {authLoading || battleLoading ? (
                            <div style={{ padding: 60, textAlign: 'center', color: SUB }}><AltSpinner /></div>
                        ) : !user ? (
                            <div style={{ maxWidth: 520, background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
                                <LogIn size={40} color={PRIMARY} style={{ marginBottom: 14 }} />
                                <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Sign in to upload</h2>
                                <p style={{ margin: '0 0 20px', color: SUB, fontSize: 14 }}>You need a Fuji Studio account to share tracks{battle ? ' and enter battles' : ''}.</p>
                                <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', background: PRIMARY, borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                                    <LogIn size={16} /> Sign In
                                </a>
                            </div>
                        ) : (
                            <div style={{ maxWidth: 720 }}>
                                <TrackUploadForm
                                    battleId={battle ? battle.id : undefined}
                                    requireProjectFile={battle?.requireProjectFile}
                                    onUploaded={onUploaded}
                                    onCancel={onCancel}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FrontpageAltFUpload;
