import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { colors, borderRadius, spacing } from '../theme/theme';

interface ConfirmModalProps {
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    open,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Confirm',
    danger = false,
    onConfirm,
    onCancel,
}) => {
    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={onCancel}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                backgroundColor: 'rgba(0,0,0,0.65)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: spacing.md,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundColor: '#1A1E2E',
                    border: `1px solid rgba(255,255,255,0.1)`,
                    borderRadius: borderRadius.lg,
                    padding: '28px 32px',
                    maxWidth: '440px',
                    width: '100%',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <AlertTriangle size={22} color={danger ? '#EF4444' : '#EAB308'} />
                    <h2 id="confirm-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#F8FAFC' }}>
                        {title}
                    </h2>
                </div>
                <p style={{ margin: '0 0 24px', color: '#B9C3CE', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '10px 20px', borderRadius: borderRadius.md,
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#B9C3CE', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '10px 20px', borderRadius: borderRadius.md,
                            background: danger ? '#EF4444' : colors.primary,
                            border: 'none', color: 'white', cursor: 'pointer',
                            fontWeight: 600, fontSize: '14px',
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
