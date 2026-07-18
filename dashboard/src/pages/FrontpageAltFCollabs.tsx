/**
 * Alt F — Collab Callout Discovery Feed
 * Browse open callouts, filter by genre/role, post your own.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AltSidebar, BG, S_LOWEST, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { useAuth } from '../components/AuthProvider';
import { AltSpinner } from '../components/altshell/AltSpinner';
import { Users, Plus, Tag, Music, Mic2, Sliders, Clock, ChevronDown, X, FolderOpen } from 'lucide-react';

const ROLES = ['vocals', 'mixing', 'mastering', 'production', 'guitar', 'bass', 'drums', 'piano', 'synths', 'songwriting', 'artwork'];
const GENRES = ['trap', 'lofi', 'house', 'dnb', 'hip-hop', 'pop', 'r&b', 'ambient', 'techno', 'dubstep', 'jazz', 'soul'];

const roleIcon = (r: string) => {
    if (r === 'vocals') return <Mic2 size={12} />;
    if (r === 'mixing' || r === 'mastering') return <Sliders size={12} />;
    return <Music size={12} />;
};

function timeAgo(date: string) {
    const s = (Date.now() - new Date(date).getTime()) / 1000;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

function CalloutCard({ c }: { c: any }) {
    const [hover, setHover] = useState(false);
    return (
        <Link
            to={`/collabs/callout?id=${c.id}`}
            onMouseEnter={e => { setHover(true); (e.currentTarget as HTMLElement).style.borderColor = `${PRIMARY}55`; (e.currentTarget as HTMLElement).style.background = S_HIGH; }}
            onMouseLeave={e => { setHover(false); (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.background = S_CONT; }}
            style={{ display: 'block', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, textDecoration: 'none', color: TEXT, transition: 'all 0.15s' }}
        >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: S_HIGH }}>
                    {c.profile?.avatar && <img src={c.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{c.title}</div>
                        <span style={{ fontSize: 11, color: SUB, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{timeAgo(c.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: SUB, marginTop: 2 }}>{c.profile?.displayName || c.profile?.username}</div>
                </div>
            </div>

            <p style={{ margin: '12px 0 12px', fontSize: 14, color: SUB, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {c.description}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {c.genreTags?.map((g: string) => (
                    <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', borderRadius: 99, background: `${SECONDARY}22`, color: SECONDARY, fontWeight: 600 }}>
                        <Tag size={10} /> {g}
                    </span>
                ))}
                {c.rolesWanted?.map((r: string) => (
                    <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', borderRadius: 99, background: `${PRIMARY}22`, color: PRIMARY, fontWeight: 600 }}>
                        {roleIcon(r)} {r}
                    </span>
                ))}
            </div>

            {c.sampleUrl && c.sampleType === 'audio' && (
                <div style={{ background: S_HIGH, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: SUB, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Music size={13} color={PRIMARY} /> Sample attached
                </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: SUB }}>{c._count?.requests ?? 0} request{c._count?.requests !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 600 }}>View →</span>
            </div>
        </Link>
    );
}

export default function FrontpageAltFCollabs() {
    const { user } = useAuth();
    const [callouts, setCallouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [genreFilter, setGenreFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    const load = async (cursor?: string, reset = false) => {
        setLoading(true);
        try {
            const params: any = { limit: 20 };
            if (cursor) params.cursor = cursor;
            if (genreFilter) params.genre = genreFilter;
            if (roleFilter) params.role = roleFilter;
            const { data } = await axios.get('/api/collab/callouts', { params });
            setCallouts(prev => reset ? data.callouts : [...prev, ...data.callouts]);
            setHasMore(data.hasMore);
            setNextCursor(data.nextCursor);
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => { load(undefined, true); }, [genreFilter, roleFilter]);

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
                                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Collabs</h1>
                                <p style={{ margin: 0, fontSize: 13, color: SUB }}>Find your next collaborator</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {user && (
                                <Link to="/my-collabs" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 99, background: S_CONT, border: `1px solid ${BORDER}`, color: TEXT, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                                    <FolderOpen size={16} /> My Collabs
                                </Link>
                            )}
                            {user && (
                                <button onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 99, background: PRIMARY, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                                    <Plus size={16} /> Post a Callout
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                        <FilterPill label="All Genres" value={genreFilter} options={GENRES} onChange={setGenreFilter} />
                        <FilterPill label="Any Role" value={roleFilter} options={ROLES} onChange={setRoleFilter} />
                        {(genreFilter || roleFilter) && (
                            <button onClick={() => { setGenreFilter(''); setRoleFilter(''); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 99, background: S_CONT, border: `1px solid ${BORDER}`, color: SUB, fontSize: 12, cursor: 'pointer' }}>
                                <X size={12} /> Clear
                            </button>
                        )}
                    </div>

                    {/* Feed */}
                    {loading && callouts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: SUB }}><AltSpinner /></div>
                    ) : callouts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <Users size={40} color={SUB} style={{ margin: '0 auto 16px', display: 'block' }} />
                            <p style={{ color: SUB, margin: 0 }}>No open callouts yet. Be the first!</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                            {callouts.map(c => <CalloutCard key={c.id} c={c} />)}
                        </div>
                    )}

                    {hasMore && (
                        <div style={{ textAlign: 'center', marginTop: 24 }}>
                            <button onClick={() => load(nextCursor!)} style={{ padding: '10px 28px', borderRadius: 99, background: S_CONT, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 14, cursor: 'pointer' }}>
                                Load more
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {showCreateModal && <CreateCalloutModal onClose={() => setShowCreateModal(false)} onCreated={c => { setCallouts(prev => [c, ...prev]); setShowCreateModal(false); }} />}
        </div>
    );
}

