/**
 * Alt F — Single Collab Callout Detail
 * Shows the callout, sample player, and a request form for visitors.
 * Shows incoming requests for the callout owner.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AltSidebar, BG, S_LOWEST, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { useAuth } from '../components/AuthProvider';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { ArrowLeft, Users, Tag, Music, Mic2, Sliders, Clock, CheckCircle, XCircle, ExternalLink, Play, Pause } from 'lucide-react';

function timeAgo(date: string) {
    const s = (Date.now() - new Date(date).getTime()) / 1000;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, [string, string]> = { open: [PRIMARY, 'Open'], matched: [SECONDARY, 'Matched'], closed: [SUB, 'Closed'] };
    const [color, label] = map[status] || [SUB, status];
    return <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${color}22`, color, fontWeight: 700 }}>{label}</span>;
};

const RequestStatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, [string, string]> = { pending: [SECONDARY, 'Pending'], accepted: [PRIMARY, 'Accepted'], declined: [TERTIARY, 'Declined'] };
    const [color, label] = map[status] || [SUB, status];
    return <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${color}22`, color, fontWeight: 700 }}>{label}</span>;
};

export default function FrontpageAltFCollabCallout() {
    const { search } = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const id = new URLSearchParams(search).get('id') || '';

    const [callout, setCallout] = useState<any>(null);
    const [requests, setRequests] = useState<any[]>([]);
    const [myRequest, setMyRequest] = useState<any>(null);
    const [myProfile, setMyProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Request form
    const [message, setMessage] = useState('');
    const [roleOffered, setRoleOffered] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const [sent, setSent] = useState(false);

    // Owner: resolving a request
    const [resolving, setResolving] = useState<string | null>(null);

    const isOwner = myProfile && callout && myProfile.id === callout.profileId;

    useEffect(() => {
        if (!id) return;
        Promise.all([
            axios.get(`/api/collab/callouts/${id}`),
            user ? axios.get('/api/collab/my-callouts', { withCredentials: true }).catch(() => null) : null,
            user ? axios.get(`/api/collab/callouts/${id}/requests`, { withCredentials: true }).catch(() => null) : null,
            user ? axios.get('/api/collab/my-requests', { withCredentials: true }).catch(() => null) : null,
        ]).then(([calloutRes, myCalloutsRes, reqsRes, myReqsRes]) => {
            setCallout(calloutRes.data);
            if (reqsRes?.data) setRequests(reqsRes.data);
            if (myReqsRes?.data) {
                const mine = myReqsRes.data.find((r: any) => r.calloutId === id);
                if (mine) setMyRequest(mine);
            }
            // Determine my profile
            if (myCalloutsRes?.data) {
                // we have profile from another endpoint — fetch it
            }
        }).catch(() => {})
            .finally(() => setLoading(false));

        // Fetch own profile separately
        if (user) {
            axios.get('/api/musician/profile/me', { withCredentials: true }).catch(() =>
                axios.get(`/api/musician/profile/${(user as any).username || (user as any).id}`, { withCredentials: true }).catch(() => null)
            ).then(r => { if (r?.data) setMyProfile(r.data); }).catch(() => {});
        }
    }, [id, user]);

    const toggleAudio = () => {
        if (!audioRef.current) return;
        if (playing) { audioRef.current.pause(); setPlaying(false); }
        else { audioRef.current.play(); setPlaying(true); }
    };

    const sendRequest = async () => {
        if (!message.trim()) { setSendError('Please write a message'); return; }
        setSending(true); setSendError('');
        try {
            const { data } = await axios.post(`/api/collab/callouts/${id}/requests`, { message, roleOffered }, { withCredentials: true });
            setMyRequest(data);
            setSent(true);
        } catch (e: any) {
            setSendError(e.response?.data?.error || 'Failed to send request');
        }
        setSending(false);
    };

    const resolveRequest = async (requestId: string, action: 'accept' | 'decline') => {
        setResolving(requestId);
        try {
            const { data } = await axios.patch(`/api/collab/requests/${requestId}`, { action }, { withCredentials: true });
            setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: data.status } : r));
            if (action === 'accept' && data.project) {
                navigate(`/preview/alt_f_collab_workspace?id=${data.project.id}`);
            }
        } catch { /* ignore */ }
        setResolving(null);
    };

    if (loading) return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}><AltSpinner /></div>
        </div>
    );

    if (!callout) return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Callout not found</div>
        </div>
    );

    return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT, overflow: 'hidden' }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <AltHeader />
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: 800, width: '100%', margin: '0 auto' }}>

                    <Link to="/preview/alt_f_collabs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: SUB, textDecoration: 'none', fontSize: 13, marginBottom: 20 }}>
                        <ArrowLeft size={14} /> Back to Collabs
                    </Link>

                    {/* Callout header */}
                    <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                            <Link to={`/profile/${callout.profile?.username}`} style={{ flexShrink: 0 }}>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: S_HIGH }}>
                                    {callout.profile?.avatar && <img src={callout.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                </div>
                            </Link>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{callout.title}</h1>
                                    <StatusBadge status={callout.status} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SUB }}>
                                    <Link to={`/profile/${callout.profile?.username}`} style={{ color: SECONDARY, textDecoration: 'none', fontWeight: 600 }}>{callout.profile?.displayName || callout.profile?.username}</Link>
                                    <span>·</span>
                                    <Clock size={12} />{timeAgo(callout.createdAt)}
                                </div>
                            </div>
                        </div>

                        <p style={{ margin: '20px 0', fontSize: 15, lineHeight: 1.7, color: TEXT }}>{callout.description}</p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {callout.genreTags?.map((g: string) => (
                                <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px', borderRadius: 99, background: `${SECONDARY}22`, color: SECONDARY, fontWeight: 600 }}>
                                    <Tag size={11} /> {g}
                                </span>
                            ))}
                            {callout.rolesWanted?.map((r: string) => (
                                <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px', borderRadius: 99, background: `${PRIMARY}22`, color: PRIMARY, fontWeight: 600 }}>
                                    <Music size={11} /> {r}
                                </span>
                            ))}
                        </div>

                        {/* Sample player */}
                        {callout.sampleUrl && callout.sampleType === 'audio' && (
                            <div style={{ marginTop: 20, background: S_HIGH, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button onClick={toggleAudio} style={{ width: 38, height: 38, borderRadius: '50%', background: PRIMARY, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {playing ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />}
                                </button>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Preview Sample</div>
                                    <div style={{ fontSize: 11, color: SUB }}>Click to play</div>
                                </div>
                                <audio ref={audioRef} src={callout.sampleUrl} onEnded={() => setPlaying(false)} />
                            </div>
                        )}
                    </div>

                    {/* Owner: incoming requests */}
                    {isOwner && (
                        <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Requests ({requests.length})</h3>
                            {requests.length === 0 ? (
                                <p style={{ color: SUB, margin: 0, fontSize: 14 }}>No requests yet — share your callout to get discovered.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {requests.map(r => (
                                        <div key={r.id} style={{ background: S_HIGH, borderRadius: 10, padding: '16px 18px' }}>
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                                                <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: S_CONT, flexShrink: 0 }}>
                                                    {r.profile?.avatar && <img src={r.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <Link to={`/profile/${r.profile?.username}`} style={{ fontWeight: 700, fontSize: 14, color: SECONDARY, textDecoration: 'none' }}>{r.profile?.displayName || r.profile?.username}</Link>
                                                        <RequestStatusBadge status={r.status} />
                                                        {r.roleOffered && <span style={{ fontSize: 11, color: PRIMARY, background: `${PRIMARY}22`, padding: '2px 8px', borderRadius: 99 }}>{r.roleOffered}</span>}
                                                    </div>
                                                    <p style={{ margin: '6px 0 0', fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{r.message}</p>
                                                </div>
                                            </div>
                                            {r.status === 'pending' && callout.status === 'open' && (
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                    <button onClick={() => resolveRequest(r.id, 'decline')} disabled={resolving === r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${TERTIARY}44`, color: TERTIARY, fontSize: 13, cursor: 'pointer' }}>
                                                        <XCircle size={14} /> Decline
                                                    </button>
                                                    <button onClick={() => resolveRequest(r.id, 'accept')} disabled={resolving === r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: PRIMARY, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                                        <CheckCircle size={14} /> Accept
                                                    </button>
                                                </div>
                                            )}
                                            {r.status === 'accepted' && r.project && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <Link to={`/preview/alt_f_collab_workspace?id=${r.project.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: `${PRIMARY}22`, color: PRIMARY, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                                                        <ExternalLink size={14} /> Open Workspace
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Visitor: send request */}
                    {!isOwner && callout.status === 'open' && (
                        <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24 }}>
                            {!user ? (
                                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                    <p style={{ color: SUB, marginBottom: 16 }}>Sign in to send a collab request</p>
                                    <Link to="/login" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 99, background: PRIMARY, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Sign In</Link>
                                </div>
                            ) : myRequest ? (
                                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                                    <RequestStatusBadge status={myRequest.status} />
                                    <p style={{ color: SUB, marginTop: 10, fontSize: 14 }}>
                                        {myRequest.status === 'pending' ? 'Your request is pending review.' : myRequest.status === 'accepted' ? 'Your request was accepted!' : 'Your request was not accepted this time.'}
                                    </p>
                                    {myRequest.status === 'accepted' && myRequest.project && (
                                        <Link to={`/preview/alt_f_collab_workspace?id=${myRequest.project.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '9px 20px', borderRadius: 99, background: PRIMARY, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
                                            <ExternalLink size={14} /> Open Workspace
                                        </Link>
                                    )}
                                </div>
                            ) : sent ? (
                                <div style={{ textAlign: 'center', padding: '12px 0', color: PRIMARY }}>
                                    <CheckCircle size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
                                    <p style={{ margin: 0, fontWeight: 700 }}>Request sent! Wait for the artist to review it.</p>
                                </div>
                            ) : (
                                <>
                                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Send a Collab Request</h3>
                                    {sendError && <div style={{ background: '#ff4d4f22', border: '1px solid #ff4d4f', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#ff4d4f', fontSize: 13 }}>{sendError}</div>}
                                    <label style={{ display: 'block', fontSize: 12, color: SUB, fontWeight: 600, marginBottom: 6 }}>WHAT YOU'RE OFFERING (optional)</label>
                                    <input value={roleOffered} onChange={e => setRoleOffered(e.target.value)} placeholder="e.g. vocals, mixing, guitar…" style={{ width: '100%', background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 13px', color: TEXT, fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }} />
                                    <label style={{ display: 'block', fontSize: 12, color: SUB, fontWeight: 600, marginBottom: 6 }}>YOUR MESSAGE</label>
                                    <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Introduce yourself and explain why you'd be a great fit for this collab…" rows={4} style={{ width: '100%', background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 13px', color: TEXT, fontSize: 13, resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box', marginBottom: 16 }} />
                                    <button onClick={sendRequest} disabled={sending} style={{ padding: '11px 28px', borderRadius: 99, background: PRIMARY, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
                                        {sending ? 'Sending…' : 'Send Request'}
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {callout.status !== 'open' && !isOwner && (
                        <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, textAlign: 'center', color: SUB }}>
                            This callout is {callout.status} and no longer accepting requests.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
