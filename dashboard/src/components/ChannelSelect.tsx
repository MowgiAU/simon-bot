import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { colors, borderRadius, spacing } from '../theme/theme';
import { useResources, DiscordChannel } from './ResourceProvider';

interface ChannelSelectProps {
    guildId: string;
    value: string | string[];
    onChange: (value: string | string[]) => void;
    placeholder?: string;
    multiple?: boolean;
    channelTypes?: number[];
}

const FAVORITES_KEY = 'fuji_channel_favorites';

function getFavorites(guildId: string): string[] {
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        if (!raw) return [];
        const all = JSON.parse(raw);
        return Array.isArray(all[guildId]) ? all[guildId] : [];
    } catch { return []; }
}

function setFavorites(guildId: string, ids: string[]) {
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        const all = raw ? JSON.parse(raw) : {};
        all[guildId] = ids;
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
}

const getIcon = (type: number) => {
    switch (type) {
        case 0: return '#';
        case 2: return '🔊';
        case 4: return '📁';
        case 5: return '📢';
        case 13: return '🎤';
        case 15: return '💬';
        case 16: return '🖼️';
        default: return '';
    }
};

interface OrderedEntry {
    type: 'category' | 'channel';
    channel: DiscordChannel;
}

function buildOrderedList(allChannels: DiscordChannel[], filterTypes?: number[]): OrderedEntry[] {
    const categories = allChannels
        .filter(c => c.type === 4)
        .sort((a, b) => a.position - b.position);

    const nonCategories = allChannels.filter(c => c.type !== 4);

    const childrenOf = (parentId: string | null) =>
        nonCategories
            .filter(c => (c.parent_id ?? null) === parentId)
            .sort((a, b) => a.position - b.position);

    const result: OrderedEntry[] = [];

    // Channels with no category first
    for (const ch of childrenOf(null)) {
        if (!filterTypes || filterTypes.includes(ch.type)) {
            result.push({ type: 'channel', channel: ch });
        }
    }

    // Then each category + its children
    for (const cat of categories) {
        const children = childrenOf(cat.id);
        const visibleChildren = filterTypes
            ? children.filter(c => filterTypes.includes(c.type))
            : children;
        if (visibleChildren.length === 0) continue;
        result.push({ type: 'category', channel: cat });
        for (const ch of visibleChildren) {
            result.push({ type: 'channel', channel: ch });
        }
    }

    return result;
}