function FilterPill({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, background: value ? `${PRIMARY}22` : S_CONT, border: `1px solid ${value ? PRIMARY : BORDER}`, color: value ? PRIMARY : TEXT, fontSize: 13, fontWeight: value ? 700 : 400, cursor: 'pointer' }}>
                {value || label} <ChevronDown size={13} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: '110%', left: 0, background: S_LOWEST, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 6, zIndex: 50, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <div onClick={() => { onChange(''); setOpen(false); }} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: SUB }}>All</div>
                    {options.map(o => (
                        <div key={o} onClick={() => { onChange(o); setOpen(false); }} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: value === o ? PRIMARY : TEXT, background: value === o ? `${PRIMARY}22` : 'transparent' }}>{o}</div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CreateCalloutModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: any) => void }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [genres, setGenres] = useState<string[]>([]);
    const [roles, setRoles] = useState<string[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const toggleArr = (arr: string[], val: string, set: (v: string[]) => void) =>
        set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

    const submit = async () => {
        if (!title.trim() || !description.trim()) { setError('Title and description are required'); return; }
        setSaving(true); setError('');
        try {
            const fd = new FormData();
            fd.append('title', title.trim());
            fd.append('description', description.trim());
            genres.forEach(g => fd.append('genreTags', g));
            roles.forEach(r => fd.append('rolesWanted', r));
            if (file) fd.append('sampleFile', file);
            const { data } = await axios.post('/api/collab/callouts', fd, { withCredentials: true });
            onCreated(data);
        } catch (e: any) {
            setError(e.response?.data?.error || 'Failed to post callout');
        }
        setSaving(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: S_LOWEST, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h2 style={{ margin: 0, fontSize: 20 }}>Post a Collab Callout</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 4 }}><X size={20} /></button>
                </div>

                {error && <div style={{ background: '#ff4d4f22', border: '1px solid #ff4d4f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ff4d4f', fontSize: 13 }}>{error}</div>}

                <label style={{ display: 'block', fontSize: 12, color: SUB, fontWeight: 600, marginBottom: 6 }}>TITLE</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Looking for a vocalist for my trap beat" style={{ width: '100%', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />

                <label style={{ display: 'block', fontSize: 12, color: SUB, fontWeight: 600, marginBottom: 6 }}>DESCRIPTION</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell potential collaborators what you're working on, your style, what you're looking for…" rows={4} style={{ width: '100%', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14, resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box', marginBottom: 16 }} />

                <label style={{ display: 'block', fontSize: 12, color: SUB, fontWeight: 600, marginBottom: 8 }}>GENRES</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {GENRES.map(g => (
                        <button key={g} onClick={() => toggleArr(genres, g, setGenres)} style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: `1px solid ${genres.includes(g) ? SECONDARY : BORDER}`, background: genres.includes(g) ? `${SECONDARY}22` : 'transparent', color: genres.includes(g) ? SECONDARY : SUB, fontWeight: genres.includes(g) ? 700 : 400 }}>
                            {g}
                        </button>
                    ))}
                </div>

                <label style={{ display: 'block', fontSize: 12, color: SUB, fontWeight: 600, marginBottom: 8 }}>LOOKING FOR</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {ROLES.map(r => (
                        <button key={r} onClick={() => toggleArr(roles, r, setRoles)} style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: `1px solid ${roles.includes(r) ? PRIMARY : BORDER}`, background: roles.includes(r) ? `${PRIMARY}22` : 'transparent', color: roles.includes(r) ? PRIMARY : SUB, fontWeight: roles.includes(r) ? 700 : 400 }}>
                            {r}
                        </button>
                    ))}
                </div>

                <label style={{ display: 'block', fontSize: 12, color: SUB, fontWeight: 600, marginBottom: 6 }}>SAMPLE / PREVIEW (optional)</label>
                <input type="file" accept="audio/*,image/*" onChange={e => setFile(e.target.files?.[0] || null)} style={{ width: '100%', fontSize: 13, color: SUB, marginBottom: 24 }} />

                <button onClick={submit} disabled={saving} style={{ width: '100%', padding: '13px 0', borderRadius: 10, background: PRIMARY, color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Posting…' : 'Post Callout'}
                </button>
            </div>
        </div>
    );
}
