import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  MessageSquare, 
  Shield, 
  ShieldAlert, 
  Settings,
  X,
  User,
  AtSign
} from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';

interface Notification {
  id: string;
  type: 'mention' | 'message' | 'system';
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export const NotificationMenu: React.FC<{ guildId: string }> = ({ guildId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [guildId]);

  const fetchNotifications = async () => {
    try {
      const resp = await fetch(`/api/guilds/${guildId}/notifications`);
      if (resp.ok) {
        setNotifications(await resp.json());
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch(`/api/guilds/${guildId}/notifications/read`, { method: 'POST' });
      const updated = notifications.map(n => ({ ...n, isRead: true }));
      setNotifications(updated);
    } catch (e) {
      console.error('Failed to mark notifications as read', e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'mention': return <AtSign size={16} color={colors.primary} />;
      case 'message': return <MessageSquare size={16} color={colors.info} />;
      case 'system': return <Shield size={16} color={colors.highlight} />;
      default: return <Bell size={16} color={colors.textSecondary} />;
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div 
        onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen && unreadCount > 0) markAsRead();
        }}
        style={{ display: 'flex', alignItems: 'center', position: 'relative', cursor: 'pointer' }}
      >
        <MessageSquare size={20} color={colors.textSecondary} />
        {unreadCount > 0 && (
          <div style={{ 
            position: 'absolute', 
            top: '-4px', 
            right: '-4px', 
            width: '8px', 
            height: '8px', 
            background: colors.highlight, 
            borderRadius: '50%', 
            border: '2px solid #222B3D' 
          }} />
        )}
      </div>

      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
            onClick={() => setIsOpen(false)} 
          />
          <div style={{
            position: 'absolute',
            top: '40px',
            right: '0',
            width: '320px',
            maxHeight: '400px',
            background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.98), rgba(26, 30, 46, 0.99))',
            borderRadius: '16px',
            border: '1px solid #3E455644',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            zIndex: 1000,
            overflowY: 'auto',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #3E455633', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}>Recent Notifications</span>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#8A92A0', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {notifications.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: colors.textSecondary, fontSize: '12px' }}>
                    No notifications yet.
                </div>
            ) : (
                notifications.map(n => (
                    <div key={n.id} style={{ 
                        padding: '16px', 
                        borderBottom: '1px solid #3E455622', 
                        display: 'flex', 
                        gap: '12px',
                        background: n.isRead ? 'transparent' : 'rgba(40, 123, 102, 0.05)',
                        cursor: 'pointer'
                    }}>
                        <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px', 
                            background: 'rgba(255,255,255,0.05)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {getIcon(n.type)}
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{n.title}</div>
                            <div style={{ fontSize: '11px', color: colors.textSecondary }}>{n.message}</div>
                            <div style={{ fontSize: '10px', color: colors.textSecondary, opacity: 0.6, marginTop: '4px' }}>
                                {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
