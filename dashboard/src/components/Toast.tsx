import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { colors, borderRadius } from '../theme/theme';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

let _id = 0;

export const showToast = (message: string, type: ToastType = 'info') => {
    window.dispatchEvent(new CustomEvent('fuji-toast', { detail: { message, type } }));
};

const typeStyles: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
    success: {
        bg: 'rgba(43, 140, 113, 0.15)',
        border: colors.primary,
        icon: <CheckCircle size={18} color={colors.primary} />,
    },
    error: {
        bg: 'rgba(239, 68, 68, 0.15)',
        border: '#EF4444',
        icon: <XCircle size={18} color="#EF4444" />,
    },
    warning: {
        bg: 'rgba(234, 179, 8, 0.15)',
        border: '#EAB308',
        icon: <AlertTriangle size={18} color="#EAB308" />,
    },
    info: {
        bg: 'rgba(59, 130, 246, 0.15)',
        border: '#3B82F6',
        icon: <Info size={18} color="#3B82F6" />,
    },
};

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        const handler = (e: Event) => {
            const { message, type } = (e as CustomEvent).detail as { message: string; type: ToastType };
            const id = ++_id;
            setToasts(prev => [...prev, { id, message, type }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 4500);
        };
        window.addEventListener('fuji-toast', handler);
        return () => window.removeEventListener('fuji-toast', handler);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '380px',
            pointerEvents: 'none',
        }}>
            {toasts.map(toast => {
                const s = typeStyles[toast.type];
                return (
                    <div
                        key={toast.id}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            padding: '14px 16px',
                            backgroundColor: '#1A1E2E',
                            border: `1px solid ${s.border}`,
                            borderLeft: `4px solid ${s.border}`,
                            borderRadius: borderRadius.md,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            color: '#F8FAFC',
                            fontSize: '14px',
                            lineHeight: '1.4',
                            pointerEvents: 'auto',
                            animation: 'fuji-toast-in 0.2s ease',
                        }}
                    >
                        <span style={{ flexShrink: 0, marginTop: '1px' }}>{s.icon}</span>
                        <span style={{ flex: 1 }}>{toast.message}</span>
                        <button
                            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                            aria-label="Dismiss"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#8A92A0', flexShrink: 0 }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
            <style>{`
                @keyframes fuji-toast-in {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
