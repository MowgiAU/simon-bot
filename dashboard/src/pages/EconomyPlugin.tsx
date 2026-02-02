import React, { useEffect, useState, useRef } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useAuth } from '../components/AuthProvider';
import axios from 'axios';
import { Coins, ShoppingBag, Vault, Save, Edit, Trash2, Plus, User as UserIcon, Smile, X } from 'lucide-react';
import { HybridEmojiPicker } from '../components/HybridEmojiPicker';

export const EconomyPluginPage: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [activeTab, setActiveTab] = useState<'settings' | 'inventory' | 'vault'>('settings');
    
    // Data State
    const [settings, setSettings] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetching
    const refreshData = async () => {
        if (!selectedGuild) return;
        setLoading(true);
        try {
            const [setRes, itemRes] = await Promise.all([
                axios.get(`/api/economy/settings/${selectedGuild.id}`, { withCredentials: true }),
                axios.get(`/api/economy/items/${selectedGuild.id}`, { withCredentials: true })
            ]);
            setSettings(setRes.data);
            setItems(itemRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [selectedGuild]);

    // Save Settings
    const saveSettings = async (newData: any) => {
        if (!selectedGuild) return;
        try {
            await axios.post(`/api/economy/settings/${selectedGuild.id}`, newData, { withCredentials: true });
            setSettings(newData);
            alert('Settings saved!');
        } catch (e) {
            console.error(e);
            alert('Failed to save settings.');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Coins size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                <div>
                    <h1 style={{ margin: 0 }}>Economy Manager</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Manage currency, shop items, and user balances.</p>
                </div>
            </div>

            <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                 <p style={{ margin: 0, color: colors.textPrimary }}>Create a virtual economy for your server. Configure currency symbols, passive earning rates per message, and manage a shop where users can buy roles or items with their earned coins.</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                {[
                    { id: 'settings', label: 'Settings', icon: <Coins size={18} /> },
                    { id: 'inventory', label: 'Inventory (Shop)', icon: <ShoppingBag size={18} /> },
                    { id: 'vault', label: 'Vault (Balances)', icon: <Vault size={18} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            padding: '10px 20px',
                            background: activeTab === tab.id ? colors.primary : colors.surface,
                            color: 'white',
                            border: 'none',
                            borderRadius: borderRadius.md,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ background: colors.surface, padding: '24px', borderRadius: borderRadius.lg }}>
                {activeTab === 'settings' && settings && (
                    <SettingsTab settings={settings} onSave={saveSettings} guildId={selectedGuild?.id} />
                )}
                {activeTab === 'inventory' && (
                    <InventoryTab items={items} refresh={refreshData} guildId={selectedGuild?.id || ''} currency={settings?.currencyEmoji} />
                )}
                {activeTab === 'vault' && (
                    <VaultTab guildId={selectedGuild?.id || ''} currency={settings?.currencyEmoji} />
                )}
            </div>
        </div>
    );
};

// --- Settings Tab ---
const SettingsTab = ({ settings, onSave, guildId }: { settings: any, onSave: (d: any) => void, guildId?: string }) => {
    const [data, setData] = useState(settings);
    
    return (
        <div style={{ display: 'grid', gap: '20px' }}>
            <h3>Currency Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Currency Name</label>
                    <input 
                        value={data.currencyName} 
                        onChange={e => setData({...data, currencyName: e.target.value})}
                        style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.border}`, color: 'white', borderRadius: '4px' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Currency Symbol/Emoji</label>
                    <HybridEmojiPicker 
                        value={data.currencyEmoji} 
                        onChange={val => setData({...data, currencyEmoji: val})}
                        guildId={guildId}
                    />
                    <small style={{ color: colors.textSecondary, marginTop: '4px', display: 'block' }}>
                        For custom emojis, you can also paste the full code (e.g. <code>&lt;:name:id&gt;</code>).
                    </small>
                </div>
            </div>

            <h3>Earning (Passive)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Coins per Message</label>
                    <input 
                        type="number"
                        value={data.messageReward} 
                        onChange={e => setData({...data, messageReward: Number(e.target.value)})}
                        style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.border}`, color: 'white', borderRadius: '4px' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Cooldown (Seconds)</label>
                    <input 
                        type="number"
                        value={data.messageCooldown} 
                        onChange={e => setData({...data, messageCooldown: Number(e.target.value)})}
                        style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.border}`, color: 'white', borderRadius: '4px' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Min Char Count</label>
                    <input 
                        type="number"
                        value={data.minMessageLength} 
                        onChange={e => setData({...data, minMessageLength: Number(e.target.value)})}
                        style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.border}`, color: 'white', borderRadius: '4px' }}
                    />
                </div>
            </div>

            <h3>Features</h3>
             <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                        type="checkbox" 
                        checked={data.allowTipping} 
                        onChange={e => setData({...data, allowTipping: e.target.checked})}
                    />
                    <span>Allow Reaction Tipping (React with {renderCurrency(data.currencyEmoji)} to tip 1 coin)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                        type="checkbox" 
                        checked={data.autoNickname} 
                        onChange={e => setData({...data, autoNickname: e.target.checked})}
                    />
                    <span>Auto-Update Nicknames (e.g. User ({renderCurrency(data.currencyEmoji)}500))</span>
                </label>
            </div>

            <button 
                onClick={() => onSave(data)}
                style={{ 
                    marginTop: '20px', 
                    padding: '12px', 
                    background: colors.primary, 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
            >
                <Save size={18} /> Save Settings
            </button>
        </div>
    );
};

// --- Inventory Tab ---
const InventoryTab = ({ items, refresh, guildId, currency }: { items: any[], refresh: () => void, guildId: string, currency: string }) => {
    const [editing, setEditing] = useState<any | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        await axios.delete(`/api/economy/items/${guildId}/${id}`, { withCredentials: true });
        refresh();
    };

    const handleSave = async (item: any) => {
        await axios.post(`/api/economy/items/${guildId}`, item, { withCredentials: true });
        setEditing(null);
        refresh();
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3>Shop Items</h3>
                <button 
                    onClick={() => setEditing({ name: '', price: 0, type: 'ROLE', description: '' })}
                    style={{ background: colors.success, border: 'none', padding: '8px 16px', color: 'white', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <Plus size={16} /> Add Item
                </button>
            </div>

            {editing && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: `1px solid ${colors.border}` }}>
                    <h4>{editing.id ? 'Edit Item' : 'New Item'}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                         <input placeholder="Name" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} style={inputStyle} />
                         <input placeholder="Price" type="number" value={editing.price} onChange={e => setEditing({...editing, price: Number(e.target.value)})} style={inputStyle} />
                         <select value={editing.type} onChange={e => setEditing({...editing, type: e.target.value})} style={inputStyle}>
                             <option value="ROLE">Role (Grants Link)</option>
                             <option value="ITEM">Item (Simple Inventory)</option>
                         </select>
                         <input placeholder="Stock (Leave empty for infinite)" type="number" value={editing.stock || ''} onChange={e => setEditing({...editing, stock: e.target.value ? Number(e.target.value) : null})} style={inputStyle} />
                    </div>
                    <textarea placeholder="Description" value={editing.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} style={{ ...inputStyle, width: '100%', marginBottom: '10px' }} />
                    
                    {editing.type === 'ROLE' && (
                         <input placeholder="Role ID to Grant" value={editing.metadata?.roleId || ''} onChange={e => setEditing({...editing, metadata: { ...editing.metadata, roleId: e.target.value }})} style={{ ...inputStyle, width: '100%', marginBottom: '10px' }} />
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleSave(editing)} style={btnStyle(colors.success)}>Save</button>
                        <button onClick={() => setEditing(null)} style={btnStyle(colors.textSecondary)}>Cancel</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gap: '10px' }}>
                {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>{renderCurrency(currency)} {item.price} • {item.type} • Stock: {item.stock ?? '∞'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setEditing(item)} style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer' }}><Edit size={18}/></button>
                            <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: colors.error, cursor: 'pointer' }}><Trash2 size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Vault Tab ---
