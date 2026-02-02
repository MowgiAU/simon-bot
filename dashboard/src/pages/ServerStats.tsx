import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { colors, spacing, typography } from '../theme/theme';
import { useMobile } from '../hooks/useMobile';

interface ServerStatsData {
  history: Array<{
    date: string;
    messageCount: number;
    voiceMinutes: number;
    newBans: number;
    memberCount: number;
  }>;
  topChannels: Array<{
    name: string;
    messages: number;
  }>;
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
}

interface Props {
  guildId: string;
}

const API_BASE = '/api';

export const ServerStats: React.FC<Props> = ({ guildId }) => {
  const isMobile = useMobile();
  const [data, setData] = useState<ServerStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [guildId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/guilds/${guildId}/stats`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError('Could not load server statistics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: spacing.xl, color: colors.textSecondary }}>Loading stats...</div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  // Format dates for charts
  const historyData = data.history.map(h => ({
    ...h,
    date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    voiceHours: Math.round((h.voiceMinutes / 60) * 10) / 10
  }));

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num);

  return (
    <div style={{ padding: isMobile ? spacing.md : spacing.xl, maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xl }}>Server Statistics</h2>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.lg, marginBottom: spacing.xl }}>
        <StatCard title="Total Members" value={data.totalMembers} subtitle={`${data.activeMembers} active (24h)`} color={colors.primary} />
        <StatCard title="Total Messages" value={data.totals.messages} subtitle="Tracked lifetime" color={colors.accent} />
        <StatCard title="Voice Time" value={`${Math.round(data.totals.voiceMinutes / 60)}h`} subtitle="Tracked lifetime" color={colors.highlight} />
        <StatCard title="Bans" value={data.totals.bans} subtitle="Total bans" color="#e74c3c" />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(500px, 1fr))', gap: spacing.xl }}>
        
        {/* Message Activity */}
        <ChartContainer title="Message Activity (30 Days)">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke={colors.textSecondary} />
              <YAxis stroke={colors.textSecondary} />
              <Tooltip 
                contentStyle={{ backgroundColor: colors.surface, border: 'none', color: colors.textPrimary }}
                itemStyle={{ color: colors.textPrimary }} 
              />
              <Area type="monotone" dataKey="messageCount" stroke={colors.primary} fill={colors.primary} fillOpacity={0.3} name="Messages" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Voice Activity */}
        <ChartContainer title="Voice Activity (Attributes in Hours)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke={colors.textSecondary} />
              <YAxis stroke={colors.textSecondary} />
              <Tooltip 
                contentStyle={{ backgroundColor: colors.surface, border: 'none', color: colors.textPrimary }}
              />
              <Bar dataKey="voiceHours" fill={colors.highlight} name="Voice Hours" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Top Channels */}
        <ChartContainer title="Most Active Channels (7 Days)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.topChannels} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
              <XAxis type="number" stroke={colors.textSecondary} />
              <YAxis dataKey="name" type="category" stroke={colors.textSecondary} width={100} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: colors.surface, border: 'none' }} />
              <Bar dataKey="messages" fill={colors.accent} radius={[0, 4, 4, 0]} name="Messages" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, color }: { title: string, value: string | number, subtitle?: string, color: string }) => (
  <div style={{ 
    backgroundColor: colors.surface, 
    padding: spacing.lg, 
    borderRadius: '8px', 
    border: `1px solid ${colors.border}`,
    borderLeft: `4px solid ${color}`
  }}>
    <h3 style={{ fontSize: '14px', color: colors.textSecondary, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
    <div style={{ fontSize: '28px', fontWeight: 'bold', color: colors.textPrimary, marginBottom: '4px' }}>{value}</div>
    {subtitle && <div style={{ fontSize: '12px', color: colors.textSecondary }}>{subtitle}</div>}
  </div>
);

const ChartContainer = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
    <h3 style={{ color: colors.textPrimary, marginBottom: spacing.lg, fontSize: '16px' }}>{title}</h3>
    {children}
  </div>
);
