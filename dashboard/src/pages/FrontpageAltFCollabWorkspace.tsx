/**
 * Alt F — Collab Project Workspace (unified feed)
 * Everything in one chronological stream: messages, file shares, progress
 * updates — with inline reply threads and a file-attach compose bar.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    AltSidebar, BG, S_LOWEST, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY,
    TEXT, SUB, BORDER, FONT,
} from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { useAuth } from '../components/AuthProvider';
import {
    ArrowLeft, Paperclip, Send, CheckCircle, Clock, Trash2, Download,
    Music, Image, File, ExternalLink, Link2, CheckCheck,
    Reply, X, Activity, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemKind = 'message' | 'file' | 'update';

interface FeedItem {
    id: string;
    kind: ItemKind;
    profileId?: string;   // files & updates: MusicianProfile.id
    senderId?: string;    // messages: User.id
    content?: string;
    createdAt: string;
    // file extras
    label?: string;
    fileType?: string;
    url?: string;
    sizeBytes?: number;
    uploaderId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60)   return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

function parseQuote(content: string): { quote: string | null; body: string } {
    if (!content.startsWith('> ')) return { quote: null, body: content };
    const lines = content.split('\n');
    const ql: string[] = [];
    let i = 0;
    while (i < lines.length && lines[i].startsWith('> ')) { ql.push(lines[i].slice(2)); i++; }
    while (i < lines.length && lines[i].trim() === '') i++;
    return { quote: ql.join('\n'), body: lines.slice(i).join('\n') };
}

function FileKindIcon({ type }: { type: string }) {
    if (type === 'audio') return <Music size={16} color={PRIMARY} />;
    if (type === 'image') return <Image size={16} color={SECONDARY} />;
    return <File size={16} color={SUB} />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AvatarCircle({ profile, size = 36 }: { profile: any; size?: number }) {
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: S_HIGH, flexShrink: 0 }}>
            {profile?.avatar && <img src={profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
    );
}

function ApprovalStatus({ label, approved }: { label: string; approved: boolean }) {
    return (
        <div style={{ flex: 1, minWidth: 120, background: approved ? `${PRIMARY}15` : S_HIGH, border: `1px solid ${approved ? PRIMARY + '44' : BORDER}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {approved ? <CheckCircle size={15} color={PRIMARY} /> : <Clock size={15} color={SUB} />}
            <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: approved ? PRIMARY : TEXT }}>{label}</div>
                <div style={{ fontSize: 11, color: SUB }}>{approved ? 'Approved' : 'Pending'}</div>
            </div>
        </div>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <AltHeader />
                <div style={{ flex: 1, display: 'flex' }}>{children}</div>
            </div>
        </div>
    );
}

// ─── Feed item row ────────────────────────────────────────────────────────────

function FeedItemRow({ item, author, mine, showMeta, canDelete, onReply, onDelete }: {
    item: FeedItem; author: any; mine: boolean; showMeta: boolean;
    canDelete: boolean; onReply: () => void; onDelete: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    const { quote, body } = (item.content && item.kind !== 'file') ? parseQuote(item.content) : { quote: null, body: item.content || '' };

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', gap: 12,
                padding: showMeta ? '10px 8px 4px' : '2px 8px 2px',
                borderRadius: 8,
                background: hovered ? `${S_CONT}99` : 'transparent',
                transition: 'background 0.1s',
                position: 'relative',
                marginTop: item.kind === 'update' && showMeta ? 10 : 0,
            }}
        >
            {/* Avatar column — only on first in a run */}
            <div style={{ width: 36, flexShrink: 0 }}>
                {showMeta ? <AvatarCircle profile={author} size={36} /> : <div style={{ width: 36 }} />}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {showMeta && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{author?.displayName || author?.username || 'Unknown'}</span>
                        {item.kind === 'update' && (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${PRIMARY}20`, color: PRIMARY, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Update</span>
                        )}
                        {item.kind === 'file' && (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${SECONDARY}20`, color: SECONDARY, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>File</span>
                        )}
                        <span style={{ fontSize: 12, color: SUB }}>{timeAgo(item.createdAt)}</span>
                    </div>
                )}

                {/* Quote block from reply */}
                {quote && (
                    <div style={{ background: S_LOWEST, borderLeft: `3px solid ${SUB}55`, borderRadius: '0 6px 6px 0', padding: '5px 10px', marginBottom: 6, fontSize: 12, color: SUB, fontStyle: 'italic', maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {quote}
                    </div>
                )}

                {/* Text body (message or update) */}
                {item.kind !== 'file' && body && (
                    <div style={{
                        fontSize: 14, lineHeight: 1.65, color: TEXT, whiteSpace: 'pre-wrap',
                        background: item.kind === 'update' ? `${PRIMARY}09` : 'transparent',
                        padding: item.kind === 'update' ? '10px 14px' : 0,
                        borderRadius: item.kind === 'update' ? 8 : 0,
                        borderLeft: item.kind === 'update' ? `3px solid ${PRIMARY}` : 'none',
                        maxWidth: 640,
                    }}>
                        {body}
                    </div>
                )}

                {/* File card */}
                {item.kind === 'file' && (
                    <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 420 }}>
                        <FileKindIcon type={item.fileType || ''} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                            {item.sizeBytes && (
                                <div style={{ fontSize: 11, color: SUB }}>{Math.round(item.sizeBytes / 1024)} KB · {item.fileType}</div>
                            )}
                            {item.fileType === 'audio' && item.url && (
                                <audio controls src={item.url} style={{ marginTop: 6, width: '100%', height: 28 }} />
                            )}
                        </div>
                        <a href={item.url} download target="_blank" rel="noopener noreferrer" style={{ color: SUB, padding: 4, textDecoration: 'none', flexShrink: 0 }}>
                            <Download size={14} />
                        </a>
                        {canDelete && (
                            <button onClick={onDelete} style={{ background: 'none', border: 'none', color: TERTIARY, cursor: 'pointer', padding: 4, opacity: 0.7, flexShrink: 0 }}>
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Hover actions */}
            {hovered && (
                <div style={{ position: 'absolute', right: 8, top: showMeta ? 10 : 2, display: 'flex', gap: 4 }}>
                    <button onClick={onReply} title="Reply" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: S_HIGH, border: `1px solid ${BORDER}`, color: SUB, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                        <Reply size={12} /> Reply
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FrontpageAltFCollabWorkspace() {
    const { search } = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const id = new URLSearchParams(search).get('id') || '';

    const [project, setProject]     = useState<any>(null);
    const [myProfile, setMyProfile] = useState<any>(null);
    const [loading, setLoading]     = useState(true);
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

    // Compose
    const [composeText, setComposeText] = useState('');
    const [postKind, setPostKind]       = useState<'message' | 'update'>('message');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [replyTo, setReplyTo]         = useState<FeedItem | null>(null);
    const [sending, setSending]         = useState(false);
    const [uploading, setUploading]     = useState(false);

    // Release panel
    const [showRelease, setShowRelease]       = useState(false);
    const [releaseTrackTitle, setReleaseTrackTitle] = useState('');
    const [approving, setApproving]           = useState(false);
    const [releaseError, setReleaseError]     = useState('');

    // Desktop project link
    const [myProjects, setMyProjects] = useState<any[]>([]);
    const [linking, setLinking]       = useState(false);

    const fileInputRef  = useRef<HTMLInputElement>(null);
    const feedBottomRef = useRef<HTMLDivElement>(null);
    const composeRef    = useRef<HTMLTextAreaElement>(null);

    const isInitiator   = project && myProfile && project.initiatorProfileId === myProfile.id;
    const isCollaborator = project && myProfile && project.collaboratorProfileId === myProfile.id;
    const isParticipant = isInitiator || isCollaborator;
    const myApproved    = project && (isInitiator ? project.initiatorApproved : project.collaboratorApproved);
    const partner       = project && (isInitiator ? project.collaborator : project.initiator);

    const mergeFeed = useCallback((updates: any[], files: any[], messages: any[]): FeedItem[] => {
        const items: FeedItem[] = [
            ...updates.map((u: any): FeedItem => ({
                id: `u:${u.id}`, kind: 'update', profileId: u.authorId,
                content: u.content, createdAt: u.createdAt,
            })),
            ...files.map((f: any): FeedItem => ({
                id: `f:${f.id}`, kind: 'file', profileId: f.uploaderId, uploaderId: f.uploaderId,
                label: f.label, fileType: f.fileType, url: f.url, sizeBytes: f.sizeBytes,
                content: f.label, createdAt: f.createdAt,
            })),
            ...messages.map((m: any): FeedItem => ({
                id: `m:${m.id}`, kind: 'message', senderId: m.senderId,
                content: m.content, createdAt: m.createdAt,
            })),
        ];
        return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, []);

    useEffect(() => {
        if (!id || !user) return;
        const load = async () => {
            try {
                const [projRes, profileRes] = await Promise.all([
                    axios.get(`/api/collab/projects/${id}`, { withCredentials: true }),
                    axios.get('/api/musician/profile/me', { withCredentials: true }).catch(() =>
                        axios.get(`/api/musician/profile/${(user as any).username || (user as any).id}`, { withCredentials: true })
                    ),
                ]);
                const proj = projRes.data;
                setProject(proj);
                setMyProfile(profileRes.data);

                let messages: any[] = [];
                if (proj.conversationId) {
                    const msgRes = await axios.get(`/api/messages/conversations/${proj.conversationId}/messages`, { withCredentials: true });
                    messages = msgRes.data?.messages || [];
                }
                setFeedItems(mergeFeed(proj.updates || [], proj.files || [], messages));

                const projsRes = await axios.get('/api/projects', { withCredentials: true }).catch(() => null);
                if (projsRes?.data) setMyProjects(Array.isArray(projsRes.data) ? projsRes.data : projsRes.data.projects || []);
            } catch { /* not a participant */ }
            setLoading(false);
        };
        load();
    }, [id, user, mergeFeed]);

    useEffect(() => {
        feedBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [feedItems]);

    const getItemAuthor = (item: FeedItem) => {
        if (!project) return null;
        if (item.kind === 'message') {
            if (project.initiator?.userId === item.senderId) return project.initiator;
            if (project.collaborator?.userId === item.senderId) return project.collaborator;
            return null;
        }
        if (item.profileId === project.initiatorProfileId) return project.initiator;
        if (item.profileId === project.collaboratorProfileId) return project.collaborator;
        return null;
    };

    const isMine = (item: FeedItem): boolean => {
        if (!myProfile) return false;
        if (item.kind === 'message') return item.senderId === myProfile.userId || item.senderId === myProfile.id;
        return item.profileId === myProfile.id;
    };

    const handleSend = async () => {
        if (!isParticipant || project.status !== 'active') return;

        if (attachedFile) {
            setUploading(true);
            const fd = new FormData();
            fd.append('collabFile', attachedFile);
            fd.append('label', composeText.trim() || attachedFile.name);
            try {
                const { data } = await axios.post(`/api/collab/projects/${id}/files`, fd, { withCredentials: true });
                const newItem: FeedItem = {
                    id: `f:${data.id}`, kind: 'file', profileId: data.uploaderId, uploaderId: data.uploaderId,
                    label: data.label, fileType: data.fileType, url: data.url,
                    sizeBytes: data.sizeBytes, content: data.label, createdAt: data.createdAt,
                };
                setFeedItems(prev => [...prev, newItem]);
                setAttachedFile(null);
                setComposeText('');
                setReplyTo(null);
            } catch { /* ignore */ }
            setUploading(false);
            return;
        }

        if (!composeText.trim()) return;
        setSending(true);

        let text = composeText.trim();
        if (replyTo) {
            const preview = (replyTo.content || replyTo.label || '').slice(0, 100);
            text = `> ${preview}\n\n${text}`;
        }

        try {
            if (postKind === 'update') {
                const { data } = await axios.post(`/api/collab/projects/${id}/updates`, { content: text }, { withCredentials: true });
                setFeedItems(prev => [...prev, { id: `u:${data.id}`, kind: 'update', profileId: data.authorId, content: data.content, createdAt: data.createdAt }]);
            } else if (project.conversationId) {
                const { data } = await axios.post(`/api/messages/conversations/${project.conversationId}/messages`, { content: text }, { withCredentials: true });
                setFeedItems(prev => [...prev, { id: `m:${data.id}`, kind: 'message', senderId: data.senderId, content: data.content, createdAt: data.createdAt }]);
            }
            setComposeText('');
            setReplyTo(null);
        } catch { /* ignore */ }
        setSending(false);
    };

    const handleDeleteFile = async (item: FeedItem) => {
        const fileId = item.id.replace('f:', '');
        try {
            await axios.delete(`/api/collab/projects/${id}/files/${fileId}`, { withCredentials: true });
            setFeedItems(prev => prev.filter(i => i.id !== item.id));
        } catch { /* ignore */ }
    };

    const linkProject = async (projectId: string) => {
        setLinking(true);
        try {
            const { data } = await axios.patch(`/api/collab/projects/${id}/link-sync`, { projectId }, { withCredentials: true });
            setProject((p: any) => ({ ...p, ...data }));
        } catch { /* ignore */ }
        setLinking(false);
    };

    const approve = async () => {
        setApproving(true); setReleaseError('');
        try {
            const { data } = await axios.patch(`/api/collab/projects/${id}/approve`, { trackTitle: releaseTrackTitle }, { withCredentials: true });
            setProject((p: any) => ({ ...p, ...data.project }));
            if (data.released && data.track) navigate(`/preview/alt_f_track?id=${data.track.id}`);
        } catch (e: any) {
            setReleaseError(e.response?.data?.error || 'Failed');
        }
        setApproving(false);
    };

    if (!user) return (
        <Shell>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                <p style={{ color: SUB }}>Sign in to access this workspace</p>
                <Link to="/login" style={{ padding: '10px 24px', borderRadius: 99, background: PRIMARY, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Sign In</Link>
            </div>
        </Shell>
    );
    if (loading) return <Shell><div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Loading workspace…</div></Shell>;
    if (!project) return <Shell><div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Workspace not found or access denied.</div></Shell>;

    const canPost = isParticipant && project.status === 'active';

    return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT, overflow: 'hidden' }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <AltHeader />

                {/* ── Header ────────────────────────────────────────────── */}
                <div style={{ padding: '12px 24px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                    <Link to="/preview/alt_f_my_collabs" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: SUB, textDecoration: 'none', fontSize: 12, marginBottom: 8 }}>
                        <ArrowLeft size={13} /> My Collabs
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AvatarCircle profile={project.initiator} size={30} />
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{project.initiator?.displayName || project.initiator?.username}</span>
                        </div>
                        <span style={{ color: SUB, fontSize: 13 }}>×</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AvatarCircle profile={project.collaborator} size={30} />
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{project.collaborator?.displayName || project.collaborator?.username}</span>
                        </div>
                        {project.request?.callout?.title && (
                            <span style={{ fontSize: 13, color: SUB }}>· {project.request.callout.title}</span>
                        )}
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: project.status === 'released' ? `${SECONDARY}22` : `${PRIMARY}22`, color: project.status === 'released' ? SECONDARY : PRIMARY, fontWeight: 700, textTransform: 'uppercase' }}>
                            {project.status}
                        </span>
                        {isParticipant && project.status !== 'released' && (
                            <button onClick={() => setShowRelease(r => !r)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 8, background: showRelease ? `${PRIMARY}18` : 'transparent', border: `1px solid ${showRelease ? PRIMARY + '55' : BORDER}`, color: showRelease ? PRIMARY : SUB, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
                                <CheckCheck size={13} /> Release {showRelease ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Pinned banners ────────────────────────────────────── */}
                {/* Desktop project link */}
                {!project.projectId && isParticipant && myProjects.length > 0 && (
                    <div style={{ padding: '8px 24px', borderBottom: `1px solid ${BORDER}`, background: S_LOWEST, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <Link2 size={13} color={SUB} />
                        <span style={{ fontSize: 12, color: SUB, flex: 1 }}>Link an FL Studio project</span>
                        <select onChange={e => e.target.value && linkProject(e.target.value)} disabled={linking} style={{ background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 8px', color: TEXT, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                            <option value="">Select project…</option>
                            {myProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                )}
                {project.project && (
                    <div style={{ padding: '7px 24px', borderBottom: `1px solid ${BORDER}`, background: `${SECONDARY}08`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <Link2 size={13} color={SECONDARY} />
                        <span style={{ fontSize: 12, color: SECONDARY, fontWeight: 600 }}>Linked: {project.project.name}</span>
                        {project.project.versions?.[0] && <span style={{ fontSize: 11, color: SUB }}>· v{project.project.versions[0].versionNumber} · {timeAgo(project.project.versions[0].createdAt)}</span>}
                        <Link to={`/projects/${project.project.id}`} style={{ marginLeft: 'auto', color: SECONDARY, fontSize: 11, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink size={11} /> View</Link>
                    </div>
                )}
                {project.track && (
                    <div style={{ padding: '8px 24px', borderBottom: `1px solid ${BORDER}`, background: `${PRIMARY}10`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <CheckCircle size={14} color={PRIMARY} />
                        <span style={{ fontSize: 13, color: PRIMARY, fontWeight: 700 }}>{project.track.title}</span>
                        <span style={{ fontSize: 12, color: SUB }}>— upload audio to publish to both profiles</span>
                        <Link to="/my-tracks" style={{ marginLeft: 'auto', fontSize: 12, color: PRIMARY, textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink size={12} /> Manage</Link>
                    </div>
                )}

                {/* ── Release panel ─────────────────────────────────────── */}
                {showRelease && isParticipant && (
                    <div style={{ padding: '14px 24px', borderBottom: `1px solid ${BORDER}`, background: S_LOWEST, flexShrink: 0 }}>
                        {project.status === 'released' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: PRIMARY, fontWeight: 700, fontSize: 14 }}>
                                <CheckCircle size={16} /> Track released!
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                                    <ApprovalStatus label={project.initiator?.displayName || project.initiator?.username} approved={project.initiatorApproved} />
                                    <ApprovalStatus label={project.collaborator?.displayName || project.collaborator?.username} approved={project.collaboratorApproved} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
                                    <input
                                        value={releaseTrackTitle}
                                        onChange={e => setReleaseTrackTitle(e.target.value)}
                                        placeholder={`${project.initiator?.displayName || project.initiator?.username} & ${project.collaborator?.username} — Collab`}
                                        style={{ flex: 1, background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', color: TEXT, fontSize: 13, fontFamily: FONT }}
                                    />
                                    {releaseError && <span style={{ fontSize: 12, color: TERTIARY, flexShrink: 0 }}>{releaseError}</span>}
                                    {!myApproved ? (
                                        <button onClick={approve} disabled={approving} style={{ padding: '9px 18px', borderRadius: 99, background: PRIMARY, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', opacity: approving ? 0.7 : 1, fontFamily: FONT }}>
                                            {approving ? 'Approving…' : 'Approve Release'}
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: 13, color: PRIMARY, fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                            <CheckCircle size={14} /> Waiting for {partner?.displayName || partner?.username}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Feed ──────────────────────────────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {feedItems.length === 0 && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: SUB, gap: 12, paddingBottom: 60 }}>
                            <Activity size={36} color={BORDER} />
                            <span style={{ fontSize: 14 }}>Nothing here yet — share a message, file, or progress update to kick things off.</span>
                        </div>
                    )}
                    {feedItems.map((item, i) => {
                        const author = getItemAuthor(item);
                        const mine   = isMine(item);
                        const prev   = i > 0 ? feedItems[i - 1] : null;
                        const sameRun = prev && (
                            item.kind === 'message' && prev.kind === 'message'
                                ? item.senderId === prev.senderId
                                : item.kind !== 'message' && prev.kind !== 'message' && item.profileId === prev.profileId
                        ) && (new Date(item.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 5 * 60 * 1000;

                        return (
                            <FeedItemRow
                                key={item.id}
                                item={item}
                                author={author}
                                mine={mine}
                                showMeta={!sameRun}
                                canDelete={mine && item.kind === 'file'}
                                onReply={() => { setReplyTo(item); composeRef.current?.focus(); }}
                                onDelete={() => handleDeleteFile(item)}
                            />
                        );
                    })}
                    <div ref={feedBottomRef} />
                </div>

                {/* ── Compose bar ───────────────────────────────────────── */}
                {canPost && (
                    <div style={{ flexShrink: 0, borderTop: `1px solid ${BORDER}`, padding: '10px 20px 14px', background: BG }}>
                        {/* Reply preview */}
                        {replyTo && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, background: S_CONT, borderRadius: 8, padding: '7px 12px', borderLeft: `3px solid ${PRIMARY}` }}>
                                <Reply size={12} color={PRIMARY} style={{ marginTop: 2, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, color: PRIMARY, fontWeight: 700, marginBottom: 2 }}>
                                        Replying to {getItemAuthor(replyTo)?.displayName || getItemAuthor(replyTo)?.username}
                                    </div>
                                    <div style={{ fontSize: 12, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {(replyTo.content || replyTo.label || 'a file').slice(0, 80)}
                                    </div>
                                </div>
                                <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 0, flexShrink: 0 }}><X size={13} /></button>
                            </div>
                        )}
                        {/* File attachment preview */}
                        {attachedFile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: S_CONT, borderRadius: 8, padding: '7px 12px' }}>
                                <Paperclip size={13} color={SECONDARY} />
                                <span style={{ fontSize: 12, color: SECONDARY, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
                                <span style={{ fontSize: 11, color: SUB, flexShrink: 0 }}>{Math.round(attachedFile.size / 1024)} KB</span>
                                <button onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 0, flexShrink: 0 }}><X size={13} /></button>
                            </div>
                        )}
                        {/* Input row */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                            {/* Kind toggle */}
                            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}`, flexShrink: 0 }}>
                                <button onClick={() => setPostKind('message')} style={{ padding: '8px 12px', background: postKind === 'message' ? S_HIGH : 'transparent', border: 'none', color: postKind === 'message' ? TEXT : SUB, fontWeight: postKind === 'message' ? 700 : 400, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                                    Message
                                </button>
                                <button onClick={() => setPostKind('update')} style={{ padding: '8px 12px', background: postKind === 'update' ? `${PRIMARY}22` : 'transparent', border: 'none', color: postKind === 'update' ? PRIMARY : SUB, fontWeight: postKind === 'update' ? 700 : 400, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                                    Update
                                </button>
                            </div>
                            {/* Text area */}
                            <textarea
                                ref={composeRef}
                                value={composeText}
                                onChange={e => setComposeText(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey && !attachedFile) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={
                                    attachedFile ? 'Add a caption… (optional)'
                                    : postKind === 'update' ? 'Share a progress update…'
                                    : 'Message… (Enter to send, Shift+Enter for newline)'
                                }
                                rows={2}
                                style={{ flex: 1, background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14, resize: 'none', fontFamily: FONT, lineHeight: 1.5 }}
                            />
                            {/* Attach */}
                            <button onClick={() => fileInputRef.current?.click()} title="Attach file" style={{ padding: '10px 12px', borderRadius: 8, background: attachedFile ? `${SECONDARY}22` : S_CONT, border: `1px solid ${attachedFile ? SECONDARY + '88' : BORDER}`, color: attachedFile ? SECONDARY : SUB, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                <Paperclip size={16} />
                            </button>
                            <input ref={fileInputRef} type="file" accept="audio/*,image/*,.flp,.zip,.pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setAttachedFile(f); e.target.value = ''; }} />
                            {/* Send */}
                            <button onClick={handleSend} disabled={sending || uploading || (!composeText.trim() && !attachedFile)} style={{ padding: '10px 14px', borderRadius: 8, background: PRIMARY, border: 'none', color: '#fff', cursor: 'pointer', opacity: (sending || uploading || (!composeText.trim() && !attachedFile)) ? 0.4 : 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                {(sending || uploading) ? <Clock size={16} /> : <Send size={16} />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
