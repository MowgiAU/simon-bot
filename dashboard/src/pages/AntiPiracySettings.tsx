import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ChannelSelect } from '../components/ChannelSelect';
import { RoleSelect } from '../components/RoleSelect';
import { ShieldOff } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';
import './AntiPiracySettings.css';

interface AntiPiracySettingsData {
  id?: string;
  guildId?: string;
  enabled: boolean;
  aiEnabled: boolean;
  actionType: string;
  reminderMessage: string;
  excludedChannels: string[];
  excludedRoles: string[];
  customKeywords: string[];
}

interface LogEntry {
  id: string;
  action: string;
  executorId: string;
  targetId: string;
  details: any;
  createdAt: string;
}

const API_BASE = '/api/anti-piracy';

interface Props {
  guildId: string;
}

export const AntiPiracySettings: React.FC<Props> = ({ guildId }) => {
  const isMobile = useMobile();
  const [settings, setSettings] = useState<AntiPiracySettingsData>({
    enabled: true,
    aiEnabled: true,
    actionType: 'delete_and_warn',
    reminderMessage: 'Piracy discussion is not allowed in this server. Please support developers by purchasing software legally.',
    excludedChannels: [],
    excludedRoles: [],
    customKeywords: [],
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    const controller = new AbortController();
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [settingsRes, logsRes] = await Promise.all([
          fetch(`${API_BASE}/settings/${guildId}`, { signal: controller.signal, credentials: 'include' }),
          fetch(`${API_BASE}/logs/${guildId}`, { signal: controller.signal, credentials: 'include' }),
        ]);

        if (!isMounted) return;

        if (!settingsRes.ok) throw new Error(`Failed to load settings (${settingsRes.status})`);
        const settingsData = await settingsRes.json();
        setSettings({
          enabled: settingsData.enabled,
          aiEnabled: settingsData.aiEnabled,
          actionType: settingsData.actionType,
          reminderMessage: settingsData.reminderMessage,
          excludedChannels: settingsData.excludedChannels || [],
          excludedRoles: settingsData.excludedRoles || [],
          customKeywords: settingsData.customKeywords || [],
        });

        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogs(logsData);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (isMounted) setError(err.message || 'Failed to load settings');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [guildId]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveMessage(null);

      const res = await fetch(`${API_BASE}/settings/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error(`Failed to save settings (${res.status})`);

      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    const keyword = newKeyword.trim().toLowerCase();
    if (!keyword) return;
    if (settings.customKeywords.includes(keyword)) {
      setError('Keyword already exists');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setSettings(prev => ({ ...prev, customKeywords: [...prev.customKeywords, keyword] }));
    setNewKeyword('');
  };

  const removeKeyword = (keyword: string) => {
    setSettings(prev => ({
      ...prev,
      customKeywords: prev.customKeywords.filter(k => k !== keyword),
    }));
  };

  if (loading) {
    return (
      <div className="anti-piracy-settings">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.textSecondary }}>
          Loading anti-piracy settings...
        </div>
      </div>
    );
  }

  return (
    <div className="anti-piracy-settings">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <ShieldOff size={32} color={colors.primary} style={{ marginRight: '16px' }} />
        <div>
          <h1 style={{ margin: 0 }}>Anti-Piracy</h1>
          <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
            Detect and moderate software piracy discussion in your server
          </p>
        </div>
      </div>

      {/* Explanation Block */}
      <div className="settings-explanation" style={{
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        borderLeft: `4px solid ${colors.primary}`,
      }}>
        <p style={{ margin: 0, color: colors.textPrimary }}>
          This plugin monitors messages for software piracy discussion — especially related to
          FL Studio, DAW plugins, and sample packs. It uses keyword detection and optional AI
          analysis to distinguish between legitimate discussion about piracy (news, ethics, condemning it)
          and actual piracy advocacy (sharing cracks, links, instructions). Only messages that advocate
          or facilitate piracy are acted upon.
        </p>
      </div>

      {error && <div className="ap-error-banner">{error}</div>}
      {saveMessage && <div className="ap-success-banner">{saveMessage}</div>}

      {/* General Settings */}
      <div className="ap-section">
        <h3>General Settings</h3>

        <div className="ap-setting-item">
          <label className="ap-setting-label">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={e => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            Enable Anti-Piracy Protection
          </label>
          <p className="ap-setting-description">
            When enabled, messages will be scanned for piracy-related content.
          </p>
        </div>

        <div className="ap-setting-item">
          <label className="ap-setting-label">
            <input
              type="checkbox"
              checked={settings.aiEnabled}
              onChange={e => setSettings(prev => ({ ...prev, aiEnabled: e.target.checked }))}
            />
            AI-Powered Detection
          </label>
          <p className="ap-setting-description">
            Use AI to intelligently classify messages. Without AI, the system relies only on keyword matching
            heuristics which may produce more false positives. AI costs ~$0.001 per flagged message.
          </p>
        </div>

        <div className="ap-setting-item">
          <label className="ap-setting-label" style={{ cursor: 'default' }}>
            Action Type
          </label>
          <p className="ap-setting-description" style={{ marginLeft: 0, marginBottom: '8px' }}>
            What should happen when a piracy violation is detected?
          </p>
          <select
            className="ap-select"
            value={settings.actionType}
            onChange={e => setSettings(prev => ({ ...prev, actionType: e.target.value }))}
          >
            <option value="warn">Warn Only (post reminder message)</option>
            <option value="delete">Delete Only (silently remove message)</option>
            <option value="delete_and_warn">Delete & Warn (remove + post reminder)</option>
          </select>
        </div>

        <div className="ap-setting-item">
          <label className="ap-setting-label" style={{ cursor: 'default' }}>
            Reminder Message
          </label>
          <p className="ap-setting-description" style={{ marginLeft: 0, marginBottom: '0' }}>
            The message shown when a piracy violation is detected. This appears as an embed in the channel
            and auto-deletes after 15 seconds.
          </p>
          <textarea
            className="ap-textarea"
            value={settings.reminderMessage}
            onChange={e => setSettings(prev => ({ ...prev, reminderMessage: e.target.value }))}
            placeholder="Enter reminder message..."
          />
        </div>
      </div>

      {/* Exclusions */}
      <div className="ap-section">
        <h3>Exclusions</h3>

        <div className="ap-setting-item">
          <label className="ap-setting-label" style={{ cursor: 'default' }}>
            Excluded Channels
          </label>
          <p className="ap-setting-description" style={{ marginLeft: 0 }}>
            Messages in these channels will not be scanned.
          </p>
          <div className="ap-channel-list">
            <ChannelSelect
              guildId={guildId}
              value={settings.excludedChannels}
              onChange={channels => setSettings(prev => ({ ...prev, excludedChannels: Array.isArray(channels) ? channels : [channels] }))}
              multiple
            />
          </div>
        </div>

        <div className="ap-setting-item">
          <label className="ap-setting-label" style={{ cursor: 'default' }}>
            Excluded Roles
          </label>
          <p className="ap-setting-description" style={{ marginLeft: 0 }}>
            Members with these roles will not have their messages scanned.
          </p>
          <div className="ap-role-list">
            <RoleSelect
              guildId={guildId}
              value={settings.excludedRoles}
              onChange={roles => setSettings(prev => ({ ...prev, excludedRoles: Array.isArray(roles) ? roles : [roles] }))}
              multiple
            />
          </div>
        </div>
      </div>

      {/* Custom Keywords */}
      <div className="ap-section">
        <h3>Custom Keywords</h3>
        <p className="ap-setting-description" style={{ marginLeft: 0, marginBottom: '16px' }}>
          Add additional keywords to trigger piracy detection. The built-in list already covers common
          terms like &quot;crack&quot;, &quot;keygen&quot;, &quot;torrent&quot;, &quot;warez&quot;, etc.
          Use this for server-specific terms.
        </p>

        <div className="ap-keywords-list">
          <div className="ap-keyword-input-group">
            <input
              className="ap-input"
              type="text"
              placeholder="Add a custom keyword..."
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
            />
            <button className="ap-btn-primary" onClick={addKeyword}>Add</button>
          </div>

          {settings.customKeywords.length > 0 ? (
            <div className="ap-keyword-tags">
              {settings.customKeywords.map(kw => (
                <span key={kw} className="ap-keyword-tag">
                  {kw}
                  <button onClick={() => removeKeyword(kw)}>&times;</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="ap-placeholder">No custom keywords added. Built-in keywords are always active.</p>
          )}
        </div>
      </div>

      {/* Recent Detections */}
      <div className="ap-section">
        <h3>Recent Detections</h3>

        {logs.length > 0 ? (
          <div className="ap-log-list">
            {logs.slice(0, 20).map(log => {
              const details = log.details || {};
              return (
                <div key={log.id} className="ap-log-item">
                  <div className="ap-log-header">
                    <span className="ap-log-user">
                      {details.authorTag || `User ${log.executorId}`}
                    </span>
                    <span className="ap-log-time">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="ap-log-content">
                    {details.originalContent
                      ? (details.originalContent.length > 200
                          ? details.originalContent.substring(0, 200) + '...'
                          : details.originalContent)
                      : 'Content not available'}
                  </div>
                  <div className="ap-log-meta">
                    <span className="ap-log-badge">{details.actionTaken || log.action}</span>
                    {details.aiVerdict && (
                      <span className={`ap-log-badge ${details.aiVerdict === 'SAFE' ? 'safe' : ''}`}>
                        AI: {details.aiVerdict} ({Math.round((details.aiConfidence || 0) * 100)}%)
                      </span>
                    )}
                    {details.matchedKeywords && (
                      <span className="ap-log-badge" style={{ backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#EAB308' }}>
                        Keywords: {details.matchedKeywords.join(', ')}
                      </span>
                    )}
                  </div>
                  {details.aiReason && (
                    <div className="ap-log-content" style={{ marginTop: '6px', fontStyle: 'italic', fontSize: '12px' }}>
                      {details.aiReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ap-empty-state">
            No piracy detections yet. The system is monitoring messages.
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="ap-footer">
        <button className="ap-btn-primary" onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};
