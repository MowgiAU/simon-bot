import React, { useEffect, useState } from 'react';
import { colors, spacing } from '../theme/theme';
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
  ChevronRight
} from 'lucide-react';

interface LogComment {
  id: string;
  userId: string;
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

interface ActionLog {
  id: string;
  pluginId: string;
  action: string;
  executorId: string | null;
  targetId: string | null;
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
];

interface LogsProps {
  guildId: string;
}

export const Logs: React.FC<LogsProps> = ({ guildId }) => {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeUser, setActiveUser] = useState<string | null>(null);
  
  // Comments Interaction
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // User Notes Interaction
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  
  // Responsive state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchLogs = async (pageNum: number) => {
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
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items); 
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
        console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(1);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [activeCategory, searchQuery, activeUser]);

  useEffect(() => {
    if (page > 1) fetchLogs(page);
  }, [page]);

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

  useEffect(() => {
    if (activeUser) {
        setShowNotes(true);
        fetchUserNotes(activeUser);
    } else {
        setShowNotes(false);
        setUserNotes([]);
    }
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

  const UserBadge = ({ userId, type }: { userId: string, type: 'exec' | 'target' }) => (
      <div 
        onClick={(e) => { e.stopPropagation(); setActiveUser(userId); }}
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
            marginRight: 4
        }}
        title={`Filter by this user (${type})`}
      >
        <Hash size={10} />
        {type === 'exec' ? 'By: ' : 'To: '}{userId.slice(0, 8)}...
      </div>
  );

  return (
    <div style={{ 
        padding: isMobile ? spacing.md : spacing.xl, 
        display: 'flex', 
        gap: spacing.lg, 
        height: 'calc(100vh - 80px)',
        flexDirection: isMobile ? 'column' : 'row',
        position: 'relative'
    }}>
      {/* Mobile Filter Toggle */}
      {isMobile && (
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

      {/* Filters Sidebar */}
      <div style={{ 
        width: isMobile ? '100%' : '240px', 
        flexShrink: 0, 
        background: colors.surface, 
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        padding: spacing.md,
        display: (isMobile && !showFilters) ? 'none' : 'block',
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
        <h3 style={{ color: colors.textPrimary, marginTop: 0, marginBottom: spacing.md, fontSize: '14px', textTransform: 'uppercase' }}>
            Categories
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {CATEGORIES.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => {
                        setActiveCategory(cat.id);
                        if (isMobile) setShowFilters(false);
                    }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px',
                        background: activeCategory === cat.id ? colors.highlight : 'transparent',
                        color: activeCategory === cat.id ? '#FFF' : colors.textSecondary,
                        border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                        fontSize: '13px', fontWeight: activeCategory === cat.id ? 600 : 400
                    }}
                >
                    {cat.icon}
                    {cat.label}
                </button>
            ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ marginBottom: spacing.md }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <h2 style={{ color: colors.textPrimary, margin: 0, fontSize: isMobile ? '1.2rem' : '1.5rem' }}>Audit Logs</h2>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: colors.highlight }}>Filtered User: {activeUser}</span>
                        <XCircle 
                            size={16} 
                            style={{ cursor: 'pointer', color: colors.textSecondary }} 
                            onClick={() => setActiveUser(null)} 
                            title="Clear Filter"
                        />
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
                    gridTemplateColumns: '140px 100px 1fr 200px',
                    fontWeight: 600,
                    color: colors.textSecondary,
                    fontSize: '13px'
                }}>
                    <div>Date</div>
                    <div>Category</div>
                    <div>Details</div>
                    <div>Entities</div>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>Loading...</div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>No logs found for this filter.</div>
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
                            // ... existing embed rendering code ...
                            return (
                                <div>
                                    {log.details.embeds[0].title && <div style={{ fontWeight: 600 }}>{log.details.embeds[0].title}</div>}
                                    {log.details.embeds[0].description && <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: 4 }}>{log.details.embeds[0].description}</div>}
                                </div>
                            );
                        } 
                        
                        // 3. Fallback
                        return (
                            <div style={{ wordBreak: 'break-word', fontSize: '13px' }}>
                                {log.details?.content || JSON.stringify(log.details || {}).slice(0, 150)}
                            </div>
                        );
                    };

                    return (
                        <div key={log.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                             {/* Log Item Row */}
                            <div 
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                style={{
                                    padding: spacing.md,
                                    cursor: 'pointer',
                                    background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                                    ...(isMobile ? { display: 'flex', flexDirection: 'column', gap: 8 } : {
                                        display: 'grid', gridTemplateColumns: '140px 100px 1fr 200px', gap: spacing.md, alignItems: 'start'
                                    })
                                }}
                            >
                                {/* Date */}
                                <div style={{ color: colors.textTertiary, fontSize: '12px' }}>
                                    {new Date(log.createdAt).toLocaleString()}
                                </div>
                                
                                {/* Category */}
                                <div>
                                    <span style={{ 
                                        background: 'rgba(255,255,255,0.1)', padding: '2px 8px', 
                                        borderRadius: 4, fontSize: '11px', fontWeight: 600 
                                    }}>
                                        {log.action}
                                    </span>
                                </div>

                                {/* Content */}
                                <div style={{ color: colors.textPrimary }}>
                                    {renderLogContent()}
                                </div>

                                {/* Entities */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {log.executorId && <UserBadge userId={log.executorId} type="exec" />}
                                    {log.targetId && <UserBadge userId={log.targetId} type="target" />}
                                </div>
                                <div style={{ 
                                    position: 'absolute', 
                                    right: 10, 
                                    top: '50%', 
                                    transform: 'translateY(-50%)', 
                                    opacity: 0.5,
                                    display: isMobile ? 'none' : 'block'
                                }}>
                                    {isExpanded ? <XCircle size={16} /> : <MessageSquare size={16} />}
                                </div>
                            </div>

                            {/* Expanded Comments Section */}
                            {isExpanded && (
                                <div style={{ 
                                    padding: '0 16px 16px 16px', 
                                    background: 'rgba(0,0,0,0.2)',
                                    borderTop: `1px dashed ${colors.border}`
                                }}>
                                    <h4 style={{ color: colors.textSecondary, marginBottom: 8, fontSize: '12px', marginTop: 16 }}>Comments</h4>
                                    
                                    {/* List Comments */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                                        {log.comments?.map(comment => (
                                            <div key={comment.id} style={{ 
                                                background: colors.background, padding: 8, borderRadius: 4, border: `1px solid ${colors.border}`
                                            }}>
                                                <div style={{ fontSize: '13px', color: colors.textPrimary }}>{comment.content}</div>
                                                <div style={{ fontSize: '10px', color: colors.textTertiary, marginTop: 4 }}>
                                                    User: {comment.userId} • {new Date(comment.createdAt).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                        {(!log.comments || log.comments.length === 0) && (
                                            <div style={{ fontSize: '12px', color: colors.textTertiary, fontStyle: 'italic' }}>No comments yet.</div>
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
                                            style={{
                                                flex: 1, background: colors.background, border: `1px solid ${colors.border}`,
                                                color: colors.textPrimary, padding: '8px', borderRadius: 4
                                            }}
                                        />
                                        <button 
                                            onClick={() => handleAddComment(log.id)}
                                            disabled={submittingComment || !commentInput.trim()}
                                            style={{
                                                background: colors.primary, color: '#FFF', border: 'none',
                                                padding: '0 16px', borderRadius: 4, cursor: 'pointer',
                                                opacity: (submittingComment || !commentInput.trim()) ? 0.5 : 1
                                            }}
                                        >
                                            Add
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
      </div>
    </div>
  );
};

export default Logs;