export const ChannelSelect: React.FC<ChannelSelectProps> = ({
    guildId,
    value,
    onChange,
    placeholder = "Select Channel",
    multiple = false,
    channelTypes
}) => {
    const { channels, loading } = useResources();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [favIds, setFavIds] = useState<string[]>(() => getFavorites(guildId));
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Sync favorites when guildId changes
    useEffect(() => { setFavIds(getFavorites(guildId)); }, [guildId]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus search when opening
    useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);

    const ordered = useMemo(() => buildOrderedList(channels, channelTypes), [channels, channelTypes]);

    const filtered = useMemo(() => {
        if (!search.trim()) return ordered;
        const q = search.toLowerCase();
        return ordered.filter(e => e.type === 'channel' && e.channel.name.toLowerCase().includes(q));
    }, [ordered, search]);

    const favoriteChannels = useMemo(() => {
        if (favIds.length === 0) return [];
        return favIds
            .map(id => channels.find(c => c.id === id))
            .filter((c): c is DiscordChannel => !!c && (!channelTypes || channelTypes.includes(c.type)));
    }, [favIds, channels, channelTypes]);

    const toggleFav = useCallback((e: React.MouseEvent, channelId: string) => {
        e.stopPropagation();
        const next = favIds.includes(channelId)
            ? favIds.filter(id => id !== channelId)
            : [...favIds, channelId];
        setFavIds(next);
        setFavorites(guildId, next);
    }, [favIds, guildId]);

    const selectedArr = Array.isArray(value) ? value : (value ? [value] : []);

    const handleSelect = useCallback((channelId: string) => {
        if (multiple) {
            const next = selectedArr.includes(channelId)
                ? selectedArr.filter(id => id !== channelId)
                : [...selectedArr, channelId];
            onChange(next);
        } else {
            onChange(channelId);
            setOpen(false);
            setSearch('');
        }
    }, [multiple, selectedArr, onChange]);

    const selectedName = useMemo(() => {
        if (multiple) {
            if (selectedArr.length === 0) return placeholder;
            return `${selectedArr.length} channel${selectedArr.length > 1 ? 's' : ''} selected`;
        }
        const ch = channels.find(c => c.id === (value as string));
        return ch ? `${getIcon(ch.type)} ${ch.name}` : placeholder;
    }, [value, channels, multiple, selectedArr, placeholder]);

    const isSelected = (id: string) => selectedArr.includes(id);

    const rowStyle = (selected: boolean, hovered?: boolean): React.CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        padding: '6px 10px',
        cursor: 'pointer',
        borderRadius: '4px',
        backgroundColor: selected ? 'rgba(16,185,129,0.15)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        color: selected ? colors.primary : colors.textPrimary,
        fontSize: '13px',
        gap: '6px',
        transition: 'background 0.1s',
    });

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%',
                    padding: spacing.sm,
                    backgroundColor: colors.background,
                    color: selectedArr.length > 0 && (multiple || value) ? colors.textPrimary : colors.textTertiary,
                    borderRadius: borderRadius.md,
                    border: `1px solid ${open ? colors.primary : colors.border}`,
                    outline: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.15s',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedName}</span>
                <span style={{ fontSize: '10px', color: colors.textTertiary, marginLeft: '8px', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
            </button>

            {/* Dropdown */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.md,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 1000,
                    maxHeight: '340px',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* Search */}
                    <div style={{ padding: '8px', borderBottom: `1px solid ${colors.border}` }}>
                        <input
                            ref={searchRef}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search channels..."
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                backgroundColor: colors.background,
                                color: colors.textPrimary,
                                border: `1px solid ${colors.border}`,
                                borderRadius: '4px',
                                outline: 'none',
                                fontSize: '12px',
                            }}
                        />
                    </div>

                    {/* Scrollable list */}
                    <div style={{ overflowY: 'auto', padding: '4px' }}>
                        {loading && <div style={{ padding: '12px', color: colors.textTertiary, fontSize: '12px', textAlign: 'center' }}>Loading...</div>}

                        {/* Favorites section */}
                        {favoriteChannels.length > 0 && !search.trim() && (
                            <>
                                <div style={{ padding: '4px 10px 2px', fontSize: '10px', fontWeight: 700, color: colors.highlight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    ★ Pinned
                                </div>
                                {favoriteChannels.map(ch => (
                                    <ChannelRow
                                        key={`fav-${ch.id}`}
                                        channel={ch}
                                        selected={isSelected(ch.id)}
                                        isFav={true}
                                        onSelect={handleSelect}
                                        onToggleFav={toggleFav}
                                        rowStyle={rowStyle}
                                    />
                                ))}
                                <div style={{ height: '1px', backgroundColor: colors.border, margin: '4px 8px' }} />
                            </>
                        )}

                        {/* Main channel list */}
                        {filtered.map((entry, i) => {
                            if (entry.type === 'category') {
                                return (
                                    <div key={`cat-${entry.channel.id}`} style={{
                                        padding: '6px 10px 2px',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        color: colors.textTertiary,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        marginTop: i > 0 ? '4px' : 0,
                                    }}>
                                        {entry.channel.name}
                                    </div>
                                );
                            }
                            return (
                                <ChannelRow
                                    key={entry.channel.id}
                                    channel={entry.channel}
                                    selected={isSelected(entry.channel.id)}
                                    isFav={favIds.includes(entry.channel.id)}
                                    onSelect={handleSelect}
                                    onToggleFav={toggleFav}
                                    rowStyle={rowStyle}
                                    indented={!!entry.channel.parent_id}
                                />
                            );
                        })}

                        {!loading && filtered.length === 0 && (
                            <div style={{ padding: '12px', color: colors.textTertiary, fontSize: '12px', textAlign: 'center' }}>No channels found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/* Individual channel row with hover + pin button */
const ChannelRow: React.FC<{
    channel: DiscordChannel;
    selected: boolean;
    isFav: boolean;
    onSelect: (id: string) => void;
    onToggleFav: (e: React.MouseEvent, id: string) => void;
    rowStyle: (selected: boolean, hovered?: boolean) => React.CSSProperties;
    indented?: boolean;
}> = ({ channel, selected, isFav, onSelect, onToggleFav, rowStyle, indented }) => {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            style={{ ...rowStyle(selected, hovered), paddingLeft: indented ? '22px' : '10px' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => onSelect(channel.id)}
        >
            <span style={{ opacity: 0.5, fontSize: '12px', width: '16px', textAlign: 'center', flexShrink: 0 }}>
                {getIcon(channel.type)}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {channel.name}
            </span>
            {(hovered || isFav) && (
                <span
                    onClick={(e) => onToggleFav(e, channel.id)}
                    title={isFav ? 'Unpin channel' : 'Pin channel'}
                    style={{
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: isFav ? colors.highlight : colors.textTertiary,
                        opacity: isFav ? 1 : 0.5,
                        flexShrink: 0,
                        padding: '0 2px',
                    }}
                >
                    {isFav ? '★' : '☆'}
                </span>
            )}
        </div>
    );
};
