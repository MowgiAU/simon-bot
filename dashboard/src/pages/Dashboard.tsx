import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  MessageSquare, Shield, ShieldAlert, DollarSign, UserPlus, Settings,
  Users, Mic, Bot, Globe, type LucideIcon
} from 'lucide-react';
import { colors } from '../theme/theme';
import './Dashboard.css';

interface DashboardProps {
  guildId: string;
  onNavigate: (section: string) => void;
  accessiblePlugins: string[];
}

interface DashboardStats {
  activeMembers: number;
  totalMembers: number;
  totals: {
    messages: number;
    voiceMinutes: number;
    bans: number;
  };
  today: {
    messageCount: number;
    voiceMinutes: number;
  } | null;
  topChannels: Array<{
    name: string;
    messages: number;
  }>;
  history: Array<{
    date: string;
    messageCount: number;
    voiceMinutes: number;
    newBans: number;
    memberCount: number;
  }>;
  pluginsData?: {
    tickets: { open: number };
    email: { unread: number };
    economy: { totalBalance: number };
    welcome: { enabled: boolean };
    filter: { enabled: boolean };
  };
  recentLogs?: Array<{
    id: string;
    pluginId: string;
    action: string;
    executorName: string;
    createdAt: string;
  }>;
}

export const Dashboard: React.FC<DashboardProps> = ({ guildId, onNavigate, accessiblePlugins }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChartTab, setActiveChartTab] = useState<'messages' | 'voice' | 'channels'>('messages');

  useEffect(() => {
    const controller = new AbortController();
    
    // Debounce to allow rapid navigation without hitting API
    const timeoutId = setTimeout(() => {
        const fetchStats = async () => {
          try {
            setLoading(true);
            const response = await fetch(`/api/guilds/${guildId}/stats`, { 
                credentials: 'include',
                signal: controller.signal 
            });
            if (response.ok) {
              const data = await response.json();
              setStats(data);
            }
          } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Failed to load dashboard stats', error);
          } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
          }
        };

        fetchStats();
    }, 300);
    
    return () => {
        clearTimeout(timeoutId);
        controller.abort();
    };
  }, [guildId]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num);
  };

  // Format dates for charts
  const historyData = stats?.history?.map(h => ({
    ...h,
    date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    voiceHours: Math.round((h.voiceMinutes / 60) * 10) / 10
  })) || [];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 style={{ color: colors.textPrimary, margin: 0 }}>
          Dashboard
        </h1>
      </div>

      {loading ? (
        <div style={{ padding: 40, color: colors.textSecondary, fontSize: '14px' }}>Loading stats...</div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="stats-grid">
            <StatCard icon={MessageSquare} iconColor={colors.highlight} iconBg="rgba(245, 158, 11, 0.1)" label="Messages Today" value={formatNumber(stats?.today?.messageCount || 0)} />
            <StatCard icon={Mic} iconColor={colors.success} iconBg="rgba(16, 185, 129, 0.1)" label="Voice Today" value={`${Math.round((stats?.today?.voiceMinutes || 0) / 60 * 10) / 10}h`} />
            <StatCard icon={Users} iconColor={colors.primary} iconBg="rgba(16, 185, 129, 0.1)" label="Online Now" value={stats ? formatNumber(stats.activeMembers) : '-'} />
            <StatCard icon={UserPlus} iconColor={colors.info} iconBg="rgba(59, 130, 246, 0.1)" label="Total Members" value={stats ? formatNumber(stats.totalMembers) : '-'} />
          </div>

          {/* Main Content: Chart + Recent Activity */}
          <div className="dashboard-grid-split">
             <div className="dashboard-card-main" style={{ minHeight: '380px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                   <h3 style={{ margin: 0, fontSize: '15px', color: colors.textPrimary, fontWeight: 600 }}>Server Activity</h3>
                   <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '3px' }}>
                     {(['messages', 'voice', 'channels'] as const).map(tab => (
                       <button key={tab}
                         onClick={() => setActiveChartTab(tab)}
                         style={{
                           background: activeChartTab === tab ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                           color: activeChartTab === tab ? colors.primary : colors.textTertiary,
                           border: activeChartTab === tab ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid transparent',
                           borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, transition: 'all 0.2s',
                           textTransform: 'capitalize'
                         }}
                       >{tab}</button>
                     ))}
                   </div>
                </div>
                <div style={{ height: '320px', width: '100%', minWidth: 0 }}>
                   <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                     {activeChartTab === 'messages' ? (
                      <AreaChart data={historyData}>
                        <defs>
                          <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.primary} stopOpacity={0.25}/>
                            <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="date" stroke={colors.textTertiary} axisLine={false} tickLine={false} fontSize={10} dy={10} />
                        <YAxis stroke={colors.textTertiary} axisLine={false} tickLine={false} dx={-10} fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.glassBorder}`, borderRadius: '10px', color: colors.textPrimary, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} />
                        <Area type="monotone" dataKey="messageCount" stroke={colors.primary} strokeWidth={2} fill="url(#colorMessages)" name="Messages" animationDuration={1200} />
                      </AreaChart>
                     ) : activeChartTab === 'voice' ? (
                      <BarChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="date" stroke={colors.textTertiary} axisLine={false} tickLine={false} fontSize={10} dy={10} />
                        <YAxis stroke={colors.textTertiary} axisLine={false} tickLine={false} dx={-10} fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.glassBorder}`, borderRadius: '10px', color: colors.textPrimary, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} />
                        <Bar dataKey="voiceHours" fill={colors.highlight} name="Voice Hours" radius={[4, 4, 0, 0]} animationDuration={1200} />
                      </BarChart>
                     ) : (
                      <BarChart data={stats?.topChannels} layout="vertical" margin={{ left: 30, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                        <XAxis type="number" stroke={colors.textTertiary} axisLine={false} tickLine={false} fontSize={10} />
                        <YAxis dataKey="name" type="category" stroke={colors.textTertiary} width={100} axisLine={false} tickLine={false} fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.glassBorder}`, borderRadius: '10px', color: colors.textPrimary }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Bar dataKey="messages" fill={colors.accent} radius={[0, 4, 4, 0]} name="Messages" barSize={24} animationDuration={1200} />
                      </BarChart>
                     )}
                   </ResponsiveContainer>
                </div>
             </div>

             {/* Recent Activity */}
             <div className="dashboard-card-activity">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                   <h3 style={{ margin: 0, fontSize: '15px', color: colors.textPrimary, fontWeight: 600 }}>Recent Activity</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                   {stats?.recentLogs && stats.recentLogs.length > 0 ? (
                    stats.recentLogs.map((log) => {
                      const logColor = log.pluginId === 'moderation' ? colors.primary
                        : log.pluginId === 'word-filter' ? colors.highlight
                        : log.pluginId === 'tickets' ? colors.info
                        : log.pluginId === 'economy' ? colors.success
                        : colors.textSecondary;

                      const logIcon = log.pluginId === 'moderation' ? <Shield size={14} />
                        : log.pluginId === 'word-filter' ? <ShieldAlert size={14} />
                        : log.pluginId === 'tickets' ? <MessageSquare size={14} />
                        : log.pluginId === 'economy' ? <DollarSign size={14} />
                        : <Settings size={14} />;

                      const seconds = Math.floor((new Date().getTime() - new Date(log.createdAt).getTime()) / 1000);
                      const timeLabel = seconds < 60 ? 'just now'
                        : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago`
                        : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago`
                        : new Date(log.createdAt).toLocaleDateString();

                      return (
                        <div key={log.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                           <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${logColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: logColor, flexShrink: 0 }}>
                              {logIcon}
                           </div>
                           <div style={{ overflow: 'hidden', flex: 1 }}>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                 {log.action.replace(/_/g, ' ')}
                              </div>
                              <div style={{ fontSize: '11px', color: colors.textTertiary }}>
                                 {log.executorName} · {timeLabel}
                              </div>
                           </div>
                        </div>
                      );
                    })
                   ) : (
                     <div style={{ textAlign: 'center', padding: '24px', color: colors.textTertiary, fontSize: '13px' }}>
                        No recent activity
                     </div>
                   )}
                </div>
                <button 
                  onClick={() => onNavigate('logs')}
                  style={{ width: '100%', marginTop: '16px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.12)', borderRadius: '10px', padding: '9px', color: colors.primary, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  View All Logs
                </button>
             </div>
          </div>

          {/* Bot & Website Status — Two Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginTop: '24px' }}>
            
            {/* Bot Status */}
            <div className="dashboard-card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bot size={16} color={colors.primary} />
                <h2 style={{ margin: 0 }}>Bot Status</h2>
              </div>
              <div className="card-body" style={{ padding: '16px 24px' }}>
                <StatusRow label="Word Filter" active={stats?.pluginsData?.filter?.enabled} onClick={() => onNavigate('word-filter-settings')} />
                <StatusRow label="Welcome Gate" active={stats?.pluginsData?.welcome?.enabled} onClick={() => onNavigate('welcome-gate')} />
                <div className="info-row" style={{ cursor: 'pointer' }} onClick={() => onNavigate('tickets')}>
                  <span className="info-label">Open Tickets</span>
                  <span className="info-value">{stats?.pluginsData?.tickets?.open || 0}</span>
                </div>
                <div className="info-row" style={{ cursor: 'pointer' }} onClick={() => onNavigate('email-client')}>
                  <span className="info-label">Unread Emails</span>
                  <span className="info-value">{stats?.pluginsData?.email?.unread || 0}</span>
                </div>
                <div className="info-row" style={{ cursor: 'pointer' }} onClick={() => onNavigate('economy')}>
                  <span className="info-label">Economy Balance</span>
                  <span className="info-value">{formatNumber(stats?.pluginsData?.economy?.totalBalance || 0)}</span>
                </div>
              </div>
            </div>

            {/* Lifetime Stats */}
            <div className="dashboard-card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Globe size={16} color={colors.accent} />
                <h2 style={{ margin: 0 }}>Lifetime Stats</h2>
              </div>
              <div className="card-body" style={{ padding: '16px 24px' }}>
                <div className="info-row">
                  <span className="info-label">Total Messages</span>
                  <span className="info-value">{stats ? formatNumber(stats.totals.messages) : '-'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Total Voice Time</span>
                  <span className="info-value">{stats ? `${Math.round(stats.totals.voiceMinutes / 60).toLocaleString()} hours` : '-'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Total Bans</span>
                  <span className="info-value">{stats?.totals.bans || 0}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Top Channel</span>
                  <span className="info-value">#{stats?.topChannels?.[0]?.name || '-'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Database</span>
                  <span className="info-value" style={{ color: colors.primary }}>Connected</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* Small reusable components — kept local to avoid file bloat */
const StatCard: React.FC<{ icon: LucideIcon; iconColor: string; iconBg: string; label: string; value: string }> = ({ icon: Icon, iconColor, iconBg, label, value }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ backgroundColor: iconBg }}><Icon size={20} color={iconColor} /></div>
    <div>
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value}</h3>
    </div>
  </div>
);

const StatusRow: React.FC<{ label: string; active?: boolean; onClick?: () => void }> = ({ label, active, onClick }) => (
  <div className="info-row" style={{ cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
    <span className="info-label">{label}</span>
    <span style={{
      color: active ? '#10b981' : '#ef4444',
      background: active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
      padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600
    }}>
      {active ? 'Active' : 'Off'}
    </span>
  </div>
);