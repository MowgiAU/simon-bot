import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

interface UserResult { userId: string; username: string; displayName: string | null; avatar: string | null; }
interface Conversation { id: string; name: string | null; isGroup: boolean; participants: UserResult[]; lastMessagePreview: string | null; lastMessageAt: string | null; lastMessageSenderId: string | null; unread: number; muted: boolean; createdAt: string; }
interface Message { id: string; senderId: string; content: string | null; deleted: boolean; createdAt: string; editedAt: string | null; }

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
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchConversations = useCallback(async () => {
        if (!userId) return;
        try {
            const { data } = await axios.get('/api/messages/conversations', { withCredentials: true });
            setConversations(data);
        } catch { /* silent */ }
    }, [userId]);

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
            startConversation, fetchConversations,
            dropdownOpen, setDropdownOpen,
        }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useChat must be used within ChatProvider');
    return ctx;
};

export type { Conversation, Message, UserResult, OpenChat };
