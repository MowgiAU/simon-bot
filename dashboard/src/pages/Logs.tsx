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
  Search
} from 'lucide-react';

interface ActionLog {
  id: string;
  pluginId: string;
  action: string;
  executorId: string | null;
  targetId: string | null;
  details: any;
  createdAt: string;
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
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async (pageNum: number) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        ...(activeCategory !== 'all' && { action: activeCategory }),
        ...(searchQuery && { search: searchQuery })
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchLogs(1);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    if (page > 1) fetchLogs(page);
  }, [page]);

  return (
    <div style={{ padding: spacing.xl, display: 'flex', gap: spacing.lg, height: 'calc(100vh - 80px)' }}>
      {/* Filters Sidebar */}
      <div style={{ 
        width: '240px', 
        flexShrink: 0, 
        background: colors.surface, 
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        padding: spacing.md
      }}>
        <h3 style={{ color: colors.textPrimary, marginTop: 0, marginBottom: spacing.md, fontSize: '14px', textTransform: 'uppercase' }}>
            Log Categories
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {CATEGORIES.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 12px',
                        background: activeCategory === cat.id ? colors.highlight : 'transparent',
                        color: activeCategory === cat.id ? '#FFF' : colors.textSecondary,
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '14px',
                        fontWeight: activeCategory === cat.id ? 600 : 400
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <h2 style={{ color: colors.textPrimary, margin: 0 }}>Audit Logs</h2>
          <div style={{ position: 'relative' }}>
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
                    width: '300px'
                }}
             />
          </div>
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
                <div>Executor/Target</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>Loading...</div>
                ) : logs.map(log => {
                    // Helper to visualize complex details
                    const renderDetails = () => {
                        // If imported embed
                        if (log.details?.embeds && log.details.embeds.length > 0) {
                            const embed = log.details.embeds[0];
                            return (
                                <div>
                                    {embed.title && <div style={{ fontWeight: 600 }}>{embed.title}</div>}
                                    {embed.description && <div style={{ fontSize: '12px', color: colors.textSecondary }}>{embed.description}</div>}
                                    {/* Render fields briefly */}
                                    {embed.fields && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                            {embed.fields.slice(0, 2).map((f: any) => (
                                                <span key={f.name} style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4, fontSize: '11px' }}>
                                                    {f.name}: {f.value}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        // Default fallback
                        return (
                            <div style={{ wordBreak: 'break-word', fontSize: '13px' }}>
                                {JSON.stringify(log.details || {}).slice(0, 150)}
                                {JSON.stringify(log.details || {}).length > 150 && '...'}
                            </div>
                        );
                    };

                    return (
                        <div key={log.id} style={{
                            padding: spacing.md,
                            borderBottom: `1px solid ${colors.border}`,
                            display: 'grid',
                            gridTemplateColumns: '140px 100px 1fr 200px',
                            gap: spacing.md,
                            fontSize: '13px',
                            alignItems: 'start'
                        }}>
                            <div style={{ color: colors.textTertiary }}>
                                {new Date(log.createdAt).toLocaleString()}
                            </div>
                            <div>
                                <span style={{ 
                                    background: 'rgba(255,255,255,0.1)', 
                                    padding: '2px 8px', 
                                    borderRadius: 4, 
                                    fontSize: '11px',
                                    fontWeight: 600
                                }}>
                                    {log.action}
                                </span>
                            </div>
                            <div style={{ color: colors.textPrimary }}>
                                {renderDetails()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '11px' }}>
                                {log.executorId && <span>Exec: {log.executorId}</span>}
                                {log.targetId && <span>Target: {log.targetId}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pagination simplified */}
            <div style={{ padding: spacing.md, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'center', gap: spacing.md }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                <span style={{ color: colors.textSecondary }}>Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
            </div>
      </div>
      </div>
    </div>
  );
};
