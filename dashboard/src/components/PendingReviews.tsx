import React, { useState, useEffect } from 'react';
import { Check, X, Clock, File, Image as ImageIcon } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';

interface PendingReview {
    id: string;
    username: string;
    avatarUrl: string;
    content: string;
    attachmentUrls: string[];
    createdAt: string;
    channelId: string;
    ruleId: string;
}

export const PendingReviews: React.FC<{ guildId: string }> = ({ guildId }) => {
    const [reviews, setReviews] = useState<PendingReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    const fetchReviews = async () => {
        try {
            const res = await fetch(`/api/guilds/${guildId}/pending-reviews`, { credentials: 'include' });
            if (res.ok) setReviews(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
        // Poll every 10s for updates
        const timer = setInterval(fetchReviews, 10000);
        return () => clearInterval(timer);
    }, [guildId]);

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setProcessing(id);
        try {
            const res = await fetch(`/api/guilds/${guildId}/pending-reviews/${id}/${action}`, {
                method: 'POST',
                credentials: 'include'
            });
            if (res.ok) {
                setReviews(prev => prev.filter(r => r.id !== id));
            } else {
                alert('Action failed');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div>Loading...</div>;

    if (reviews.length === 0) {
        return (
            <div style={{ 
                padding: spacing.xl, 
                textAlign: 'center', 
                color: colors.textSecondary,
                background: colors.surface,
                borderRadius: borderRadius.md
            }}>
                <div style={{ marginBottom: spacing.md, opacity: 0.5 }}>
                   <Check size={48} />
                </div>
                <h3>All Clear!</h3>
                <p>No messages are pending review.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gap: spacing.md }}>
            {reviews.map(review => (
                <div key={review.id} style={{ 
                    background: colors.surface, 
                    padding: spacing.md, 
                    borderRadius: borderRadius.md,
                    border: `1px solid ${colors.border}`,
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
                        <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
                            <img 
                                src={review.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'} 
                                alt={review.username}
                                style={{ width: 40, height: 40, borderRadius: '50%' }}
                            />
                            <div>
                                <div style={{ fontWeight: 600, color: colors.textPrimary }}>{review.username}</div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={12} /> {new Date(review.createdAt).toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div style={{ 
                            background: colors.background, 
                            padding: '4px 8px', 
                            borderRadius: 4, 
                            fontSize: '12px', 
                            color: colors.primary 
                        }}>
                             Triggered Rule: {review.ruleId}
                        </div>
                    </div>

                    <div style={{ 
                        background: colors.background, 
                        padding: spacing.md, 
                        borderRadius: 4, 
                        color: colors.textPrimary,
                        marginBottom: spacing.md,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace'
                    }}>
                        {review.content || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>[No text content]</span>}
                    </div>

                    {review.attachmentUrls.length > 0 && (
                        <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' }}>
                            {review.attachmentUrls.map((url, i) => (
                                <a 
                                    key={i} 
                                    href={url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 6,
                                        background: '#2f3136', 
                                        padding: '8px 12px', 
                                        borderRadius: 4,
                                        color: colors.textPrimary,
                                        textDecoration: 'none',
                                        fontSize: '13px'
                                    }}
                                >
                                    {isImage(url) ? <ImageIcon size={14} /> : <File size={14} />}
                                    Attachment {i + 1}
                                </a>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: spacing.md }}>
                        <button 
                            onClick={() => handleAction(review.id, 'approve')}
                            disabled={!!processing}
                            style={{ 
                                ...btnStyle, 
                                background: '#3ba55c',
                                opacity: processing ? 0.5 : 1
                            }}
                        >
                            <Check size={16} /> Approve
                        </button>
                        <button 
                            onClick={() => handleAction(review.id, 'reject')}
                            disabled={!!processing}
                            style={{ 
                                ...btnStyle, 
                                background: '#ed4245',
                                opacity: processing ? 0.5 : 1 
                            }}
                        >
                            <X size={16} /> Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url.split('?')[0]);

const btnStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    padding: '10px',
    borderRadius: 4,
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'opacity 0.2s'
};
