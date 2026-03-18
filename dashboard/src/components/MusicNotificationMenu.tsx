import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { colors } from '../theme/theme';
import axios from 'axios';

interface MusicNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    actorName: string | null;
    actorAvatar: string | null;
    isRead: boolean;
    createdAt: string;
}

export const MusicNotificationMenu: React.FC = () => {
    const [notifications, setNotifications] = useState<MusicNotification[]>([]);
    const [open, setOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const { data } = await axios.get('/api/music/notifications', { withCredentials: true });
            setNotifications(data);
            setUnreadCount(data.filter((n: MusicNotification) => !n.isRead).length);
        } catch {
            // not logged in or error
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOpen = async () => {
        setOpen(!open);
        if (!open && unreadCount > 0) {
            try {
                await axios.post('/api/music/notifications/read', {}, { withCredentials: true });
                setUnreadCount(0);
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            } catch {
                // ignore
            }
        }
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    return (
        <div ref={menuRef} style={{ position: 'relative' }}>
            <button
                onClick={handleOpen}
                style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '7px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    color: 'white',
                }}
            >
                <Bell size={16} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        backgroundColor: '#EF4444', color: 'white',
                        fontSize: '9px', fontWeight: 'bold',
                        width: '16px', height: '16px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                    width: '340px', maxHeight: '420px', overflowY: 'auto',
                    backgroundColor: '#1A1E2E', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', boxShadow: '0 15px 40px rgba(0,0,0,0.5)',
                    zIndex: 1000, padding: '8px',
                }}>
                    <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: '#B9C3CE', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                        Notifications
                    </div>
                    {notifications.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#B9C3CE', fontSize: '12px' }}>
                            No notifications yet
                        </div>
                    ) : (
                        notifications.map(n => (
                            <a
                                key={n.id}
                                href={n.link || '#'}
                                onClick={() => setOpen(false)}
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                                    padding: '10px 12px', borderRadius: '8px',
                                    textDecoration: 'none', color: 'inherit',
                                    transition: 'background 0.15s',
                                    backgroundColor: 'transparent',
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                {n.actorAvatar ? (
                                    <img src={n.actorAvatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
                                ) : (
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px', fontWeight: 'bold', color: 'white' }}>
                                        {(n.actorName || '?')[0].toUpperCase()}
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'white', lineHeight: 1.4 }}>{n.title}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#B9C3CE', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</p>
                                    <p style={{ margin: '3px 0 0', fontSize: '10px', color: 'rgba(185,195,206,0.5)' }}>{timeAgo(n.createdAt)}</p>
                                </div>
                            </a>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