const VaultTab = ({ guildId, currency }: { guildId: string, currency: string }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [amount, setAmount] = useState(0);

    const handleSearch = async () => {
        const res = await axios.get(`/api/economy/search-users/${guildId}?q=${query}`, { withCredentials: true });
        setResults(res.data);
    };

    const handleUpdate = async (mode: 'set' | 'add') => {
        if (!selectedUser) return;
        try {
            await axios.post(`/api/economy/vault/${guildId}`, { userId: selectedUser.user ? selectedUser.user.id : selectedUser.id, amount, mode }, { withCredentials: true });
            alert('Balance Updated');
            setSelectedUser(null);
            setAmount(0);
        } catch (e) {
            alert('Failed');
        }
    };

    return (
        <div>
            <h3>Vault Manager</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input 
                    placeholder="Search user by name..." 
                    value={query} 
                    onChange={e => setQuery(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    style={{ ...inputStyle, flex: 1 }} 
                />
                <button onClick={handleSearch} style={btnStyle(colors.primary)}>Search</button>
            </div>

            {selectedUser ? (
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', textAlign: 'center' }}>
                    <h4>Managing: {selectedUser.user?.username || selectedUser.username}</h4>
                    <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ ...inputStyle, width: '150px', margin: '0 auto 10px auto', display: 'block' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <button onClick={() => handleUpdate('add')} style={btnStyle(colors.success)}>Add {renderCurrency(currency)}</button>
                        <button onClick={() => handleUpdate('set')} style={btnStyle(colors.warning)}>Set Balance</button>
                        <button onClick={() => setSelectedUser(null)} style={btnStyle('grey')}>Cancel</button>
                    </div>
                </div>
            ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {results.map(r => (
                        <div 
                            key={r.user?.id || r.id} 
                            onClick={() => setSelectedUser(r)}
                            style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer' }}
                        >
                            {r.user?.username || r.username} ({r.user?.id || r.id})
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Utils
const inputStyle: any = { padding: '8px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.border}`, color: 'white', borderRadius: '4px' };
const btnStyle = (bg: string) => ({ background: bg, border: 'none', padding: '8px 16px', color: 'white', borderRadius: '4px', cursor: 'pointer' });

const renderCurrency = (emoji: string) => {
    if (!emoji) return emoji;
    const match = emoji.trim().match(/^<(a?):(\w+):(\d+)>$/);
    if (match) {
        const [_, animated, name, id] = match;
        const ext = animated ? 'gif' : 'png';
        return (
            <img 
                src={`https://cdn.discordapp.com/emojis/${id}.${ext}`} 
                alt={name} 
                title={`:${name}:`}
                style={{ width: '1.2em', height: '1.2em', verticalAlign: 'text-bottom', objectFit: 'contain', display: 'inline-block' }} 
            />
        );
    }
    return emoji;
};
