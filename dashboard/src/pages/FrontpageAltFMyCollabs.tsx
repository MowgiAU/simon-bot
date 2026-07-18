/**
 * Alt F — My Collabs Hub
 * Authenticated dashboard: My Callouts / My Requests / My Projects tabs.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { AltSidebar, BG, S_LOWEST, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { useAuth } from '../components/AuthProvider';
import { Users, Plus, Edit2, Trash2, CheckCircle, Clock, XCircle, ExternalLink, ArrowRight } from 'lucide-react';

type Tab = 'callouts' | 'requests' | 'projects';

function timeAgo(d: string) {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

const StatusPill = ({ status, map }: { status: string; map: Record<string, [string, string]> }) => {
    const [color, label] = map[status] || [SUB, status];
    return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: `${color}22`, color, fontWeight: 700 }}>{label}</span>;
};

const calloutStatusMap: Record<string, [string, string]> = { open: [PRIMARY, 'Open'], matched: [SECONDARY, 'Matched'], closed: [SUB, 'Closed'] };
const requestStatusMap: Record<string, [string, string]> = { pending: [SECONDARY, 'Pending'], accepted: [PRIMARY, 'Accepted'], declined: [TERTIARY, 'Declined'] };
const projectStatusMap: Record<string, [string, string]> = { active: [PRIMARY, 'Active'], releasing: [SECONDARY, 'Releasing'], released: [SECONDARY, 'Released'], abandoned: [SUB, 'Abandoned'] };

export default function FrontpageAltFMyCollabs() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState<Tab>('callouts');
    const [callouts, setCallouts] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        if (!user) return;
        Promise.all([
            axios.get('/api/collab/my-callouts', { withCredentials: true }),
            axios.get('/api/collab/my-requests', { withCredentials: true }),
            axios.get('/api/collab/my-projects', { withCredentials: true }),
        ]).then(([c, r, p]) => {
            setCallouts(c.data);
            setRequests(r.data);
            setProjects(p.data);
        }).catch(() => {}).finally(() => setLoading(false));
    }, [user]);

    const closeCallout = async (id: string) => {
        try {
            await axios.patch(`/api/collab/callouts/${id}`, { status: 'closed' }, { withCredentials: true });
            setCallouts(prev => prev.map(c => c.id === id ? { ...c, status: 'closed' } : c));
        } catch { /* ignore */ }
    };

    const deleteCallout = async (id: string) => {
        if (!confirm('Delete this callout?')) return;
        try {
            await axios.delete(`/api/collab/callouts/${id}`, { withCredentials: true });
            setCallouts(prev => prev.filter(c => c.id !== id));
        } catch { /* ignore */ }
    };

    if (!user) return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <Users size={40} color={SUB} />
                <p style={{ color: SUB }}>Sign in to manage your collabs</p>
                <Link to="/login" style={{ padding: '10px 24px', borderRadius: 99, background: PRIMARY, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Sign In</Link>
            </div>
        </div>
    );

    const TABS: { id: Tab; label: string; count: number }[] = [
        { id: 'callouts', label: 'My Callouts', count: callouts.length },
        { id: 'requests', label: 'My Requests', count: requests.length },
        { id: 'projects', label: 'My Projects', count: projects.length },
    ];

    return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT, overflow: 'hidden' }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <AltHeader />
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${PRIMARY}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Users size={20} color={PRIMARY} />
                            </div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>My Collabs</h1>
                                <p style={{ margin: 0, fontSize: 13, color: SUB }}>Your callouts, requests & active projects</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Link to="/collabs" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 99, background: S_CONT, border: `1px solid ${BORDER}`, color: TEXT, textDecoration: 'none', fontSize: 13 }}>
                                Browse Callouts <ArrowRight size={14} />
                            </Link>
                            <button onClick={() => navigate('/collabs')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 99, background: PRIMARY, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                <Plus size={14} /> Post Callout
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: S_CONT, borderRadius: 10, padding: 4, width: 'fit-content' }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 7, border: 'none', background: tab === t.id ? S_HIGH : 'transparent', color: tab === t.id ? TEXT : SUB, fontWeight: tab === t.id ? 700 : 400, fontSize: 13, cursor: 'pointer' }}>
                                {t.label}
                                {t.count > 0 && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: tab === t.id ? PRIMARY : `${SUB}33`, color: tab === t.id ? '#fff' : SUB }}>{t.count}</span>}
                            </button>
                        ))}
                    </div>

                    {loading ? <div style={{ color: SUB }}><AltSpinner /></div> : (
                        <>
                            {/* My Callouts */}
                            {tab === 'callouts' && (
                                callouts.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                                        <Users size={36} color={SUB} style={{ margin: '0 auto 12px', display: 'block' }} />
                                        <p style={{ color: SUB, marginBottom: 16 }}>You haven't posted any callouts yet</p>
                                        <Link to="/collabs" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 99, background: PRIMARY, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Post Your First Callout</Link>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {callouts.map(c => (
                                            <div key={c.id} style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <Link to={`/collabs/callout?id=${c.id}`} style={{ fontWeight: 700, fontSize: 15, color: TEXT, textDecoration: 'none' }}>{c.title}</Link>
                                                        <StatusPill status={c.status} map={calloutStatusMap} />
                                                    </div>
                                                    <div style={{ fontSize: 12, color: SUB }}>
                                                        {c._count?.requests ?? 0} request{c._count?.requests !== 1 ? 's' : ''} · {c.requests?.length > 0 ? <span style={{ color: PRIMARY }}>{c.requests.length} pending</span> : 'none pending'} · {timeAgo(c.createdAt)}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                                    <Link to={`/collabs/callout?id=${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: S_HIGH, color: TEXT, textDecoration: 'none', fontSize: 12 }}>
                                                        <ExternalLink size={13} /> View
                                                    </Link>
                                                    {c.status === 'open' && (
                                                        <button onClick={() => closeCallout(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${BORDER}`, color: SUB, fontSize: 12, cursor: 'pointer' }}>Close</button>
                                                    )}
                                                    {c.status === 'closed' && (
                                                        <button onClick={() => deleteCallout(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${TERTIARY}44`, color: TERTIARY, fontSize: 12, cursor: 'pointer' }}>
                                                            <Trash2 size={13} /> Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {/* My Requests */}
                            {tab === 'requests' && (
                                requests.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                                        <p style={{ color: SUB, marginBottom: 16 }}>You haven't submitted any requests yet</p>
                                        <Link to="/collabs" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 99, background: PRIMARY, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Browse Callouts</Link>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {requests.map(r => (
                                            <div key={r.id} style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
                                                <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
                                                    {r.callout?.profile?.avatar && <img src={r.callout.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <Link to={`/collabs/callout?id=${r.calloutId}`} style={{ fontWeight: 700, fontSize: 14, color: TEXT, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.callout?.title}</Link>
                                                        <StatusPill status={r.status} map={requestStatusMap} />
                                                    </div>
                                                    <div style={{ fontSize: 12, color: SUB }}>by {r.callout?.profile?.displayName || r.callout?.profile?.username} · {timeAgo(r.createdAt)}</div>
                                                </div>
                                                {r.status === 'accepted' && r.project && (
                                                    <Link to={`/collabs/workspace?id=${r.project.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 99, background: `${PRIMARY}22`, color: PRIMARY, textDecoration: 'none', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                                                        <ExternalLink size={13} /> Workspace
                                                    </Link>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {/* My Projects */}
                            {tab === 'projects' && (
                                projects.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                                        <p style={{ color: SUB }}>No active collab projects yet. Accept a request or send one to get started.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {projects.map(p => (
                                            <Link key={p.id} to={`/collabs/workspace?id=${p.id}`} style={{ display: 'flex', gap: 14, alignItems: 'center', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px', textDecoration: 'none', color: TEXT }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, border: `2px solid ${BG}` }}>
                                                        {p.initiator?.avatar && <img src={p.initiator.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                    </div>
                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, border: `2px solid ${BG}`, marginLeft: -10 }}>
                                                        {p.collaborator?.avatar && <img src={p.collaborator.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                    </div>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <span style={{ fontWeight: 700, fontSize: 14 }}>{p.request?.callout?.title}</span>
                                                        <StatusPill status={p.status} map={projectStatusMap} />
                                                    </div>
                                                    <div style={{ fontSize: 12, color: SUB }}>
                                                        {p.initiator?.displayName || p.initiator?.username} × {p.collaborator?.displayName || p.collaborator?.username} · {timeAgo(p.createdAt)}
                                                    </div>
                                                </div>
                                                {p.track && <div style={{ fontSize: 12, color: SECONDARY, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}><CheckCircle size={13} /> Track ready</div>}
                                                <ExternalLink size={15} color={SUB} style={{ flexShrink: 0 }} />
                                            </Link>
                                        ))}
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
