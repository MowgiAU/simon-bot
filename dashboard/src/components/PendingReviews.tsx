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
            <div style={{ padding: '40px', textAlign: 'center', background: colors.surface, borderRadius: borderRadius.md }}>
                <Check size={48} color={colors.success} style={{ marginBottom: '16px' }} />
                <h3>All Caught Up!</h3>
                <p style={{ color: colors.textSecondary }}>No pending messages.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gap: '16px' }}>
            {reviews.map(review => (
                <div key={review.id} style={{ background: colors.surface, borderRadius: borderRadius.md, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
                    <div style={{ padding: '16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img 
                                src={review.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'} 
                                alt={review.username}
                                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                            />
                            <div>
                                <div style={{ fontWeight: 'bold', color: colors.textPrimary }}>{review.username}</div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={12} /> {new Date(review.createdAt).toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div style={{ 
                            padding: '4px 12px', 
                            borderRadius: '12px', 
                            background: '#FFA50033',
                            color: '#FFA500',
                            border: '1px solid #FFA500',
                            fontSize: '12px', fontWeight: 'bold'
                        }}>
                             Rule: {review.ruleId}
                        </div>
                    </div>

                    <div style={{ padding: '20px' }}>
                        <div style={{ 
                            whiteSpace: 'pre-wrap', 
                            color: colors.textPrimary,
                            marginBottom: '16px',
                            lineHeight: '1.5'
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
                                            background: 'rgba(0,0,0,0.3)', 
                                            padding: '8px 12px', 
                                            borderRadius: 4,
                                            color: colors.textPrimary,
                                            textDecoration: 'none',
                                            fontSize: '13px',
                                            border: `1px solid ${colors.border}`
                                        }}
                                    >
                                        {isImage(url) ? <ImageIcon size={14} /> : <File size={14} />}
                                        Attachment {i + 1}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button 
                            onClick={() => handleAction(review.id, 'reject')}
                            disabled={!!processing}
                            style={{ 
                                padding: '8px 16px', 
                                background: 'transparent', 
                                border: `1px solid ${colors.error}`, 
                                color: colors.error, 
                                borderRadius: '4px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                opacity: processing ? 0.5 : 1
                            }}
                        >
                            <X size={16} /> Reject
                        </button>
                        <button 
                            onClick={() => handleAction(review.id, 'approve')}
                            disabled={!!processing}
                            style={{ 
                                padding: '8px 16px', 
                                background: colors.success, 
                                border: 'none', 
                                color: 'white', 
                                borderRadius: '4px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                opacity: processing ? 0.5 : 1
                            }}
                        >
                            <Check size={16} /> Approve
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url.split('?')[0]);
