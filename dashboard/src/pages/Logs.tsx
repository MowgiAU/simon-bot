import React, { useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useMobile } from '../hooks/useMobile';
import { showToast } from '../components/Toast';
import { 
  ShieldAlert, 
  Bot, 
  UserCog, 
  MessageSquareX, 
  Coins, 
  Link, 
  Skull, 
  AlertTriangle,
  Search,
  Menu,
  X,
  MessageSquare,
  Filter,
  XCircle,
  Hash,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  Users,
  Plus,
  Music,
  MessageCircle,
  Heart,
  ListMusic
} from 'lucide-react';

interface LogComment {
  id: string;
  userId: string;
  username?: string;
  content: string;
  createdAt: string;
}

interface UserNote {
  id: string;
  userId: string;
  adminId: string;
  content: string;
  createdAt: string;
}

interface TrackedUser {
  userId: string;
  username?: string;
  noteCount: number;
  lastNoteAt: string;
}

interface ActionLog {
  id: string;
  pluginId: string;
  action: string;
  executorId: string | null;
  executorName?: string;
  targetId: string | null;
  targetName?: string;
  details: any;
  createdAt: string;
  comments: LogComment[];
}

const CATEGORIES = [
  { id: 'all', label: 'All Logs', icon: <Search size={16} /> },
  { id: 'MOD', label: 'Moderation', icon: <ShieldAlert size={16} /> },
  { id: 'AUTOMOD', label: 'AutoMod', icon: <Bot size={16} /> },
  { id: 'ROLE', label: 'Roles', icon: <UserCog size={16} /> },
  { id: 'PROFANITY', label: 'Profanity', icon: <MessageSquareX size={16} /> },
  { id: 'CURRENCY', label: 'Currency', icon: <Coins size={16} /> },
  { id: 'LINK', label: 'Links', icon: <Link size={16} /> },
  { id: 'PIRACY', label: 'Piracy', icon: <Skull size={16} /> },
  { id: 'ERROR', label: 'Errors', icon: <AlertTriangle size={16} /> },
  { id: 'PROFILES', label: 'Profiles', icon: <Music size={16} /> },
  { id: 'COMMENTS', label: 'Comments', icon: <MessageCircle size={16} /> },
  { id: 'SOCIAL', label: 'Social', icon: <Heart size={16} /> },
  { id: 'PLAYLISTS', label: 'Playlists', icon: <ListMusic size={16} /> },
];

const ACTION_CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  // Profiles
  track_uploaded:           { label: 'Profiles',    color: '#818CF8' },
  track_edited:             { label: 'Profiles',    color: '#818CF8' },
  track_deleted:            { label: 'Profiles',    color: '#818CF8' },
  track_status_changed:     { label: 'Profiles',    color: '#818CF8' },
  profile_updated:          { label: 'Profiles',    color: '#818CF8' },
  profile_admin_edited:     { label: 'Profiles',    color: '#818CF8' },
  profile_status_changed:   { label: 'Profiles',    color: '#818CF8' },
  profile_wiped:            { label: 'Profiles',    color: '#818CF8' },
  avatar_uploaded:          { label: 'Profiles',    color: '#818CF8' },
  avatar_admin_uploaded:    { label: 'Profiles',    color: '#818CF8' },
  battle_created:           { label: 'Profiles',    color: '#818CF8' },
  battle_updated:           { label: 'Profiles',    color: '#818CF8' },
  battle_deleted:           { label: 'Profiles',    color: '#818CF8' },
  FEEDBACK_THREAD_CREATED:  { label: 'Profiles',    color: '#818CF8' },
  FEEDBACK_APPROVED:        { label: 'Profiles',    color: '#818CF8' },
  // Comments
  comment_created:          { label: 'Comments',   color: '#60A5FA' },
  comment_replied:          { label: 'Comments',   color: '#60A5FA' },
  comment_reacted:          { label: 'Comments',   color: '#60A5FA' },
  comment_reaction_removed: { label: 'Comments',   color: '#60A5FA' },
  comment_edited:           { label: 'Comments',   color: '#60A5FA' },
  comment_deleted:          { label: 'Comments',   color: '#60A5FA' },
  // Social
  track_favourited:         { label: 'Social',     color: '#F87171' },
  track_unfavourited:       { label: 'Social',     color: '#F87171' },
  track_reposted:           { label: 'Social',     color: '#34D399' },
  track_unreposted:         { label: 'Social',     color: '#34D399' },
  artist_followed:          { label: 'Social',     color: '#34D399' },
  artist_unfollowed:        { label: 'Social',     color: '#34D399' },
  // Playlists
  playlist_created:         { label: 'Playlists',  color: '#FBBF24' },
  playlist_deleted:         { label: 'Playlists',  color: '#FBBF24' },
  playlist_track_added:     { label: 'Playlists',  color: '#FBBF24' },
  playlist_track_removed:   { label: 'Playlists',  color: '#FBBF24' },
  // Mod
  ban:                      { label: 'Mod',        color: '#F87171' },
  kick:                     { label: 'Mod',        color: '#FB923C' },
  timeout:                  { label: 'Mod',        color: '#FBBF24' },
  unban:                    { label: 'Mod',        color: '#34D399' },
  warn:                     { label: 'Mod',        color: '#FBBF24' },
  softban:                  { label: 'Mod',        color: '#F87171' },
  purge:                    { label: 'Mod',        color: '#FB923C' },
  // AutoMod
  message_filtered:         { label: 'AutoMod',   color: '#A78BFA' },
  automod_block:            { label: 'AutoMod',   color: '#A78BFA' },
  // Currency
  item_bought:              { label: 'Currency',  color: '#FBBF24' },
  transaction:              { label: 'Currency',  color: '#FBBF24' },
  // Studio Guide
  STUDIO_GUIDE_AUTO_RESPONSE: { label: 'Studio Guide', color: '#A78BFA' },
};

