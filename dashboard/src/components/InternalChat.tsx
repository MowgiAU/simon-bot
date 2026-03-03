import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Minimize2, 
  Maximize2, 
  Users,
  AtSign,
  User
} from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useAuth } from './AuthProvider';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  createdAt: string;
}

interface Staff {
  id: string;
  username: string;
  avatar: string | null;
}

export const InternalChat: React.FC<{ guildId: string }> = ({ guildId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [staffListOpen, setStaffListOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      fetchStaff();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, guildId]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isMinimized]);

  const fetchMessages = async () => {
    try {
      const resp = await fetch(`/api/guilds/${guildId}/chat-messages`);
      if (resp.ok) {
        setMessages(await resp.json());
      }
    } catch (e) {
      console.error('Failed to fetch chat messages', e);
    }
  };

  const fetchStaff = async () => {
     try {
       const resp = await fetch(`/api/guilds/${guildId}/staff`);
       if (resp.ok) {
         setStaff(await resp.json());
       }
     } catch (e) {
       console.error('Failed to fetch staff list', e);
     }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    try {
      const resp = await fetch(`/api/guilds/${guildId}/chat-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: inputValue })
      });
      
      if (resp.ok) {
        setInputValue('');
        fetchMessages();
      }
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: colors.primary,
          color: '#FFFFFF',
          border: 'none',
          boxShadow: '0 8px 32px rgba(43, 140, 113, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9999,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.backgroundColor = 'rgb(45, 138, 115)';
        }}
        onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.backgroundColor = colors.primary;
        }}
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div style={{
       position: 'fixed',
       bottom: '24px',
       right: '24px',
       width: isMinimized ? '200px' : '360px',
       height: isMinimized ? '48px' : '500px',
       background: 'linear-gradient(118deg, rgba(36, 44, 61, 0.95), rgba(26, 30, 46, 0.98))',
       borderRadius: '16px',
       border: '1px solid #3E455644',
       boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
       display: 'flex',
       flexDirection: 'column',
       overflow: 'hidden',
       zIndex: 10000,
       backdropFilter: 'blur(10px)',
       transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px', 
        background: 'rgba(255,255,255,0.05)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid #3E455633'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors.success }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>Staff Chat</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setIsMinimized(!isMinimized)} style={{ background: 'none', border: 'none', color: '#8A92A0', cursor: 'pointer', padding: '4px' }}>
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#8A92A0', cursor: 'pointer', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Staff List Bar */}
          <div style={{ 
              padding: '8px 16px', 
              background: 'rgba(0,0,0,0.2)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontSize: '11px',
              color: colors.textSecondary,
              borderBottom: '1px solid #3E455622'
          }}>
             <Users size={12} />
             <span>Team: {staff.length} Active</span>
          </div>

          {/* Messages area */}
          <div 
            ref={scrollRef}
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              scrollBehavior: 'smooth'
            }}
          >
            {messages.map((msg, i) => {
                const isMine = msg.senderId === user?.id;
                return (
                    <div key={msg.id} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMine ? 'flex-end' : 'flex-start'
                    }}>
                        {!isMine && (
                            <span style={{ fontSize: '10px', color: colors.textSecondary, marginBottom: '2px', marginLeft: '4px' }}>
                                {msg.senderName}
                            </span>
                        )}
                        <div style={{
                            background: isMine ? colors.primary : 'rgba(255,255,255,0.05)',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            borderBottomRightRadius: isMine ? '2px' : '12px',
                            borderBottomLeftRadius: isMine ? '12px' : '2px',
                            maxWidth: '85%',
                            fontSize: '13px',
                            color: '#FFFFFF',
                            lineHeight: '1.4',
                            border: isMine ? 'none' : '1px solid #3E455622'
                        }}>
                             {msg.content}
                        </div>
                    </div>
                );
            })}
          </div>

          {/* Input area */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #3E455633', background: 'rgba(0,0,0,0.1)' }}>
             <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="text"
                  placeholder="Type a message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid #3E455633',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <button 
                  onClick={handleSendMessage}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: colors.primary,
                    border: 'none',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                    <Send size={16} />
                </button>
             </div>
          </div>
        </>
      )}
    </div>
  );
};
