import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  MessageSquare, Mail, Shield, ShieldAlert, DollarSign, UserPlus, FileText, ArrowRight, LayoutDashboard, Settings
} from 'lucide-react';
import { colors, spacing } from '../theme/theme';
import { UniversalSearch } from '../components/UniversalSearch';
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
      <div className="dashboard-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ color: colors.textPrimary, margin: 0, fontSize: '24px', fontWeight: 700 }}>
          Dashboard Overview
        </h1>
      </div>

      <div className="settings-overview-banner">
         <div className="banner-content" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
               <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                  <Shield size={22} color={colors.primary} />
               </div>
               <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em' }}>Settings Overview</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: colors.textSecondary, maxWidth: '800px' }}>Welcome back to Fuji Studio. Configure your bot identity, plugins, and moderation tools.</p>
               </div>
            </div>
         </div>
         <button 
           className="info-banner-hide-mobile"
           onClick={() => onNavigate('docs')} 
           style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)', cursor: 'pointer', color: colors.primary, fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px' }}
         >
           Docs <ArrowRight size={14} />
         </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, color: colors.textSecondary }}>Loading stats...</div>
      ) : (
        <>
          <div className="dashboard-grid-split">
             {/* Main Chart Card */}
             <div className="dashboard-card-main" style={{ minHeight: '350px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                   <div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#F8FAFC', fontWeight: 600, letterSpacing: '-0.01em' }}>Server Growth</h3>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B' }}>Analytics for the last 30 days</p>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.02em' }}>{formatNumber(stats?.totalMembers || 0)}</div>
                   </div>
                </div>
                <div style={{ height: '300px', width: '100%', minWidth: 0 }}>
                   <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart data={historyData}>
                        <defs>
                          <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="date" stroke="#64748B" axisLine={false} tickLine={false} fontSize={10} dy={10} />
                        <YAxis hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="messageCount" stroke={colors.primary} fillOpacity={1} fill="url(#colorMessages)" strokeWidth={3} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>

             {/* Recent Activity Card */}
             <div className="dashboard-card-activity">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                   <h3 style={{ margin: 0, fontSize: '15px', color: '#F8FAFC', fontWeight: 600, letterSpacing: '-0.01em' }}>Recent Activity</h3>
                   <FileText size={15} color="#64748B" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   {stats?.recentLogs && stats.recentLogs.length > 0 ? (
                    stats.recentLogs.map((log) => {
                      const getLogIcon = (pluginId: string) => {
                        switch(pluginId) {
                          case 'moderation': return <Shield size={16} />;
                          case 'word-filter': return <ShieldAlert size={16} />;
                          case 'tickets': return <MessageSquare size={16} />;
                          case 'economy': return <DollarSign size={16} />;
                          default: return <Settings size={16} />;
                        }
                      };

                      const getLogColor = (pluginId: string) => {
                        switch(pluginId) {
                          case 'moderation': return colors.primary;
                          case 'word-filter': return colors.highlight;
                          case 'tickets': return colors.info;
                          case 'economy': return colors.success;
                          default: return colors.textSecondary;
                        }
                      };

                      const timeAgo = (date: string) => {
                         const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
                         if (seconds < 60) return 'JUST NOW';
                         const minutes = Math.floor(seconds / 60);
                         if (minutes < 60) return `${minutes} MINS AGO`;
                         const hours = Math.floor(minutes / 60);
                         if (hours < 24) return `${hours} HOURS AGO`;
                         return new Date(date).toLocaleDateString();
                      };

                      return (
                        <div key={log.id} style={{ display: 'flex', gap: '12px' }}>
                           <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${getLogColor(log.pluginId)}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getLogColor(log.pluginId), flexShrink: 0 }}>
                              {getLogIcon(log.pluginId)}
                           </div>
                           <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: '13px', fontWeight: 500, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                 {log.action.replace(/_/g, ' ').toUpperCase()}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                 By {log.executorName} via {log.pluginId}
                              </div>
                              <div style={{ fontSize: '10px', color: '#64748B' }}>{timeAgo(log.createdAt)}</div>
                           </div>
                        </div>
                      );
                    })
                   ) : (
                     <div style={{ textAlign: 'center', padding: '20px', color: colors.textSecondary, fontSize: '13px' }}>
                        No recent activity found.
                     </div>
                   )}
                </div>
                <button 
                  onClick={() => onNavigate('logs')}
                  style={{ width: '100%', marginTop: '20px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '10px', padding: '10px', color: colors.primary, fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  View All Logs
                </button>
             </div>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid" style={{ marginTop: '32px' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                <MessageSquare size={20} color={colors.highlight} />
              </div>
              <div>
                <p className="stat-label">Messages 24h</p>
                <h3 className="stat-value">{formatNumber(stats?.today?.messageCount || 0)}</h3>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'rgba(0, 208, 132, 0.1)' }}>
                <div style={{ width: 20, height: 20, border: `2px solid ${colors.success}`, borderRadius: '4px' }} />
              </div>
              <div>
                <p className="stat-label">Voice 24h</p>
                <h3 className="stat-value">
                  {Math.round((stats?.today?.voiceMinutes || 0) / 60 * 10) / 10}h
                </h3>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <UserPlus size={20} color={colors.primary} />
              </div>
              <div>
                <p className="stat-label">People Online</p>
                <h3 className="stat-value">{stats ? formatNumber(stats.activeMembers) : '-'}</h3>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
                <UserPlus size={20} color={colors.info} />
              </div>
              <div>
                <p className="stat-label">Total Users</p>
                <h3 className="stat-value">{stats ? formatNumber(stats.totalMembers) : '-'}</h3>
              </div>
            </div>
          </div>

          {/* Unified Charts Section */}
          <div style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
            <div className="dashboard-card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <h2 style={{ margin: 0 }}>Activity Overview</h2>
                <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '3px' }}>
                  <button 
                    onClick={() => setActiveChartTab('messages')}
                    style={{
                      background: activeChartTab === 'messages' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      color: activeChartTab === 'messages' ? colors.primary : colors.textTertiary,
                      border: activeChartTab === 'messages' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid transparent',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Messages
                  </button>
                  <button 
                    onClick={() => setActiveChartTab('voice')}
                    style={{
                      background: activeChartTab === 'voice' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      color: activeChartTab === 'voice' ? colors.primary : colors.textTertiary,
                      border: activeChartTab === 'voice' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid transparent',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Voice
                  </button>
                  <button 
                    onClick={() => setActiveChartTab('channels')}
                    style={{
                      background: activeChartTab === 'channels' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      color: activeChartTab === 'channels' ? colors.primary : colors.textTertiary,
                      border: activeChartTab === 'channels' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid transparent',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Top Channels
                  </button>
                </div>
              </div>
              
              <div className="card-body" style={{ height: '400px', padding: '24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {activeChartTab === 'messages' ? (
                    <AreaChart data={historyData}>
                      <defs>
                        <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke={colors.textSecondary} 
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        stroke={colors.textSecondary} 
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: colors.surfaceLight, 
                          border: `1px solid ${colors.border}`, 
                          borderRadius: '8px',
                          color: colors.textPrimary,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}
                        itemStyle={{ color: colors.textPrimary }}
                        cursor={{ stroke: colors.textTertiary, strokeDasharray: '3 3' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="messageCount" 
                        stroke={colors.primary} 
                        strokeWidth={3}
                        fill="url(#colorMessages)" 
                        name="Messages" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  ) : activeChartTab === 'voice' ? (
                    <BarChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke={colors.textSecondary}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        stroke={colors.textSecondary} 
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: colors.surfaceLight, 
                          border: `1px solid ${colors.border}`, 
                          borderRadius: '8px',
                          color: colors.textPrimary,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}
                        itemStyle={{ color: colors.textPrimary }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                      <Bar 
                        dataKey="voiceHours" 
                        fill={colors.highlight} 
                        name="Voice Hours" 
                        radius={[6, 6, 0, 0]}
                        animationDuration={1500} 
                      />
                    </BarChart>
                  ) : (
                    <BarChart 
                      data={stats?.topChannels} 
                      layout="vertical" 
                      margin={{ left: 40, right: 40, top: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
                      <XAxis type="number" stroke={colors.textSecondary} axisLine={false} tickLine={false} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        stroke={colors.textSecondary} 
                        width={120} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                        contentStyle={{ 
                          backgroundColor: colors.surfaceLight, 
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          color: colors.textPrimary
                        }} 
                      />
                      <Bar 
                        dataKey="messages" 
                        fill={colors.accent} 
                        radius={[0, 4, 4, 0]} 
                        name="Messages" 
                        barSize={32}
                        animationDuration={1500}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Plugins & Modules Overview */}
          <div className="dashboard-grid" style={{ marginTop: spacing.xl }}>
            
            {/* Plugins Grid (Replaces old Quick Actions) */}
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                
                {/* Email Client */}
                <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                             <Mail size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Email Client</h3>
                    </div>
                    {stats?.pluginsData?.email?.unread ? (
                        <div style={{ padding: '4px 8px', borderRadius: '12px', background: colors.primary, color: 'white', fontSize: '12px', fontWeight: 600 }}>
                            {stats?.pluginsData?.email?.unread} New
                        </div>
                    ) : null }
                  </div>
                  <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', padding: '24px' }}>
                        <div style={{ fontSize: '26px', fontWeight: 700, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
                            {stats?.pluginsData?.email?.unread || 0}
                        </div>
                        <div style={{ color: colors.textTertiary, fontSize: '13px' }}>Unread emails</div>
                  </div>
                  <div onClick={() => onNavigate('email-client')} style={{ padding: '16px 24px', borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: colors.primaryLight, cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}>
                      Open Inbox <ArrowRight size={16} />
                  </div>
                </div>

                {/* Ticket System */}
                <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                             <MessageSquare size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Support Tickets</h3>
                    </div>
                  </div>
                  <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', padding: '24px' }}>
                        <div style={{ fontSize: '26px', fontWeight: 700, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
                            {stats?.pluginsData?.tickets?.open || 0}
                        </div>
                        <div style={{ color: colors.textTertiary, fontSize: '13px' }}>Open tickets</div>
                  </div>
                  <div onClick={() => onNavigate('tickets')} style={{ padding: '16px 24px', borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: colors.primaryLight, cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}>
                      Manage Tickets <ArrowRight size={16} />
                  </div>
                </div>

                {/* Economy System */}
                <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                             <DollarSign size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Economy</h3>
                    </div>
                  </div>
                  <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', padding: '24px' }}>
                        <div style={{ fontSize: '26px', fontWeight: 700, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
                           {formatNumber(stats?.pluginsData?.economy?.totalBalance || 0)}
                        </div>
                        <div style={{ color: colors.textTertiary, fontSize: '13px' }}>Total currency in circulation</div>
                  </div>
                  <div onClick={() => onNavigate('economy')} style={{ padding: '16px 24px', borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: colors.primaryLight, cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}>
                      View Economy <ArrowRight size={16} />
                  </div>
                </div>
                
                {/* Security (Word Filter + Welcome Gate) */}
                <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                             <Shield size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Security & Gate</h3>
                    </div>
                  </div>
                  <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                           <span style={{ color: colors.textSecondary }}>Word Filter</span>
                           <span style={{ 
                               color: stats?.pluginsData?.filter?.enabled ? '#10b981' : '#ef4444', 
                               background: stats?.pluginsData?.filter?.enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                               padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600
                            }}>
                               {stats?.pluginsData?.filter?.enabled ? 'ACTIVE' : 'OFF'}
                           </span>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                           <span style={{ color: colors.textSecondary }}>Welcome Gate</span>
                           <span style={{ 
                               color: stats?.pluginsData?.welcome?.enabled ? '#10b981' : '#ef4444', 
                               background: stats?.pluginsData?.welcome?.enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                               padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600
                            }}>
                               {stats?.pluginsData?.welcome?.enabled ? 'ACTIVE' : 'OFF'}
                           </span>
                       </div>
                  </div>
                  <div style={{ padding: '12px 24px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '12px' }}>
                        <div onClick={() => onNavigate('word-filter-settings')} style={{ color: colors.textSecondary, cursor: 'pointer', fontSize: '12px', fontWeight: 500, flex: 1, textAlign: 'center' }}>Word Filter</div>
                        <div style={{ width: 1, background: colors.border }}></div>
                        <div onClick={() => onNavigate('welcome-gate')} style={{ color: colors.textSecondary, cursor: 'pointer', fontSize: '12px', fontWeight: 500, flex: 1, textAlign: 'center' }}>Welcome Gate</div>
                  </div>
                </div>

            </div>

            {/* Top Channels List (as fallback or secondary view) */}
            <div className="dashboard-card">
              <div className="card-header">
                <h2>Top Channels List</h2>
              </div>
              <div className="card-body">
                {(stats?.topChannels || []).length === 0 ? (
                    <p style={{ color: colors.textSecondary }}>No activity recorded yet.</p>
                ) : (
                    (stats?.topChannels || []).slice(0, 5).map((channel, i) => (
                        <div key={i} className="activity-item">
                          <div className="activity-dot" style={{ backgroundColor: i < 3 ? colors.accent : colors.textTertiary }}></div>
                          <div className="activity-content">
                            <p className="activity-title">#{channel.name}</p>
                            <p className="activity-time">{formatNumber(channel.messages)} msgs</p>
                          </div>
                        </div>
                    ))
                )}
              </div>
            </div>

            {/* Lifetime Overview */}
            <div className="dashboard-card">
              <div className="card-header">
                <h2>Lifetime Overview</h2>
              </div>
              <div className="card-body">
                <div className="info-row">
                  <span className="info-label">Total Messages</span>
                  <span className="info-value">{stats ? formatNumber(stats.totals.messages) : '-'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Total Voice Time</span>
                  <span className="info-value">{stats ? Math.round(stats.totals.voiceMinutes / 60) : '-'} hours</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Total Bans Recorded</span>
                  <span className="info-value">{stats?.totals.bans || 0}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Database Status</span>
                  <span className="info-value" style={{ color: '#10B981' }}>Connected</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


