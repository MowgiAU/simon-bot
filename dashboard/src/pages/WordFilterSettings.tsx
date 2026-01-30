import React, { useState, useEffect } from 'react';
import { colors, spacing } from '../theme/theme';
import './WordFilterSettings.css';

interface WordGroup {
  id: string;
  name: string;
  replacementText?: string;
  replacementEmoji?: string;
  useEmoji: boolean;
  enabled?: boolean;
  words: { id: string; word: string }[];
}

interface FilterSettings {
  id?: string;
  guildId?: string;
  enabled: boolean;
  repostEnabled: boolean;
  excludedChannels: string[];
  excludedRoles: string[];
}

const API_BASE = '/api/word-filter';

interface Props {
  guildId: string;
}

export const WordFilterSettings: React.FC<Props> = ({ guildId }) => {
  const [settings, setSettings] = useState<FilterSettings>({
    enabled: true,
    repostEnabled: true,
    excludedChannels: [],
    excludedRoles: [],
  });

  const [wordGroups, setWordGroups] = useState<WordGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [newWord, setNewWord] = useState('');
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupReplacement, setEditingGroupReplacement] = useState('');
  const [editingGroupUseEmoji, setEditingGroupUseEmoji] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load settings from API on mount or when guildId changes
  useEffect(() => {
    if (!guildId) return;
    loadSettings(guildId);
    // eslint-disable-next-line
  }, [guildId]);

  const loadSettings = async (gid: string) => {
    try {
      setLoading(true);
      setError(null);
      const startTime = performance.now();
      const response = await fetch(`${API_BASE}/settings/${gid}`, {
        signal: AbortSignal.timeout(10000),
        credentials: 'include',
      });
      const endTime = performance.now();
      console.log(`Word Filter API response time: ${(endTime - startTime).toFixed(0)}ms`);
      
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      setSettings({
        enabled: data.enabled,
        repostEnabled: data.repostEnabled,
        excludedChannels: data.excludedChannels || [],
        excludedRoles: data.excludedRoles || [],
      });
      setWordGroups(data.wordGroups || []);
    } catch (err) {
      console.error('Failed to load settings from API', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load settings from server: ${msg}. Using cached data.`);
      // Fallback to localStorage
      const savedGroups = localStorage.getItem('wordGroups');
      const savedSettings = localStorage.getItem('filterSettings');
      if (savedGroups) {
        try { setWordGroups(JSON.parse(savedGroups)); } catch (e) { console.error('Failed to parse saved word groups', e); }
      }
      if (savedSettings) {
        try { setSettings(JSON.parse(savedSettings)); } catch (e) { console.error('Failed to parse saved settings', e); }
      }
    } finally {
      setLoading(false);
    }
  };

  const logger = {
    error: (msg: string, err: any) => console.error(msg, err),
    info: (msg: string) => console.log(msg),
  };

  const handleSettingChange = (key: keyof FilterSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    try {
      setError(null);
      setSaveMessage(null);
      const response = await fetch(`${API_BASE}/settings/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          repostEnabled: settings.repostEnabled,
          excludedChannels: settings.excludedChannels,
          excludedRoles: settings.excludedRoles,
        }),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError('Failed to save settings');
      logger.error('Error saving settings', err);
    }
  };

  const addWordGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/groups/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName,
          replacementText: '[FILTERED]',
          useEmoji: false,
        }),
      });
      if (!response.ok) throw new Error('Failed to create group');
      const newGroup = await response.json();
      setWordGroups(prev => [...prev, { ...newGroup, words: [] }]);
      setNewGroupName('');
      setShowNewGroup(false);
    } catch (err) {
      setError('Failed to create word group');
      logger.error('Error creating group', err);
    }
  };

  const openEditGroup = (group: WordGroup) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setEditingGroupReplacement(group.replacementText || group.replacementEmoji || '');
    setEditingGroupUseEmoji(group.useEmoji);
    setNewWord('');
  };

  const closeEditGroup = () => {
    setEditingGroupId(null);
    setNewWord('');
  };

  const addWordToGroup = async (groupId: string) => {
    if (!newWord.trim()) return;

    try {
      setError(null);
      const response = await fetch(`${API_BASE}/groups/${guildId}/${groupId}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }
      
      const updatedWords = await response.json();
      setWordGroups(prev =>
        prev.map(group => {
          if (group.id === groupId) {
            return {
              ...group,
              words: updatedWords
            };
          }
          return group;
        })
      );
      setNewWord('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to add word(s): ${msg}`);
      logger.error('Error adding word', err);
    }
  };

  const removeWordFromGroup = async (groupId: string, wordId: string) => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/groups/${guildId}/${groupId}/words/${wordId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }
      
      setWordGroups(prev =>
        prev.map(group => {
          if (group.id === groupId) {
            return {
              ...group,
              words: group.words.filter(w => w.id !== wordId)
            };
          }
          return group;
        })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to remove word: ${msg}`);
      logger.error('Error removing word', err);
    }
  };

  const toggleGroupEnabled = async (groupId: string, enabled: boolean) => {
    try {
      setError(null);
      // We recycle the update endpoint, just passing the new enabled status
      // Note: In a real app we might want a PATCH endpoint or ensure we send all other fields 
      // Current API implementation validates and updates what is sent. 
      // Since `updateGroup` logic in UI state holds "editing" values, we need to be careful.
      // Easiest is to find current group, and send its values + new enabled.
      
      const group = wordGroups.find(g => g.id === groupId);
      if (!group) return;

      const response = await fetch(`${API_BASE}/groups/${guildId}/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: group.name,
          replacementText: group.replacementText,
          replacementEmoji: group.replacementEmoji,
          useEmoji: group.useEmoji,
          enabled: enabled
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }
      
      const updated = await response.json();
      setWordGroups(prev =>
        prev.map(g => {
          if (g.id === groupId) {
            return { ...g, ...updated };
          }
          return g;
        })
      );
    } catch (err) {
       const msg = err instanceof Error ? err.message : 'Unknown error';
       setError(`Failed to toggle group: ${msg}`);
       logger.error('Error toggling group', err);
    }
  };

  const updateGroup = async (groupId: string) => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/groups/${guildId}/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingGroupName,
          replacementText: editingGroupUseEmoji ? undefined : editingGroupReplacement,
          replacementEmoji: editingGroupUseEmoji ? editingGroupReplacement : undefined,
          useEmoji: editingGroupUseEmoji,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }
      
      const updated = await response.json();
      setWordGroups(prev =>
        prev.map(group => {
          if (group.id === groupId) {
            return { ...group, ...updated };
          }
          return group;
        })
      );
      closeEditGroup();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to update word group: ${msg}`);
      logger.error('Error updating group', err);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/groups/${guildId}/${groupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }
      
      setWordGroups(prev => prev.filter(g => g.id !== groupId));
      closeEditGroup();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete word group: ${msg}`);
      logger.error('Error deleting group', err);
    }
  };

  return (
    <div className="word-filter-settings">
      {error && <div className="error-banner">{error}</div>}
      {saveMessage && <div className="success-banner">{saveMessage}</div>}
      
      <div className="settings-header">
        <h2>Word Filter Settings</h2>
        <p className="description">Configure message filtering and word replacement</p>
      </div>

      {loading ? (
        <p style={{ color: '#8a8d93', padding: '32px', textAlign: 'center' }}>Loading settings...</p>
      ) : (
        <>
          {/* Global Settings Section */}
          <div className="settings-section">
            <h3>Global Settings</h3>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={e => handleSettingChange('enabled', e.target.checked)}
                />
                <span>Enable Word Filter</span>
              </label>
              <p className="setting-description">Enable/disable the word filter for this server</p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.repostEnabled}
                  onChange={e => handleSettingChange('repostEnabled', e.target.checked)}
                />
                <span>Repost Filtered Messages</span>
              </label>
              <p className="setting-description">Repost messages with filtered words replaced</p>
            </div>

            <div className="setting-item">
              <label className="setting-label">Excluded Channels</label>
              <div className="channel-list">
                <p className="placeholder">No excluded channels</p>
              </div>
            </div>

            <div className="setting-item">
              <label className="setting-label">Excluded Roles</label>
              <div className="role-list">
                <p className="placeholder">No excluded roles</p>
              </div>
            </div>
          </div>

      {/* Word Groups Section */}
      <div className="settings-section">
        <div className="section-header">
          <h3>Word Groups</h3>
          <button
            className="btn-primary"
            onClick={() => setShowNewGroup(true)}
          >
            + Add Group
          </button>
        </div>

        {showNewGroup && (
          <div className="new-group-form">
            <input
              type="text"
              placeholder="Group name (e.g., Slurs, Spam)"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="input-field"
              onKeyPress={e => e.key === 'Enter' && addWordGroup()}
            />
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowNewGroup(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={addWordGroup}>
                Create Group
              </button>
            </div>
          </div>
        )}

        <div className="word-groups-list">
          {wordGroups.length === 0 ? (
            <p className="empty-state">No word groups yet. Create one to get started!</p>
          ) : (
            wordGroups.map(group => (
              <div key={group.id} className="word-group-card">
                {editingGroupId === group.id ? (
                  // Edit Mode
                  <div className="group-edit-form">
                    <input
                      type="text"
                      value={editingGroupName}
                      onChange={e => setEditingGroupName(e.target.value)}
                      className="input-field input-sm"
                      placeholder="Group name"
                    />

                    <div className="setting-item">
                      <label className="setting-label">
                        <input
                          type="checkbox"
                          checked={editingGroupUseEmoji}
                          onChange={e => setEditingGroupUseEmoji(e.target.checked)}
                        />
                        <span>Use Emoji Replacement</span>
                      </label>
                    </div>

                    <input
                      type="text"
                      value={editingGroupReplacement}
                      onChange={e => setEditingGroupReplacement(e.target.value)}
                      className="input-field input-sm"
                      placeholder={editingGroupUseEmoji ? 'Emoji (e.g., 🤐)' : 'Replacement text (e.g., [FILTERED])'}
                    />

                    <div className="word-input-group">
                      <input
                        type="text"
                        value={newWord}
                        onChange={e => setNewWord(e.target.value)}
                        className="input-field input-sm"
                        placeholder="Add word(s) - e.g. apple, banana, cherry"
                        onKeyPress={e => e.key === 'Enter' && addWordToGroup(group.id)}
                      />
                      <button 
                        className="btn-primary btn-sm"
                        onClick={() => addWordToGroup(group.id)}
                      >
                        Add Word(s)
                      </button>
                    </div>

                    {group.words.length > 0 && (
                      <div className="words-list">
                        <label className="label-text">Words in this group:</label>
                        {group.words.map(w => (
                          <div key={w.id} className="word-tag">
                            <span>{w.word}</span>
                            <button
                              className="btn-remove"
                              onClick={() => removeWordFromGroup(group.id, w.id)}
                              title="Remove word"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="form-actions">
                      <button className="btn-secondary btn-sm" onClick={closeEditGroup}>
                        Cancel
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => deleteGroup(group.id)}>
                        Delete Group
                      </button>
                      <button className="btn-primary btn-sm" onClick={() => updateGroup(group.id)}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="group-header">
                      <div className="header-left">
                        <h4>{group.name}</h4>
                        <span className="word-count">{group.words.length} words</span>
                      </div>
                      <div className="header-right">
                         <label className="toggle-switch small-toggle">
                            <input
                              type="checkbox"
                              checked={group.enabled !== false}
                              onChange={(e) => toggleGroupEnabled(group.id, e.target.checked)}
                            />
                            <span className="slider round"></span>
                         </label>
                      </div>
                    </div>
                    <p className="replacement">
                      Replacement: {group.useEmoji ? group.replacementEmoji : group.replacementText}
                    </p>
                    {group.words.length > 0 && (
                      <div className="words-preview">
                        {group.words.slice(0, 3).map(w => (
                          <span key={w.id} className="word-badge">{w.word}</span>
                        ))}
                        {group.words.length > 3 && (
                          <span className="word-badge">+{group.words.length - 3} more</span>
                        )}
                      </div>
                    )}
                    <button 
                      className="btn-secondary btn-sm"
                      onClick={() => openEditGroup(group)}
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="settings-footer">
        <button className="btn-primary btn-lg" onClick={saveSettings}>
          Save Changes
        </button>
      </div>
        </>
      )}
    </div>
  );
};
