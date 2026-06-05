import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

interface UserResult { userId: string; username: string; displayName: string | null; avatar: string | null; }
interface Conversation { id: string; name: string | null; isGroup: boolean; participants: UserResult[]; lastMessagePreview: string | null; lastMessageAt: string | null; lastMessageSenderId: string | null; unread: number; muted: boolean; archived: boolean; createdAt: string; }
interface Message { id: string; senderId: string; content: string | null; deleted: boolean; createdAt: string; editedAt: string | null; }
interface Toast { id: number; convId: string; senderName: string; avatar: string | null; preview: string; }

const avatarUrl = (u: { userId: string; username: string; displayName: string | null; avatar: string | null }) => {
    if (u.avatar?.startsWith('http') || u.avatar?.startsWith('/')) return u.avatar;
    if (u.avatar && u.userId) return `https://cdn.discordapp.com/avatars/${u.userId}/${u.avatar}.png?size=64`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.username)}&background=242A3D&color=F8FAFC&size=64`;
};

interface OpenChat {
    convId: string;
    minimized: boolean;
}

interface ChatContextType {
    conversations: Conversation[];
    unreadTotal: number;
    openChats: OpenChat[];
    openChat: (convId: string) => void;
    closeChat: (convId: string) => void;
    minimizeChat: (convId: string) => void;
    restoreChat: (convId: string) => void;
    startConversation: (participantIds: string[], isGroup?: boolean, name?: string) => Promise<string | null>;
    archiveChat: (convId: string) => Promise<void>;
    fetchConversations: () => Promise<void>;
    dropdownOpen: boolean;
    setDropdownOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const MAX_OPEN_CHATS = 3;

export const ChatProvider: React.FC<{ children: React.ReactNode; userId?: string }> = ({ children, userId }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [openChats, setOpenChats] = useState<OpenChat[]>([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const prevConvosRef = useRef<Conversation[]>([]);
    const openChatsRef = useRef<OpenChat[]>([]);
    const toastIdRef = useRef(0);
    const initialLoadRef = useRef(true);

    // Keep openChatsRef in sync
    useEffect(() => { openChatsRef.current = openChats; }, [openChats]);

    const addToast = useCallback((convId: string, senderName: string, avatar: string | null, preview: string) => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev.slice(-4), { id, convId, senderName, avatar, preview }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    const dismissToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const fetchConversations = useCallback(async () => {
        if (!userId) return;
        try {
            const { data } = await axios.get('/api/messages/conversations', { withCredentials: true });
            // Detect new messages by comparing unread counts
            if (!initialLoadRef.current && prevConvosRef.current.length > 0) {
                for (const conv of data as Conversation[]) {
                    const prev = prevConvosRef.current.find(c => c.id === conv.id);
                    if (conv.unread > 0 && (!prev || conv.unread > prev.unread) && !conv.muted) {
                        // Skip if chat is actively open (not minimized)
                        const isOpen = openChatsRef.current.some(c => c.convId === conv.id && !c.minimized);
                        if (isOpen) continue;
                        // Find sender from participants (lastMessageSenderId)
                        const sender = conv.participants.find(p => p.userId === conv.lastMessageSenderId);
                        const senderName = sender ? (sender.displayName || sender.username) : (conv.isGroup && conv.name ? conv.name : conv.participants.map(p => p.displayName || p.username).join(', '));
                        addToast(conv.id, senderName, sender ? sender.avatar ? avatarUrl(sender) : null : null, conv.lastMessagePreview || 'New message');
                        // Play notification sound
                        try {
                            const audio = new Audio('data:audio/wav;base64,UklGRl9vT19teleS0teleRm10dAAAABBAAEARCxAAQAJABkAGQBkYXRhAAAA');
                            audio.volume = 0.3;
                            audio.play().catch(() => {});
                        } catch {}
                    }
                }
            }
            initialLoadRef.current = false;
            prevConvosRef.current = data;
            setConversations(data);
        } catch { /* silent */ }
    }, [userId, addToast]);

    // Poll conversations
    useEffect(() => {
        if (!userId) return;
        fetchConversations();
        pollRef.current = setInterval(fetchConversations, 6000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [userId, fetchConversations]);

    const unreadTotal = conversations.reduce((sum, c) => sum + c.unread, 0);

    const openChat = useCallback((convId: string) => {
        setOpenChats(prev => {
            if (prev.some(c => c.convId === convId)) {
                return prev.map(c => c.convId === convId ? { ...c, minimized: false } : c);
            }
            const next = [...prev, { convId, minimized: false }];
            // Limit: close oldest if over max
            if (next.length > MAX_OPEN_CHATS) next.shift();
            return next;
        });
        setDropdownOpen(false);
    }, []);

    const closeChat = useCallback((convId: string) => {
        setOpenChats(prev => prev.filter(c => c.convId !== convId));
    }, []);

    const minimizeChat = useCallback((convId: string) => {
        setOpenChats(prev => prev.map(c => c.convId === convId ? { ...c, minimized: true } : c));
    }, []);

    const restoreChat = useCallback((convId: string) => {
        setOpenChats(prev => prev.map(c => c.convId === convId ? { ...c, minimized: false } : c));
    }, []);

    const archiveChat = useCallback(async (convId: string) => {
        try {
            await axios.patch(`/api/messages/conversations/${convId}`, { archived: true }, { withCredentials: true });
            setOpenChats(prev => prev.filter(c => c.convId !== convId));
            await fetchConversations();
        } catch { /* silent */ }
    }, [fetchConversations]);

    const startConversation = useCallback(async (participantIds: string[], isGroup = false, name?: string): Promise<string | null> => {
        try {
            const { data } = await axios.post('/api/messages/conversations', {
                participantIds,
                isGroup: isGroup || participantIds.length > 1,
                name: isGroup ? name : undefined,
            }, { withCredentials: true });
            await fetchConversations();
            openChat(data.id);
            return data.id;
        } catch {
            return null;
        }
    }, [fetchConversations, openChat]);

    return (
        <ChatContext.Provider value={{
            conversations, unreadTotal, openChats,
            openChat, closeChat, minimizeChat, restoreChat,
            startConversation, archiveChat, fetchConversations,
            dropdownOpen, setDropdownOpen,
        }}>
            {children}
            {/* Message notification toasts */}
            {toasts.length > 0 && (
                <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10001, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
                    {toasts.map((toast, i) => (
                        <div key={toast.id}
                            onClick={() => { dismissToast(toast.id); openChat(toast.convId); }}
                            style={{
                                pointerEvents: 'auto',
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 14px', minWidth: 260, maxWidth: 340,
                                background: 'rgba(26, 30, 46, 0.97)', border: '1px solid rgba(59,168,134,0.3)',
                                borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                cursor: 'pointer', transition: 'opacity 0.3s, transform 0.3s',
                                animation: 'toastSlideIn 0.3s ease-out',
                            }}>
                            {toast.avatar ? (
                                <img src={toast.avatar} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                            ) : (
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #D4700A, #60A5FA)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white' }}>
                                    {toast.senderName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 12, color: '#F8FAFC', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {toast.senderName}
                                </div>
                                <div style={{ fontSize: 11, color: '#8B95A5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {toast.preview}
                                </div>
                            </div>
                            <button onClick={e => { e.stopPropagation(); dismissToast(toast.id); }}
                                style={{ background: 'none', border: 'none', color: '#5C6370', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}>
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <style>{`
                @keyframes toastSlideIn {
                    from { opacity: 0; transform: translateX(40px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useChat must be used within ChatProvider');
    return ctx;
};

export type { Conversation, Message, UserResult, OpenChat };