const getCategoryBadge = (action: string): { label: string; color: string } => {
  return ACTION_CATEGORY_MAP[action] || { label: action, color: '#6B7280' };
};

interface LogsProps {
  guildId: string;
  searchParam?: string;
}

export const Logs: React.FC<LogsProps> = ({ guildId, searchParam }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'users'>('logs');
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Tracked Users State
  const [trackedUsers, setTrackedUsers] = useState<TrackedUser[]>([]);
  const [loadingTracked, setLoadingTracked] = useState(false);
  const [newUserToTrack, setNewUserToTrack] = useState('');
  
  // Filters
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeUser, setActiveUser] = useState<string | null>(searchParam || null);
  
  // Comments Interaction
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (searchParam) {
      setActiveUser(searchParam);
    }
  }, [searchParam]);
  
  // User Notes Interaction
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  
  // Responsive state
  const isMobile = useMobile();
  const [showFilters, setShowFilters] = useState(false);
  const [isCompact, setIsCompact] = useState(window.innerWidth < 1200 && window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth < 1200 && window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch logs when page or filters change (debounced)
  useEffect(() => {
    if (activeTab !== 'logs') return;

    const controller = new AbortController();
    let isMounted = true;

    const timer = setTimeout(() => {
        const fetchLogsInner = async (pageNum: number) => {
            try {
              setLoading(true);
              const queryParams = new URLSearchParams({
                page: pageNum.toString(),
                limit: '20',
                ...(activeCategory !== 'all' && { action: activeCategory }),
                ...(searchQuery && { search: searchQuery }),
                ...(activeUser && { userId: activeUser })
              });
              const res = await fetch(`/api/guilds/${guildId}/logs?${queryParams}`, {
                signal: controller.signal,
                credentials: 'include'
              });
              if (res.ok) {
                const data = await res.json();
                if (isMounted) {
                    setLogs(data.items); 
                    setTotalPages(data.pagination.pages);
                    // Crucial: Only set loading false IF we successfully got data
                    setLoading(false);
                }
              }
            } catch (err: any) {
                if (err.name !== 'AbortError' && isMounted) {
                    console.error("Failed to fetch logs:", err);
                    setLoading(false);
                }
            }
          };
      fetchLogsInner(page);
    }, 500);
    return () => {
        isMounted = false;
        clearTimeout(timer);
        controller.abort();
    };
  }, [page, activeCategory, searchQuery, activeUser, activeTab, guildId]);

  const fetchUserNotes = async (userId: string) => {
      try {
          setLoadingNotes(true);
          const res = await fetch(`/api/guilds/${guildId}/users/${userId}/notes`, { credentials: 'include' });
          if (res.ok) {
              const data = await res.json();
              setUserNotes(data);
          }
      } catch (err) {
          console.error("Failed to fetch notes", err);
      } finally {
          setLoadingNotes(false);
      }
  };

  const fetchTrackedUsers = async () => {
    try {
        setLoadingTracked(true);
        const res = await fetch(`/api/guilds/${guildId}/tracked-users`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            setTrackedUsers(data);
        }
    } catch (err) {
        console.error("Failed to fetch tracked users", err);
    } finally {
        setLoadingTracked(false);
    }
  };

  useEffect(() => {
     // Fetch tracked users immediately to populate list even if in Logs tab
     fetchTrackedUsers();
  }, []);

  const [trackingLoading, setTrackingLoading] = useState(false);

  const trackUser = async (userIdToTrack: string) => {
    if (!userIdToTrack.trim()) return;
    setTrackingLoading(true);
    
    try {
        const res = await fetch(`/api/guilds/${guildId}/users/${userIdToTrack.trim()}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Manual tracking started.' }),
            credentials: 'include'
        });
        
        if (res.ok) {
            await fetchTrackedUsers();
            if (newUserToTrack === userIdToTrack) setNewUserToTrack('');
            // Optional: Show toast success
        } else {
            const err = await res.json();
            showToast(`Failed to track user: ${err.error || 'Unknown error'}`, 'error');
        }
    } catch (e) {
        console.error("Failed to track user", e);
        showToast('Failed to track user. Check console.', 'error');
    } finally {
        setTrackingLoading(false);
    }
  };
    
  const handleTrackNewUser = () => trackUser(newUserToTrack);

  // Switch to logs tab and filter by user when clicking a tracked user
  const handleUserClick = (userId: string) => {
      setActiveUser(userId);
      setActiveTab('logs');
  };
  
  // When tab changes, fetch data if needed
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    if (activeTab === 'users') {
        const fetchTrackedUsersInner = async () => {
            try {
                setLoadingTracked(true);
                const res = await fetch(`/api/guilds/${guildId}/tracked-users`, { credentials: 'include', signal: controller.signal });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setTrackedUsers(data);
                }
            } catch (err: any) {
                if (err.name !== 'AbortError' && isMounted) console.error("Failed to fetch tracked users", err);
            } finally {
                if (isMounted) setLoadingTracked(false);
            }
          };
        fetchTrackedUsersInner();
    }

    return () => {
        isMounted = false;
        controller.abort();
    };
  }, [activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    if (activeUser) {
        setShowNotes(true);
        const fetchUserNotesInner = async (userId: string) => {
            try {
                setLoadingNotes(true);
                const res = await fetch(`/api/guilds/${guildId}/users/${userId}/notes`, { credentials: 'include', signal: controller.signal });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setUserNotes(data);
                }
            } catch (err: any) {
                if (err.name !== 'AbortError' && isMounted) console.error("Failed to fetch notes", err);
            } finally {
                if (isMounted) setLoadingNotes(false);
            }
        };
        fetchUserNotesInner(activeUser);
    } else {
        setShowNotes(false);
        setUserNotes([]);
    }

    return () => {
        isMounted = false;
        controller.abort();
    };
  }, [activeUser]);

  const handleAddUserNote = async () => {
      if (!noteInput.trim() || !activeUser) return;
      setSubmittingNote(true);
      try {
          const res = await fetch(`/api/guilds/${guildId}/users/${activeUser}/notes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: noteInput }),
              credentials: 'include'
          });
          if (res.ok) {
              const newNote = await res.json();
              setUserNotes(prev => [newNote, ...prev]);
              setNoteInput('');
          }
      } catch (e) {
          console.error("Failed to add user note", e);
      } finally {
          setSubmittingNote(false);
      }
  };

  const handleAddComment = async (logId: string) => {
      if (!commentInput.trim()) return;
      setSubmittingComment(true);
      try {
          const res = await fetch(`/api/logs/${logId}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: commentInput }),
              credentials: 'include'
          });
          if (res.ok) {
              const newComment = await res.json();
              setLogs(prev => prev.map(log => {
                  if (log.id === logId) {
                      return { ...log, comments: [...(log.comments || []), newComment] };
                  }
                  return log;
              }));
              setCommentInput('');
          }
      } catch (e) {
          console.error("Failed to add comment", e);
      } finally {
          setSubmittingComment(false);
      }
  };

  const UserBadge = ({ userId, name, type }: { userId: string, name?: string, type: 'exec' | 'target' }) => (
      <div 
        onClick={(e) => { e.stopPropagation(); setActiveUser(userId); setActiveTab('logs'); }}
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            background: activeUser === userId ? colors.highlight : 'rgba(255,255,255,0.05)',
            border: `1px solid ${activeUser === userId ? colors.highlight : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 4,
            fontSize: '11px',
            color: activeUser === userId ? '#FFF' : colors.textSecondary,
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginRight: 4,
            maxWidth: '100%'
        }}
        title={`Filter by this user (${type})`}
      >
        <Hash size={10} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {type === 'exec' ? 'By: ' : 'To: '}
            {name ? name : userId.slice(0, 8) + '...'}
        </span>
      </div>
  );

  return (
    <div style={{ 
        padding: isMobile ? '16px' : '24px', 
        height: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? '8px' : '0' }}>
          <ShieldAlert size={isMobile ? 24 : 32} color={colors.primary} style={{ marginRight: '16px' }} />
          <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '28px' }}>Audit Logs</h1>
        </div>
        {!isMobile && (
          <div style={{ marginLeft: '16px' }}>
            <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Review moderation actions, tracked users, and system events.</p>
          </div>
        )}
      </div>
      {isMobile && <p style={{ margin: '0 0 12px', color: colors.textSecondary, flexShrink: 0 }}>Review moderation actions, tracked users, and system events.</p>}

      {/* Explanation Block */}
      <div className="settings-explanation" style={{ background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9))', border: '1px solid #3E455633', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, borderLeft: `4px solid ${colors.primary}`, flexShrink: 0 }}>
        <p style={{ margin: 0, color: colors.textPrimary, fontSize: isMobile ? '13px' : '14px', lineHeight: '1.5' }}>
          View and search all moderation actions, AutoMod events, and system logs. Click any log entry to add comments or review details. Use the filter sidebar to narrow results by category.
        </p>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: spacing.lg, 
        flex: 1,
        flexDirection: isMobile ? 'column' : 'row',
        position: 'relative',
        minHeight: 0
      }}>
      {/* Mobile Filter Toggle */}
      {isMobile && activeTab === 'logs' && (
        <button 
            onClick={() => setShowFilters(!showFilters)}
            style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                padding: '10px',
                borderRadius: 8,
                color: colors.textPrimary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: spacing.xs,
                cursor: 'pointer'
            }}
        >
            {showFilters ? <X size={18} /> : <Filter size={18} />}
            {showFilters ? 'Close Filters' : 'Filters'}
        </button>
      )}

      {/* Filters Sidebar - Only show in Logs tab */}
      {activeTab === 'logs' && (
      <div style={{ 
        width: isMobile ? '100%' : (isCompact ? '60px' : '240px'), 
        flexShrink: 0, 
        background: colors.surface, 
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        padding: isCompact && !isMobile ? spacing.sm : spacing.md,
        display: (isMobile && !showFilters) ? 'none' : 'block',
        transition: 'width 0.2s ease-in-out',
        ...(isMobile ? {
            position: 'absolute',
            zIndex: 10,
            top: 60,
            left: 0,
            right: 0,
            bottom: 0,
            height: 'auto',
            width: 'auto',
            margin: spacing.md
        } : {})
      }}>
        {!isCompact && (
            <h3 style={{ color: colors.textPrimary, marginTop: 0, marginBottom: spacing.md, fontSize: '14px', textTransform: 'uppercase' }}>
                Categories
            </h3>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: isCompact && !isMobile ? 'center' : 'stretch' }}>
            {CATEGORIES.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => {
                        setActiveCategory(cat.id);
                        setPage(1);
                        if (isMobile) setShowFilters(false);
                    }}
                    title={cat.label}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px',
                        justifyContent: isCompact && !isMobile ? 'center' : 'flex-start',
                        background: activeCategory === cat.id ? colors.highlight : 'transparent',
                        color: activeCategory === cat.id ? '#FFF' : colors.textSecondary,
                        border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                        fontSize: '13px', fontWeight: activeCategory === cat.id ? 600 : 400
                    }}
                >
                    {cat.icon}
                    {(!isCompact || isMobile) && cat.label}
                </button>
            ))}
        </div>
      </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 16, marginBottom: spacing.md, borderBottom: `1px solid ${colors.border}`, paddingBottom: 0 }}>
             <button
                onClick={() => setActiveTab('logs')}
                style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === 'logs' ? colors.highlight : 'transparent'}`,
                    padding: '8px 16px',
                    color: activeTab === 'logs' ? colors.highlight : colors.textSecondary,
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8
                }}
             >
                 <ShieldAlert size={16} /> Audit Logs
             </button>
             <button
                onClick={() => setActiveTab('users')}
                style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === 'users' ? colors.highlight : 'transparent'}`,
                    padding: '8px 16px',
                    color: activeTab === 'users' ? colors.highlight : colors.textSecondary,
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8
                }}
             >
                 <Users size={16} /> Tracked Users
             </button>
        </div>

        {activeTab === 'logs' ? (
        <>
            <div style={{ marginBottom: spacing.md }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: spacing.sm }}>
                <div style={{ position: 'relative', width: isMobile ? '160px' : 'auto' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: colors.textTertiary }} />
                    <input 
                        type="text" 
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            background: colors.surface,
                            border: `1px solid ${colors.border}`,
                            color: colors.textPrimary,
                            padding: '8px 12px 8px 36px',
                            borderRadius: 4,
                            width: '100%',
                            maxWidth: '300px',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>
            </div>
            
            {/* Active Filter Chips & User Notes Section */}
            {activeUser && (
                <div style={{ 
                    background: 'rgba(255, 159, 28, 0.1)', 
                    border: `1px solid ${colors.highlight}`,
                    borderRadius: 8,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: colors.highlight }}>Filtered User: {activeUser}</span>
                                <XCircle 
                                    size={16} 
                                    style={{ cursor: 'pointer', color: colors.textSecondary }} 
                                    onClick={() => setActiveUser(null)} 
                                    title="Clear Filter"
                                />
                            </div>
                            
                            {/* Track User Button in Filter Area */}
                            {!trackedUsers.some(u => u.userId === activeUser) && (
                                <button
                                    onClick={() => trackUser(activeUser)}
                                    disabled={trackingLoading}
                                    style={{
                                        background: 'transparent',
                                        border: `1px solid ${colors.highlight}`,
                                        color: colors.highlight,
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4
                                    }}
                                >
                                    {trackingLoading ? 'Tracking...' : <><Plus size={12} /> Track User</>}
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: colors.textSecondary }}>
                            <StickyNote size={14} />
                            {userNotes.length} Note{userNotes.length !== 1 ? 's' : ''}
                        </div>
                    </div>

                    {/* Notes List */}
                    {userNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '150px', overflowY: 'auto' }}>
                            {userNotes.map(note => (
                                <div key={note.id} style={{ 
                                    background: colors.surface, padding: 8, borderRadius: 4, border: `1px solid ${colors.border}` 
                                }}>
                                    <div style={{ fontSize: '13px', color: colors.textPrimary }}>{note.content}</div>
                                    <div style={{ fontSize: '10px', color: colors.textTertiary, marginTop: 4 }}>
                                        Admin: {note.adminId.slice(0,8)}... • {new Date(note.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Note Input */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input 
                            type="text" 
                            placeholder="Add a persistent note for this user..."
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddUserNote()}
                            style={{
                                flex: 1, background: colors.surface, border: `1px solid ${colors.border}`,
                                color: colors.textPrimary, padding: '8px', borderRadius: 4, fontSize: '13px'
                            }}
                        />
                        <button 
                            onClick={handleAddUserNote}
                            disabled={submittingNote || !noteInput.trim()}
                            style={{
                                background: colors.highlight, color: '#FFF', border: 'none',
                                padding: '0 16px', borderRadius: 4, cursor: 'pointer',
                                fontWeight: 600,
                                opacity: (submittingNote || !noteInput.trim()) ? 0.5 : 1
                            }}
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}
            </div>

            <div style={{ 
                flex: 1, 
                background: colors.surface, 
                borderRadius: 8, 
                border: `1px solid ${colors.border}`, 
                display: 'flex', 
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Desktop Header */}
                {!isMobile && (
                    <div style={{
                        padding: spacing.md,
                        borderBottom: `1px solid ${colors.border}`,
                        display: 'grid',
                        gridTemplateColumns: '140px 160px 1fr 180px 40px',
                        fontWeight: 600,
                        color: colors.textSecondary,
                        fontSize: '13px'
                    }}>
                        <div>Date</div>
                        <div>Category</div>
                        <div>Details</div>
                        <div>Entities</div>
                        <div></div>
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>Loading...</div>
                    ) : logs.length === 0 ? (
                        <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>No logs found.</div>
                    ) : logs.map(log => {
                        const isExpanded = expandedLogId === log.id;
                        
                        const renderLogContent = () => {
                            // 1. Check for Word Filter JSON structure
                            if (log.action === 'message_filtered' && log.details?.triggers) {
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div>
                                            <span style={{ color: colors.error, fontWeight: 600 }}>Filtered Words: </span>
                                            {Array.isArray(log.details.triggers) ? log.details.triggers.join(', ') : log.details.triggers}
                                        </div>
                                        <div style={{ marginTop: 4, color: colors.textSecondary }}>
                                            "{log.details.originalContent}"
                                        </div>
                                    </div>
                                );
                            }

                            // 2. Render Embeds
                            if (log.details?.embeds && log.details.embeds.length > 0) {
                                const embed = log.details.embeds[0];
                                return (
                                    <div>
                                        {embed.title && <div style={{ fontWeight: 600 }}>{embed.title}</div>}
                                        {embed.description && <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: 4 }}>{embed.description}</div>}
                                    </div>
                                );
                            } 

                            // 3. Feedback Logs
                            if (log.action === 'FEEDBACK_THREAD_CREATED') {
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ fontWeight: 600, color: colors.primaryLight }}>Feedback Thread Created</div>
                                        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2, color: colors.textSecondary }}>
                                            <span>Thread: <span style={{ color: colors.textPrimary }}>{log.details.threadName}</span></span>
                                            <span style={{ fontSize: '12px' }}>Cost: {log.details.cost} Credits</span>
                                            <span style={{ fontSize: '11px', opacity: 0.7 }}>ID: {log.details.threadId}</span>
                                        </div>
                                    </div>
                                );
                            }

                            // Studio Guide AI Response
                            if (log.action === 'STUDIO_GUIDE_AUTO_RESPONSE') {
                                const d = log.details || {};
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ fontWeight: 600, color: '#A78BFA' }}>Studio Guide Response</div>
                                        <div style={{ marginTop: 6, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 1.5 }}>
                                            "{d.question}"
                                        </div>
                                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '6px 16px', color: colors.textTertiary, fontSize: '12px' }}>
                                            {d.answerLength && <span>Answer: {d.answerLength} chars</span>}
                                            {d.hadImages && <span>🖼 Attached image</span>}
                                            {d.hadAudio && <span>🎵 Attached audio</span>}
                                            {d.hadVideo && <span>🎬 Attached video</span>}
                                        </div>
                                    </div>
                                );
                            }

                            if (log.details?.postId) {
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ fontWeight: 600, color: colors.primaryLight }}>
                                            {log.action === 'FEEDBACK_APPROVED' ? 'Feedback Approved' : 'Feedback Updated'}
                                        </div>
                                        <div style={{ marginTop: 4, display: 'flex', gap: 12, color: colors.textSecondary }}>
                                            <span>Pos ID: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 4 }}>{log.details.postId}</code></span>
                                            <span>Audio: {log.details.hasAudio ? '✅' : '❌'}</span>
                                        </div>
                                    </div>
                                );
                            }
                            
                            // 4. Economy Logs
                            if (log.action === 'item_bought') {
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ fontWeight: 600, color: colors.highlight }}>Item Purchased</div>
                                        <div style={{ marginTop: 4, display: 'flex', gap: 12, color: colors.textSecondary }}>
                                            <span>Item: <span style={{ color: colors.textPrimary, fontWeight: 500 }}>{log.details.item}</span></span>
                                            <span>Price: {log.details.price} 🪙</span>
                                        </div>
                                    </div>
                                );
                            }

                            // 4b. Profile & Track Admin Logs
                            const profileActionLabels: Record<string, { label: string; color: string }> = {
                                profile_status_changed:   { label: 'Profile Status Changed', color: '#ff9800' },
                                track_status_changed:     { label: 'Track Status Changed',   color: '#ff9800' },
                                profile_wiped:            { label: 'Profile Wiped',           color: '#f44336' },
                                track_uploaded:           { label: 'Track Uploaded',          color: colors.primary },
                                track_edited:             { label: 'Track Edited',            color: '#60A5FA' },
                                track_deleted:            { label: 'Track Deleted',           color: '#f44336' },
                                profile_updated:          { label: 'Profile Updated',         color: colors.primary },
                                profile_admin_edited:     { label: 'Admin Edited Profile',    color: '#ff9800' },
                                avatar_uploaded:          { label: 'Avatar Uploaded',         color: colors.primary },
                                avatar_admin_uploaded:    { label: 'Admin Updated Avatar',    color: '#ff9800' },
                                comment_created:          { label: 'Comment Posted',          color: '#60A5FA' },
                                comment_replied:          { label: 'Comment Replied',         color: '#60A5FA' },
                                comment_edited:           { label: 'Comment Edited',          color: '#FBBF24' },
                                comment_deleted:          { label: 'Comment Deleted',         color: '#f44336' },
                                comment_reacted:          { label: 'Comment Reacted',         color: '#A78BFA' },
                                comment_reaction_removed: { label: 'Reaction Removed',        color: '#9CA3AF' },
                                track_favourited:         { label: 'Track Favourited',        color: '#F87171' },
                                track_unfavourited:       { label: 'Track Unfavourited',      color: '#9CA3AF' },
                                track_reposted:           { label: 'Track Reposted',          color: '#34D399' },
                                track_unreposted:         { label: 'Track Unreposted',        color: '#9CA3AF' },
                                artist_followed:          { label: 'Artist Followed',         color: '#34D399' },
                                artist_unfollowed:        { label: 'Artist Unfollowed',       color: '#9CA3AF' },
                                playlist_created:         { label: 'Playlist Created',        color: '#FBBF24' },
                                playlist_deleted:         { label: 'Playlist Deleted',        color: '#F87171' },
                                playlist_track_added:     { label: 'Track Added to Playlist', color: '#34D399' },
                                playlist_track_removed:   { label: 'Track Removed from Playlist', color: '#F87171' },
                            };
                            if (profileActionLabels[log.action]) {
                                const meta = profileActionLabels[log.action];
                                const d = log.details || {};
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ fontWeight: 600, color: meta.color }}>{meta.label}</div>
                                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '8px 16px', color: colors.textSecondary }}>
                                            {d.username     && <span>Artist: <span style={{ color: colors.textPrimary }}>{d.username}</span></span>}
                                            {d.targetUserId && <span>Target user: <span style={{ color: colors.textPrimary }}>{d.targetUserId}</span></span>}
                                            {d.title        && <span>Track: <span style={{ color: colors.textPrimary }}>{d.title}</span></span>}
                                            {d.name         && <span>Playlist: <span style={{ color: colors.textPrimary }}>{d.name}</span></span>}
                                            {d.owner        && <span>Owner: <span style={{ color: colors.textPrimary }}>{d.owner}</span></span>}
                                            {d.artist       && <span>Artist: <span style={{ color: colors.textPrimary }}>{d.artist}</span></span>}
                                            {d.status       && <span>Status: <span style={{ color: meta.color, fontWeight: 700, textTransform: 'uppercase' }}>{d.status}</span></span>}
                                            {d.reason       && <span>Reason: <span style={{ color: colors.textPrimary }}>{d.reason}</span></span>}
                                            {d.trackCount !== undefined && <span>Tracks removed: {d.trackCount}</span>}
                                            {d.type         && <span>Type: <span style={{ color: colors.textPrimary }}>{d.type}</span></span>}
                                            {d.commentAuthor && <span>On comment by: <span style={{ color: colors.textPrimary }}>{d.commentAuthor}</span></span>}
                                            {d.newContent   && <span style={{ maxWidth: 400 }}>New: <span style={{ color: colors.textPrimary, fontStyle: 'italic' }}>"{d.newContent}"</span></span>}
                                            {d.previousContent && <span style={{ maxWidth: 400 }}>Was: <span style={{ color: colors.textTertiary, fontStyle: 'italic' }}>"{d.previousContent}"</span></span>}
                                            {d.content      && !d.newContent && <span style={{ maxWidth: 400 }}>Content: <span style={{ color: colors.textTertiary, fontStyle: 'italic' }}>"{d.content}"</span></span>}
                                            {d.deletedByOwner !== undefined && <span style={{ color: d.deletedByOwner ? colors.textSecondary : '#F87171' }}>{d.deletedByOwner ? 'Self-deleted' : 'Deleted by content owner'}</span>}
                                        </div>
                                    </div>
                                );
                            }

                            // 5. Moderation Logs
                            if (['ban', 'kick', 'timeout', 'unban', 'warn', 'softban'].includes(log.action)) {
                                const colorMap: any = { ban: colors.error, kick: colors.highlight, timeout: colors.highlightLight, unban: colors.success };
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ fontWeight: 600, color: colorMap[log.action] || colors.primary, textTransform: 'capitalize' }}>
                                            {log.action}
                                        </div>
                                        <div style={{ marginTop: 4, color: colors.textSecondary }}>
                                            {log.details.reason && <span>Reason: <span style={{ color: colors.textPrimary }}>{log.details.reason}</span></span>}
                                            {log.details.duration && <span style={{ marginLeft: 8, background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: '12px' }}>{log.details.duration}</span>}
                                        </div>
                                    </div>
                                );
                            }

                            // 6. Channel Rules & Feedback Reviews
                            if (log.details?.ruleId) {
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ fontWeight: 600, color: colors.primaryLight }}>Channel Rule Update</div>
                                        <div style={{ marginTop: 4, display: 'flex', gap: 12, color: colors.textSecondary, flexWrap: 'wrap' }}>
                                            <span>Rule ID: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 4 }}>{log.details.ruleId}</code></span>
                                            {log.details.channelId && <span>Channel: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 4 }}>{log.details.channelId}</code></span>}
                                        </div>
                                    </div>
                                );
                            }

                            if (log.details?.reviewId) {
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ fontWeight: 600, color: colors.highlight }}>Feedback Review</div>
                                        <div style={{ marginTop: 4, display: 'flex', gap: 12, color: colors.textSecondary }}>
                                            <span>Review ID: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 4 }}>{log.details.reviewId}</code></span>
                                        </div>
                                    </div>
                                );
                            }

                            // 7. Beat Battle Logs
                            const battleActionLabels: Record<string, { label: string; color: string }> = {
                                battle_created:         { label: 'Battle Created',        color: colors.primary },
                                battle_updated:         { label: 'Battle Updated',        color: '#60A5FA' },
                                battle_deleted:         { label: 'Battle Deleted',        color: colors.error },
                                announcement_posted:    { label: 'Announcement Posted',   color: colors.success },
                                announcement_queued:    { label: 'Announcement Queued',   color: '#FBBF24' },
                            };
                            if (battleActionLabels[log.action]) {
                                const meta = battleActionLabels[log.action];
                                const d = log.details || {};
                                const changesStr = Array.isArray(d.changes) && d.changes.length > 0
                                    ? d.changes.filter((c: string) => c !== 'title').join(', ')
                                    : null;
                                const statusColors: Record<string, string> = { upcoming: '#60A5FA', active: '#34D399', voting: '#FBBF24', completed: '#6B7280' };

                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ fontWeight: 600, color: meta.color }}>{meta.label}</div>
                                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 14px', color: colors.textSecondary }}>
                                            {d.title && <span>Battle: <span style={{ color: colors.textPrimary }}>{d.title}</span></span>}
                                            {d.status && <span>Status: <span style={{ color: statusColors[d.status] || colors.textPrimary, fontWeight: 600, textTransform: 'uppercase' }}>{d.status}</span></span>}
                                            {d.ok === false && <span style={{ color: colors.error, fontWeight: 600 }}>Failed</span>}
                                            {changesStr && <span>Changed: <span style={{ color: colors.textPrimary }}>{changesStr}</span></span>}
                                        </div>
                                    </div>
                                );
                            }

                            // 8. Anti-Piracy Logs
                            if (log.action === 'piracy_detected') {
                                const d = log.details || {};
                                const verdictColor = d.aiVerdict === 'VIOLATION' ? colors.error : d.aiVerdict === 'SAFE' ? colors.success : colors.textSecondary;
                                const actionColors: Record<string, string> = { delete: colors.error, timeout: colors.highlight, warn: '#FBBF24', log: colors.textSecondary };
                                return (
                                    <div style={{ fontSize: '13px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600, color: colors.error }}>Piracy Detected</span>
                                            {d.aiVerdict && <span style={{ background: verdictColor + '22', color: verdictColor, padding: '1px 6px', borderRadius: 4, fontSize: '11px', fontWeight: 700 }}>{d.aiVerdict}</span>}
                                            {d.actionTaken && <span style={{ background: (actionColors[d.actionTaken] || colors.primary) + '22', color: actionColors[d.actionTaken] || colors.primary, padding: '1px 6px', borderRadius: 4, fontSize: '11px', textTransform: 'uppercase' }}>{d.actionTaken}</span>}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: colors.textSecondary }}>
                                            {d.originalContent && <span style={{ fontStyle: 'italic', color: colors.textTertiary }}>"<span style={{ color: colors.textPrimary }}>{String(d.originalContent).slice(0, 200)}{String(d.originalContent).length > 200 ? '…' : ''}</span>"</span>}
                                            {d.aiReason && <span>AI: <span style={{ color: colors.textPrimary }}>{d.aiReason}</span></span>}
                                            {d.matchedKeywords?.length > 0 && <span>Keywords: <span style={{ color: colors.highlight }}>{Array.isArray(d.matchedKeywords) ? d.matchedKeywords.join(', ') : d.matchedKeywords}</span></span>}
                                            {d.channelName && <span>Channel: <span style={{ color: colors.textPrimary }}>#{d.channelName}</span></span>}
                                        </div>
                                    </div>
                                );
                            }

                            // 9. Fallback
                            return (
                                <div style={{ wordBreak: 'break-word', fontSize: '13px' }}>
                                    {log.details?.content || (typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {}).slice(0, 150))}
                                </div>
                            );
                        };

                        return (
                            <div key={log.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                {/* Log Item Row */}
                                <div 
                                    onClick={(e) => {
                                        // Make sure we don't toggle if clicking buttons
                                        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') return;
                                        setExpandedLogId(isExpanded ? null : log.id);
                                    }}
                                    style={{
                                        padding: spacing.md,
                                        cursor: 'pointer',
                                        background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                                        ...(isMobile ? { display: 'flex', flexDirection: 'column', gap: 8 } : {
                                            display: 'grid', gridTemplateColumns: '140px 160px 1fr 180px 40px', gap: spacing.md, alignItems: 'start'
                                        }),
                                        position: 'relative'
                                    }}
                                >
                                    {/* Date */}
                                    <div style={{ color: colors.textTertiary, fontSize: '12px' }}>
                                        {new Date(log.createdAt).toLocaleString()}
                                    </div>
                                    
                                    {/* Category */}
                                    <div>
                                        {(() => {
                                            const badge = getCategoryBadge(log.action);
                                            return (
                                                <span style={{
                                                    background: `${badge.color}22`,
                                                    color: badge.color,
                                                    border: `1px solid ${badge.color}55`,
                                                    padding: '2px 8px',
                                                    borderRadius: 4,
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    display: 'inline-block',
                                                }}>
                                                    {badge.label}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    {/* Content */}
                                    <div style={{ color: colors.textPrimary }}>
                                        {renderLogContent()}
                                    </div>

                                    {/* Entities */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {log.executorId && <UserBadge userId={log.executorId} name={log.executorName} type="exec" />}
                                        {log.targetId && <UserBadge userId={log.targetId} name={log.targetName} type="target" />}
                                    </div>
                                    
                                    {/* Expand Icon/Indicator - Now in its own column */}
                                    <div style={{ 
                                        opacity: 0.5,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        position: 'relative'
                                    }}>
                                        {isExpanded ? <XCircle size={16} /> : <MessageSquare size={16} />}
                                        {log.comments && log.comments.length > 0 && (
                                            <span style={{ 
                                                position: 'absolute', top: -5, right: 5, 
                                                background: colors.highlight, color: '#FFF', 
                                                fontSize: '8px', width: 12, height: 12, borderRadius: '50%', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                            }}>
                                                {log.comments.length}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Comments Section */}
                                {isExpanded && (
                                    <div style={{ 
                                        padding: '0 16px 16px 16px', 
                                        background: 'rgba(0,0,0,0.2)',
                                        borderTop: `1px dashed ${colors.border}`
                                    }}>
                                        <h4 style={{ color: colors.textSecondary, marginBottom: 8, fontSize: '12px', marginTop: 16 }}>
                                            Discussion Thread
                                        </h4>
                                        
                                        {/* List Comments */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                                            {log.comments?.map(comment => (
                                                <div key={comment.id} style={{ 
                                                    background: colors.background, padding: 8, borderRadius: 4, border: `1px solid ${colors.border}`
                                                }}>
                                                    <div style={{ fontSize: '13px', color: colors.textPrimary }}>{comment.content}</div>
                                                    <div style={{ fontSize: '10px', color: colors.textTertiary, marginTop: 4 }}>
                                                        User: {comment.username || comment.userId} • {new Date(comment.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                            ))}
                                            {(!log.comments || log.comments.length === 0) && (
                                                <div style={{ fontSize: '12px', color: colors.textTertiary, fontStyle: 'italic' }}>No comments yet. Start the discussion!</div>
                                            )}
                                        </div>

                                        {/* Add Comment Input */}
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input 
                                                type="text" 
                                                placeholder="Write a comment..." 
                                                value={commentInput}
                                                onChange={(e) => setCommentInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddComment(log.id)}
                                                onClick={(e) => e.stopPropagation()} 
                                                style={{
                                                    flex: 1, background: colors.background, border: `1px solid ${colors.border}`,
                                                    color: colors.textPrimary, padding: '8px', borderRadius: 4
                                                }}
                                            />
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleAddComment(log.id); }}
                                                disabled={submittingComment || !commentInput.trim()}
                                                style={{
                                                    background: colors.primary, color: '#FFF', border: 'none',
                                                    padding: '0 16px', borderRadius: 4, cursor: 'pointer',
                                                    opacity: (submittingComment || !commentInput.trim()) ? 0.5 : 1
                                                }}
                                            >
                                                Post
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Pagination Fixed */}
                <div style={{ padding: spacing.md, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: spacing.md }}>
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        disabled={page === 1} 
                        style={{ 
                            padding: '8px 16px',
                            background: page === 1 ? 'transparent' : colors.surface,
                            border: `1px solid ${page === 1 ? colors.border : colors.textSecondary}`,
                            color: page === 1 ? colors.textTertiary : colors.textPrimary,
                            borderRadius: 4,
                            cursor: page === 1 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4
                        }}
                    >
                        <ChevronLeft size={16} /> Prev
                    </button>
                    
                    <span style={{ color: colors.textSecondary, fontSize: '14px', fontWeight: 600 }}>
                        Page {page} of {totalPages}
                    </span>
                    
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                        disabled={page === totalPages} 
                        style={{ 
                            padding: '8px 16px',
                            background: page === totalPages ? 'transparent' : colors.surface,
                            border: `1px solid ${page === totalPages ? colors.border : colors.textSecondary}`,
                            color: page === totalPages ? colors.textTertiary : colors.textPrimary,
                            borderRadius: 4,
                            cursor: page === totalPages ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4
                        }}
                    >
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            </div>
            </>
        ) : (
            // ------------------ USERS TAB ------------------
            <div style={{ 
                flex: 1, 
                background: colors.surface, 
                borderRadius: 8, 
                border: `1px solid ${colors.border}`, 
                display: 'flex', 
                flexDirection: 'column', 
                padding: spacing.lg 
            }}>
                <div style={{ marginBottom: spacing.lg, display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 8, color: colors.textPrimary }}>Track New User</h3>
                        <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px' }}>
                            Add a user ID here to start tracking them. This will create an initial note.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                         <input 
                            type="text" 
                            placeholder="User ID (e.g. 123456789...)" 
                            value={newUserToTrack}
                            onChange={(e) => setNewUserToTrack(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTrackNewUser()}
                            style={{
                                background: colors.background, border: `1px solid ${colors.border}`,
                                color: colors.textPrimary, padding: '8px 12px', borderRadius: 4,
                                width: '250px'
                            }}
                        />
                         <button 
                            onClick={handleTrackNewUser}
                            disabled={!newUserToTrack.trim()}
                            style={{
                                background: colors.highlight, color: '#FFF', border: 'none',
                                padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
                                fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                                opacity: !newUserToTrack.trim() ? 0.5 : 1
                            }}
                        >
                            <Plus size={16} /> Add User
                        </button>
                    </div>
                </div>

                <h3 style={{ color: colors.textPrimary, borderBottom: `1px solid ${colors.border}`, paddingBottom: 8 }}>
                    Tracked Users ({trackedUsers.length})
                </h3>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loadingTracked ? (
                        <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>Loading...</div>
                    ) : trackedUsers.length === 0 ? (
                        <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>
                            No tracked users yet. Add one above!
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {trackedUsers.map(user => (
                                <div 
                                    key={user.userId}
                                    onClick={() => handleUserClick(user.userId)}
                                    style={{
                                        padding: spacing.md,
                                        background: colors.background,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.highlight}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.border}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ 
                                            background: colors.highlight, color: '#FFF', width: 32, height: 32, 
                                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            overflow: 'hidden'
                                        }}>
                                            {/* Avatar or Icon */}
                                            <Hash size={16} />
                                        </div>
                                        <div>
                                            <div style={{ color: colors.textPrimary, fontWeight: 600 }}>
                                                {user.username ? (
                                                    <span>{user.username} <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '11px' }}>({user.userId})</span></span>
                                                ) : user.userId}
                                            </div>
                                            <div style={{ color: colors.textTertiary, fontSize: '11px' }}>
                                                Last note: {user.lastNoteAt ? new Date(user.lastNoteAt).toLocaleDateString() : 'Never'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ 
                                            background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4, 
                                            fontSize: '11px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 
                                        }}>
                                            <StickyNote size={12} /> {user.noteCount} Notes
                                        </span>
                                        <ChevronRight size={16} color={colors.textTertiary} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

      </div>
      </div>
    </div>
  );
};

export default Logs;
