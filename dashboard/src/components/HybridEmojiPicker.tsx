import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../theme/theme';
import axios from 'axios';
import { Smile, X } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface HybridEmojiPickerProps {
    value?: string;
    onChange: (value: string) => void;
    guildId?: string;
    placeholder?: string;
}

const inputStyle: any = { 
    padding: '10px 12px', 
    background: 'rgba(0,0,0,0.2)', 
    border: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}`, 
    color: 'white', 
    borderRadius: '6px',
    fontSize: '14px'
};

const btnStyle = (bg: string) => ({ 
    background: bg, 
    border: 'none', 
    padding: '10px 16px', 
    color: 'white', 
    borderRadius: '6px', 
    cursor: 'pointer' 
});

export const HybridEmojiPicker: React.FC<HybridEmojiPickerProps> = ({ value = '', onChange, guildId, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tab, setTab] = useState<'standard' | 'custom'>('standard');
    const [customEmojis, setCustomEmojis] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (tab === 'custom' && guildId && customEmojis.length === 0) {
            setLoading(true);
            axios.get(`/api/guilds/${guildId}/emojis`, { withCredentials: true })
                .then(res => setCustomEmojis(res.data))
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [tab, guildId]);

    const handleSelect = (val: string) => {
        // Simple append - enables constructing sentences in WordFilter or just picking one
        onChange(value + val);
        setIsOpen(false);
    };

    const renderPreview = () => {
        if (!value) return null;
        const match = value.trim().match(/^<(a?):(\w+):(\d+)>$/);
        if (match) {
            const [_, animated, name, id] = match;
            const ext = animated ? 'gif' : 'png';
            const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
            return (
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '6px',
                    padding: '0 8px',
                    border: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}`,
                    minWidth: '40px'
                }}>
                    <img src={url} alt={name} title={name} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ position: 'relative' }} ref={wrapperRef}>
            <div style={{ display: 'flex', gap: '8px' }}>
                {renderPreview()}
                <input 
                    value={value} 
                    onChange={e => onChange(e.target.value)}
                    style={{ flex: 1, ...inputStyle }}
                    placeholder={placeholder || "Select or type..."}
                />
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    style={{ ...btnStyle(colors.surface || '#2f334d'), border: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center' }}
                >
                    {isOpen ? <X size={20}/> : <Smile size={20}/>}
                </button>
            </div>

            {isOpen && (
                <div style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    right: 0, 
                    zIndex: 1000, 
                    background: '#1e1f22', // Slightly darker/standard discord-like background
                    border: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}`, 
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    width: '380px', // Wider
                    marginTop: '8px',
                    overflow: 'hidden'
                }}>
                    <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}` }}>
                        <button 
                            onClick={() => setTab('standard')}
                            style={{ 
                                flex: 1, 
                                padding: '12px', 
                                background: tab === 'standard' ? 'rgba(255,255,255,0.1)' : 'transparent', 
                                color: 'white', 
                                border: 'none', 
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            Standard
                        </button>
                        <button 
                            onClick={() => setTab('custom')}
                            style={{ 
                                flex: 1, 
                                padding: '12px', 
                                background: tab === 'custom' ? 'rgba(255,255,255,0.1)' : 'transparent', 
                                color: 'white', 
                                border: 'none', 
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            Server Emojis
                        </button>
                    </div>

                    <div style={{ height: '350px', overflowY: 'auto' }}>
                        {tab === 'standard' ? (
                            <EmojiPicker 
                                onEmojiClick={(data) => handleSelect(data.emoji)} 
                                width="100%" 
                                height={350}
                                theme={'dark' as any}
                                lazyLoadEmojis={true}
                                searchDisabled={false}
                                skinTonesDisabled // Keep it simpler
                            />
                        ) : (
                            <div style={{ padding: '16px' }}>
                                {loading && <div style={{ textAlign: 'center', padding: '20px', color: '#ccc' }}>Loading custom emojis...</div>}
                                {!loading && customEmojis.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>No custom emojis found in this server.</div>}
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                                    {customEmojis.map(emoji => (
                                        <button 
                                            key={emoji.id}
                                            onClick={() => handleSelect(`<:${emoji.name}:${emoji.id}>`)}
                                            title={`:${emoji.name}:`}
                                            style={{ 
                                                background: 'rgba(255,255,255,0.05)', 
                                                border: '1px solid transparent', 
                                                cursor: 'pointer', 
                                                padding: '8px',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                aspectRatio: '1/1',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={e => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                                            }}
                                            onMouseOut={e => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.borderColor = 'transparent';
                                            }}
                                        >
                                            <img 
                                                src={`https://cdn.discordapp.com/emojis/${emoji.id}.png?v=1`} 
                                                alt={emoji.name} 
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
