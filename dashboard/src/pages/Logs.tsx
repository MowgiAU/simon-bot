import React, { useEffect, useState } from 'react';
import { colors, spacing } from '../theme/theme';

interface ActionLog {
  id: string;
  pluginId: string;
  action: string;
  executorId: string | null;
  targetId: string | null;
  details: any;
  createdAt: string;
}

interface LogsProps {
  guildId: string;
}

export const Logs: React.FC<LogsProps> = ({ guildId }) => {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/guilds/${guildId}/logs?page=${pageNum}&limit=20`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setPage(data.pagination.page);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [guildId]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      fetchLogs(newPage);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 style={{ color: colors.textPrimary, margin: 0 }}>Audit Logs</h1>
        <p style={{ color: colors.textSecondary, marginTop: 8 }}>
            History of automated actions and moderation events
        </p>
      </div>

      <div className="dashboard-card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading && logs.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textSecondary }}>Loading...</div>
          ) : (
            <>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '13px' }}>
                  <th style={{ padding: spacing.md }}>TIME</th>
                  <th style={{ padding: spacing.md }}>PLUGIN</th>
                  <th style={{ padding: spacing.md }}>ACTION</th>
                  <th style={{ padding: spacing.md }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${colors.border}`, color: colors.textPrimary }}>
                    <td style={{ padding: spacing.md, color: colors.textSecondary, fontSize: '13px', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: spacing.md }}>
                        <span style={{ 
                            backgroundColor: 'rgba(255,255,255,0.05)', 
                            padding: '4px 8px', 
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: colors.textSecondary
                        }}>
                            {log.pluginId}
                        </span>
                    </td>
                    <td style={{ padding: spacing.md, fontWeight: 500 }}>
                        {formatActionAttempt(log.action)}
                    </td>
                    <td style={{ padding: spacing.md, fontSize: '14px' }}>
                      {renderDetails(log)}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                    <tr>
                        <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: colors.textSecondary }}>
                            No logs found.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
            
            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ padding: spacing.md, display: 'flex', justifyContent: 'center', gap: spacing.md, borderTop: `1px solid ${colors.border}` }}>
                    <button 
                        disabled={page === 1}
                        onClick={() => handlePageChange(page - 1)}
                        style={{ padding: '4px 12px', background: colors.surface, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, borderRadius: '4px' }}
                    >
                        Previous
                    </button>
                    <span style={{ color: colors.textSecondary }}>Page {page} of {totalPages}</span>
                    <button 
                        disabled={page === totalPages}
                        onClick={() => handlePageChange(page + 1)}
                        style={{ padding: '4px 12px', background: colors.surface, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1, borderRadius: '4px' }}
                    >
                        Next
                    </button>
                </div>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function formatActionAttempt(action: string) {
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function renderDetails(log: ActionLog) {
    if (log.pluginId === 'word-filter' && log.action === 'message_filtered') {
        const { channelName, triggers, executorId } = log.details || {};
        return (
            <span>
                Filtered <strong>{triggers?.join(', ')}</strong> in <span style={{ color: colors.accent }}>#{channelName}</span>
                {/* We could fetch username by executorId potentially */}
            </span>
        );
    }
    return <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{JSON.stringify(log.details)}</span>;
}
