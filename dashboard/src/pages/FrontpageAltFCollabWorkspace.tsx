/**
 * Alt F — Collab Project Workspace
 * Private collaboration space: progress updates, file sharing,
 * embedded chat, desktop project link, joint release flow.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AltSidebar, BG, S_LOWEST, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { useAuth } from '../components/AuthProvider';
import { ArrowLeft, MessageSquare, FileUp, Activity, Link2, CheckCircle, Clock, Trash2, Download, Music, Image, File, Send, CheckCheck, AlertTriangle, ExternalLink } from 'lucide-react';

type Tab = 'updates' | 'files' | 'chat' | 'release';

function timeAgo(d: string) {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

function fileIcon(type: string) {
    if (type === 'audio') return <Music size={16} color={PRIMARY} />;
    if (type === 'image') return <Image size={16} color={SECONDARY} />;
    return <File size={16} color={SUB} />;
}

export default function FrontpageAltFCollabWorkspace() {
    const { search } = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const id = new URLSearchParams(search).get('id') || '';

    const [project, setProject] = useState<any>(null);
    const [myProfile, setMyProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('updates');

    // Updates
    const [updateText, setUpdateText] = useState('');
    const [postingUpdate, setPostingUpdate] = useState(false);

    // Files
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [fileLabel, setFileLabel] = useState('');

    // Chat
    const [messages, setMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    // Desktop project link
    const [myProjects, setMyProjects] = useState<any[]>([]);
    const [linking, setLinking] = useState(false);

    // Release
    const [releaseTrackTitle, setReleaseTrackTitle] = useState('');
    const [approving, setApproving] = useState(false);
    const [releaseError, setReleaseError] = useState('');

    const isInitiator = project && myProfile && project.initiatorProfileId === myProfile.id;
    const isCollaborator = project && myProfile && project.collaboratorProfileId === myProfile.id;
    const myApproved = project && (isInitiator ? project.initiatorApproved : project.collaboratorApproved);
    const theirApproved = project && (isInitiator ? project.collaboratorApproved : project.initiatorApproved);
    const partner = project && (isInitiator ? project.collaborator : project.initiator);

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
                setProject(projRes.data);
                setMyProfile(profileRes.data);
                // Load chat if conversation exists
                if (projRes.data.conversationId) {
                    const msgRes = await axios.get(`/api/messages/conversations/${projRes.data.conversationId}/messages`, { withCredentials: true });
                    setMessages(msgRes.data?.messages || []);
                }
                // Load user's desktop projects for linking
                const projsRes = await axios.get('/api/projects', { withCredentials: true }).catch(() => null);
                if (projsRes?.data) setMyProjects(Array.isArray(projsRes.data) ? projsRes.data : projsRes.data.projects || []);
            } catch { /* not a participant */ }
            setLoading(false);
        };
        load();
    }, [id, user]);

    useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const postUpdate = async () => {
        if (!updateText.trim()) return;
        setPostingUpdate(true);
        try {
            const { data } = await axios.post(`/api/collab/projects/${id}/updates`, { content: updateText }, { withCredentials: true });
            setProject((p: any) => ({ ...p, updates: [data, ...(p.updates || [])] }));
            setUpdateText('');
        } catch { /* ignore */ }
        setPostingUpdate(false);
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        const fd = new FormData();
        fd.append('collabFile', file);
        fd.append('label', fileLabel || file.name);
        try {
            const { data } = await axios.post(`/api/collab/projects/${id}/files`, fd, { withCredentials: true });
            setProject((p: any) => ({ ...p, files: [data, ...(p.files || [])] }));
            setFileLabel('');
        } catch { /* ignore */ }
        setUploading(false);
    };

    const deleteFile = async (fileId: string) => {
        try {
            await axios.delete(`/api/collab/projects/${id}/files/${fileId}`, { withCredentials: true });
            setProject((p: any) => ({ ...p, files: (p.files || []).filter((f: any) => f.id !== fileId) }));
        } catch { /* ignore */ }
    };

    const sendMessage = async () => {
        if (!chatInput.trim() || !project?.conversationId) return;
        setSendingMsg(true);
        try {
            const { data } = await axios.post(`/api/messages/conversations/${project.conversationId}/messages`, { content: chatInput }, { withCredentials: true });
            setMessages(prev => [...prev, data]);
            setChatInput('');
        } catch { /* ignore */ }
        setSendingMsg(false);
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
            if (data.released && data.track) {
                navigate(`/preview/alt_f_track?id=${data.track.id}`);
            }
        } catch (e: any) {
            setReleaseError(e.response?.data?.error || 'Failed');
        }
        setApproving(false);
    };

    if (!user) return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                <p style={{ color: SUB }}>Sign in to access this workspace</p>
                <Link to="/login" style={{ padding: '10px 24px', borderRadius: 99, background: PRIMARY, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Sign In</Link>
            </div>
        </div>
    );

    if (loading) return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Loading workspace…</div>
        </div>
    );

    if (!project) return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>Workspace not found or you don't have access.</div>
        </div>
    );

    const TABS: { id: Tab; icon: React.ReactNode; label: string }[] = [
        { id: 'updates', icon: <Activity size={15} />, label: 'Updates' },
        { id: 'files', icon: <FileUp size={15} />, label: 'Files' },
        { id: 'chat', icon: <MessageSquare size={15} />, label: 'Chat' },
        { id: 'release', icon: <CheckCheck size={15} />, label: 'Release' },
    ];

    return (
        <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: FONT, color: TEXT, overflow: 'hidden' }}>
            <AltSidebar active="Collabs" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <AltHeader />
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

                    <Link to="/preview/alt_f_my_collabs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: SUB, textDecoration: 'none', fontSize: 13, marginBottom: 20 }}>
                        <ArrowLeft size={14} /> My Collabs
                    </Link>

                    {/* Workspace header */}
                    <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: SUB, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Collab Workspace</div>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{project.request?.callout?.title}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 13 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: S_HIGH }}>
                                        {project.initiator?.avatar && <img src={project.initiator.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    </div>
                                    <span style={{ color: TEXT }}>{project.initiator?.displayName || project.initiator?.username}</span>
                                </div>
                                <span style={{ color: SUB }}>×</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: S_HIGH }}>
                                        {project.collaborator?.avatar && <img src={project.collaborator.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    </div>
                                    <span style={{ color: TEXT }}>{project.collaborator?.displayName || project.collaborator?.username}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 99, background: project.status === 'released' ? `${SECONDARY}22` : `${PRIMARY}22`, color: project.status === 'released' ? SECONDARY : PRIMARY, fontWeight: 700 }}>
                                {project.status}
                            </span>
                        </div>
                    </div>

                    {/* Desktop project link */}
                    {!project.projectId && (isInitiator || isCollaborator) && myProjects.length > 0 && (
                        <div style={{ background: S_CONT, border: `1px dashed ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <Link2 size={16} color={SUB} />
                            <span style={{ fontSize: 13, color: SUB, flex: 1 }}>Link an FL Studio project from your desktop app</span>
                            <select onChange={e => e.target.value && linkProject(e.target.value)} disabled={linking} style={{ background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', color: TEXT, fontSize: 13, cursor: 'pointer' }}>
                                <option value="">Select project…</option>
                                {myProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}
                    {project.project && (
                        <div style={{ background: `${SECONDARY}11`, border: `1px solid ${SECONDARY}33`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Link2 size={15} color={SECONDARY} />
                            <span style={{ fontSize: 13, color: SECONDARY, fontWeight: 600 }}>Linked: {project.project.name}</span>
                            {project.project.versions?.[0] && (
                                <span style={{ fontSize: 12, color: SUB, marginLeft: 'auto' }}>v{project.project.versions[0].versionNumber} · {timeAgo(project.project.versions[0].createdAt)}</span>
                            )}
                            <Link to={`/projects/${project.project.id}`} style={{ color: SECONDARY, textDecoration: 'none', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ExternalLink size={12} /> View
                            </Link>
                        </div>
                    )}

                    {/* Released track banner */}
                    {project.track && (
                        <div style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}44`, borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <CheckCircle size={18} color={PRIMARY} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: PRIMARY }}>Track Created: {project.track.title}</div>
                                <div style={{ fontSize: 12, color: SUB }}>Upload your audio file to publish it to both profiles</div>
                            </div>
                            <Link to={`/my-tracks`} style={{ fontSize: 13, color: PRIMARY, textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ExternalLink size={13} /> Manage Track
                            </Link>
                        </div>
                    )}

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: S_CONT, borderRadius: 10, padding: 4, width: 'fit-content' }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 7, border: 'none', background: tab === t.id ? S_HIGH : 'transparent', color: tab === t.id ? TEXT : SUB, fontWeight: tab === t.id ? 700 : 400, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Updates tab */}
                    {tab === 'updates' && (
                        <div>
                            {(isInitiator || isCollaborator) && project.status === 'active' && (
                                <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                                    <textarea value={updateText} onChange={e => setUpdateText(e.target.value)} placeholder="Share a progress update with your collaborator…" rows={3} style={{ width: '100%', background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 13px', color: TEXT, fontSize: 13, resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box', marginBottom: 10 }} />
                                    <button onClick={postUpdate} disabled={postingUpdate || !updateText.trim()} style={{ padding: '9px 20px', borderRadius: 99, background: PRIMARY, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (!updateText.trim() || postingUpdate) ? 0.5 : 1 }}>
                                        {postingUpdate ? 'Posting…' : 'Post Update'}
                                    </button>
                                </div>
                            )}
                            {(project.updates || []).length === 0 ? (
                                <p style={{ color: SUB, fontSize: 14 }}>No updates yet. Share your progress!</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {(project.updates || []).map((u: any) => {
                                        const author = u.authorId === project.initiatorProfileId ? project.initiator : project.collaborator;
                                        return (
                                            <div key={u.id} style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: S_HIGH }}>
                                                        {author?.avatar && <img src={author.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: 13 }}>{author?.displayName || author?.username}</span>
                                                    <span style={{ color: SUB, fontSize: 12, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{timeAgo(u.createdAt)}</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{u.content}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Files tab */}
                    {tab === 'files' && (
                        <div>
                            {(isInitiator || isCollaborator) && project.status === 'active' && (
                                <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                        <input value={fileLabel} onChange={e => setFileLabel(e.target.value)} placeholder="File label (optional)" style={{ flex: 1, background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 13px', color: TEXT, fontSize: 13 }} />
                                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: PRIMARY, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
                                            <FileUp size={15} /> {uploading ? 'Uploading…' : 'Upload File'}
                                        </button>
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="audio/*,image/*,.flp,.zip,.pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
                                    <p style={{ margin: 0, fontSize: 11, color: SUB }}>Supported: audio, images, .flp, .zip — max 50 MB</p>
                                </div>
                            )}
                            {(project.files || []).length === 0 ? (
                                <p style={{ color: SUB, fontSize: 14 }}>No files shared yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {(project.files || []).map((f: any) => (
                                        <div key={f.id} style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {fileIcon(f.fileType)}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</div>
                                                <div style={{ fontSize: 11, color: SUB }}>{f.fileType} · {Math.round(f.sizeBytes / 1024)} KB · {timeAgo(f.createdAt)}</div>
                                            </div>
                                            <a href={f.url} download target="_blank" rel="noopener noreferrer" style={{ color: SUB, textDecoration: 'none', padding: 6 }}><Download size={15} /></a>
                                            {f.uploaderId === myProfile?.id && (
                                                <button onClick={() => deleteFile(f.id)} style={{ background: 'none', border: 'none', color: TERTIARY, cursor: 'pointer', padding: 6, opacity: 0.7 }}><Trash2 size={15} /></button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Chat tab */}
                    {tab === 'chat' && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: 480 }}>
                            {!project.conversationId ? (
                                <p style={{ color: SUB, fontSize: 14 }}>No conversation linked to this workspace.</p>
                            ) : (
                                <>
                                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
                                        {messages.length === 0 && <p style={{ color: SUB, fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No messages yet. Say hello!</p>}
                                        {messages.map((m: any) => {
                                            const myUserIds = myProfile ? [myProfile.userId, myProfile.id] : [];
                                            const isMine = myUserIds.includes(m.senderId);
                                            return (
                                                <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                                                    <div style={{ maxWidth: '70%', background: isMine ? PRIMARY : S_CONT, border: `1px solid ${isMine ? 'transparent' : BORDER}`, borderRadius: 12, padding: '10px 14px' }}>
                                                        <div style={{ fontSize: 14, color: isMine ? '#fff' : TEXT, lineHeight: 1.5 }}>{m.content}</div>
                                                        <div style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.6)' : SUB, marginTop: 4 }}>{timeAgo(m.createdAt)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={chatBottomRef} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                                        <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder="Type a message…" style={{ flex: 1, background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', color: TEXT, fontSize: 14 }} />
                                        <button onClick={sendMessage} disabled={sendingMsg || !chatInput.trim()} style={{ padding: '10px 14px', borderRadius: 8, background: PRIMARY, border: 'none', color: '#fff', cursor: 'pointer', opacity: (!chatInput.trim() || sendingMsg) ? 0.5 : 1 }}>
                                            <Send size={16} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Release tab */}
                    {tab === 'release' && (
                        <div style={{ maxWidth: 520 }}>
                            {project.status === 'released' ? (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <CheckCircle size={48} color={PRIMARY} style={{ margin: '0 auto 16px', display: 'block' }} />
                                    <h3 style={{ margin: '0 0 8px' }}>Track Released!</h3>
                                    <p style={{ color: SUB, marginBottom: 20 }}>Your collab track has been created on both profiles. Upload the audio to publish it.</p>
                                    {project.track && (
                                        <Link to="/my-tracks" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 24px', borderRadius: 99, background: PRIMARY, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
                                            <ExternalLink size={15} /> Manage Track
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div style={{ background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                            <AlertTriangle size={16} color={PRIMARY} />
                                            <span style={{ fontWeight: 700, fontSize: 14 }}>Joint Release</span>
                                        </div>
                                        <p style={{ fontSize: 13, color: SUB, margin: '0 0 16px', lineHeight: 1.6 }}>
                                            Both collaborators must approve before the track is created. Once approved, a draft track will appear on both profiles — you'll upload the final audio separately.
                                        </p>
                                        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                                            <ApprovalStatus label={project.initiator?.displayName || project.initiator?.username} approved={project.initiatorApproved} />
                                            <ApprovalStatus label={project.collaborator?.displayName || project.collaborator?.username} approved={project.collaboratorApproved} />
                                        </div>
                                        <label style={{ display: 'block', fontSize: 12, color: SUB, fontWeight: 600, marginBottom: 6 }}>TRACK TITLE</label>
                                        <input value={releaseTrackTitle} onChange={e => setReleaseTrackTitle(e.target.value)} placeholder={`${project.initiator?.displayName || project.initiator?.username} & ${project.collaborator?.username} - Collab`} style={{ width: '100%', background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 13px', color: TEXT, fontSize: 13, boxSizing: 'border-box', marginBottom: 16 }} />
                                        {releaseError && <div style={{ color: TERTIARY, fontSize: 13, marginBottom: 10 }}>{releaseError}</div>}
                                        {!myApproved ? (
                                            <button onClick={approve} disabled={approving} style={{ padding: '11px 24px', borderRadius: 99, background: PRIMARY, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: approving ? 'not-allowed' : 'pointer', opacity: approving ? 0.7 : 1 }}>
                                                {approving ? 'Approving…' : 'Approve Release'}
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: PRIMARY, fontSize: 14, fontWeight: 600 }}>
                                                <CheckCircle size={16} /> You've approved. Waiting for {partner?.displayName || partner?.username}…
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ApprovalStatus({ label, approved }: { label: string; approved: boolean }) {
    return (
        <div style={{ flex: 1, background: approved ? `${PRIMARY}15` : S_HIGH, border: `1px solid ${approved ? PRIMARY + '44' : BORDER}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {approved ? <CheckCircle size={16} color={PRIMARY} /> : <Clock size={16} color={SUB} />}
            <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: approved ? PRIMARY : TEXT }}>{label}</div>
                <div style={{ fontSize: 11, color: SUB }}>{approved ? 'Approved' : 'Pending'}</div>
            </div>
        </div>
    );
}
