import React from 'react';
import { Link } from 'react-router-dom';
import { Music, Heart, Swords, UserPlus } from 'lucide-react';
import { colors } from '../theme/theme';

export interface ActivityItem {
    type: 'track_upload' | 'follow' | 'battle_entry' | 'favourite';
    actorId: string;
    actorName: string;
    actorAvatar: string | null;
    target?: {
        id: string;
        title?: string;
        name?: string;
        coverUrl?: string | null;
        slug?: string;
        artistUsername?: string;
    };
    createdAt: string;
}

interface ActivityFeedProps {
    items: ActivityItem[];
    maxItems?: number;
}

function timeAgo(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function getAvatarUrl(avatar: string | null, userId: string): string {
    if (!avatar) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId.slice(-1)) % 5}.png`;
    if (avatar.startsWith('http') || avatar.startsWith('/uploads/')) return avatar;
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
}

const typeConfig: Record<string, { icon: React.FC<any>; color: string; verb: (item: ActivityItem) => string }> = {
    track_upload: {
        icon: Music,
        color: colors.primary,
        verb: (item) => `dropped a new track${item.target?.title ? `, "${item.target.title}"` : ''}`,
    },
    follow: {
        icon: UserPlus,
        color: '#60A5FA',
        verb: (item) => `started following ${item.target?.name || 'an artist'}`,
    },
    battle_entry: {
        icon: Swords,
        color: '#FBBF24',
        verb: () => 'entered the battle',
    },
    favourite: {
        icon: Heart,
        color: '#F87171',
        verb: (item) => `favourited "${item.target?.title || 'a track'}"`,
    },
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ items, maxItems = 15 }) => {
    const displayItems = items.slice(0, maxItems);

    if (displayItems.length === 0) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', color: colors.textSecondary, fontSize: '12px' }}>
                No recent activity
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', paddingLeft: '8px' }}>
            {/* Timeline line */}
            <div style={{ position: 'absolute', left: '23px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(255,255,255,0.06)', zIndex: 1 }} />

            {displayItems.map((item, idx) => {
                const config = typeConfig[item.type];
                if (!config) return null;
                const Icon = config.icon;

                const trackLink = item.type === 'track_upload' && item.target?.artistUsername
                    ? `/track/${item.target.artistUsername}/${item.target.slug || item.target.id}`
                    : null;

                return (
                    <div key={idx} style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'flex-start' }}>
                        {/* Avatar */}
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '3px solid #242C3D', background: '#4a5568' }}>
                            <img
                                src={getAvatarUrl(item.actorAvatar, item.actorId)}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`; }}
                            />
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5, color: colors.textSecondary }}>
                                <strong style={{ color: colors.textPrimary }}>{item.actorName}</strong>{' '}
                                {config.verb(item)}
                                <span style={{ marginLeft: '6px', fontSize: '10px', color: colors.textTertiary }}>{timeAgo(item.createdAt)}</span>
                            </p>

                            {/* Embedded card for tracks */}
                            {(item.type === 'track_upload' || item.type === 'battle_entry') && item.target?.coverUrl && (
                                <div style={{ 
                                    display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px',
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '6px', padding: '6px 8px',
                                }}>
                                    <img src={item.target.coverUrl} alt="" style={{ width: '30px', height: '30px', borderRadius: '4px', objectFit: 'cover' }} />
                                    <div style={{ minWidth: 0 }}>
                                        {trackLink ? (
                                            <Link to={trackLink} style={{ fontSize: '12px', fontWeight: 600, color: colors.textPrimary, textDecoration: 'none' }}>
                                                {item.target.title}
                                            </Link>
                                        ) : (
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textPrimary }}>{item.target.title}</div>
                                        )}
                                        <div style={{ fontSize: '10px', color: colors.textSecondary }}>{item.actorName}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Type icon */}
                        <Icon size={12} color={config.color} style={{ flexShrink: 0, marginTop: '3px', opacity: 0.6 }} />
                    </div>
                );
            })}
        </div>
    );
};
