/**
 * Shared right activity sidebar for the Alt F suite.
 * Self-fetching — drop it into any Alt F page and it manages its own data.
 * Collapsible — state persisted in localStorage.
 * Edit this file once to change the sidebar on every Alt F page.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../PlayerProvider';
import { useAltBreakpoint } from './useAltBreakpoint';
import { PanelRightClose, PanelRightOpen, Swords, Music, Activity, MessageCircle, Newspaper, Plus, Layers, Sparkles, Zap, Users } from 'lucide-react';
import {
    BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, arr,
} from './AltSidebar';
import { RadialPieMenu, PieItem } from './RadialPieMenu';
import { AltSpinner } from './AltSpinner';
import { AltMobileSheet } from './AltMobileSheet';
import { MOBILE_NAV_HEIGHT } from './AltMobileNav';

const DIVIDER = 'rgba(87,66,54,0.25)';
const LS_KEY = 'fuji_right_sidebar_collapsed';

export interface RailSection { key: string; label: string; icon: React.ReactNode; content: React.ReactNode }

// Live "someone's waiting to battle" teaser — surfaces the arena lobby on every Alt F page.
const ArenaTeaser: React.FC = () => {
    const [summary, setSummary] = useState<{ waiting: number; inMatch: number; voting: number } | null>(null);
    useEffect(() => {
        const load = () => axios.get('/api/head-to-head/lobby').then(r => setSummary(r.data.summary)).catch(() => {});
        load();
        const t = setInterval(load, 12000);
        return () => clearInterval(t);
    }, []);
    if (!summary || (summary.waiting === 0 && summary.inMatch === 0)) return null;
    const hot = summary.waiting > 0;
    return (
        <Link to="/arena" style={{ display: 'block', textDecoration: 'none', marginBottom: 18 }}>
            <div style={{ borderRadius: 14, padding: '12px 14px', background: hot ? 'linear-gradient(135deg, rgba(255,103,121,0.15), rgba(242,120,10,0.08))' : S_CONT, border: `1px solid ${hot ? 'rgba(255,103,121,0.3)' : BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${TERTIARY}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={16} color={TERTIARY} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: TEXT }}>
                        {hot ? `${summary.waiting} waiting to battle` : `${summary.inMatch} battle${summary.inMatch > 1 ? 's' : ''} live`}
                    </div>
                    <div style={{ fontSize: 11, color: SUB, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {hot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: TERTIARY, display: 'inline-block' }} />}
                        Enter the Arena →
                    </div>
                </div>
            </div>
        </Link>
    );
};

export const AltActivitySidebar: React.FC<{ topSlot?: React.ReactNode; showCommunity?: boolean; railSections?: RailSection[]; primaryAction?: { label: string; onClick: () => void } }> = ({ topSlot, showCommunity = true, railSections, primaryAction }) => {
    const { player } = usePlayer();
    const navigate = useNavigate();
    const [battles, setBattles] = useState<any[]>([]);
    const [activity, setActivity] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [latestArticle, setLatestArticle] = useState<any>(null);
    const [mobilePieOpen, setMobilePieOpen] = useState(false);
    const [mobileSheet, setMobileSheet] = useState<{ title: string; content: React.ReactNode } | null>(null);
    const bp = useAltBreakpoint();

    // Pages that inject their own controls (topSlot / railSections) treat that content as
    // essential — the rail stays expanded down to md (≥900) instead of auto-collapsing to a
    // narrow icon strip that hides the sort/genre/overview cards. Community-only rails keep
    // the old behaviour (collapse < lg).
    const hasPageContent = !!topSlot || ((railSections?.length ?? 0) > 0);

    const [collapsed, setCollapsed] = useState(() => {
        const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
        if (w < (hasPageContent ? 900 : 1100)) return true;
        try { return localStorage.getItem(LS_KEY) === 'true'; } catch { return false; }
    });

    // Auto-collapse on narrow resize, restore preference otherwise.
    useEffect(() => {
        const forceCollapse = hasPageContent ? (bp === 'xs' || bp === 'sm') : (bp !== 'lg');
        if (forceCollapse) {
            setCollapsed(true);
        } else {
            try { setCollapsed(localStorage.getItem(LS_KEY) === 'true'); } catch {}
        }
    }, [bp, hasPageContent]);

    const toggle = () => setCollapsed(c => {
        const next = !c;
        if (bp === 'lg') { try { localStorage.setItem(LS_KEY, String(next)); } catch {} }
        return next;
    });

    useEffect(() => {
        if (!showCommunity) return;
        axios.get('/api/beat-battle/battles').then(r => setBattles(arr(r.data).slice(0, 1))).catch(() => {});
        axios.get('/api/discovery/tracks?limit=6').then(r => setActivity(arr(r.data).slice(0, 6))).catch(() => {});
        axios.get('/api/comments/recent').then(r => setComments(arr(r.data).slice(0, 5))).catch(() => {});
        axios.get('/api/articles?limit=1').then(r => {
            const list = arr(r.data?.articles ?? r.data);
            setLatestArticle(list[0] ?? null);
        }).catch(() => {});
    }, [showCommunity]);

    const communityContent = (
        <>
        {/* Arena lobby teaser */}
        <ArenaTeaser />
        {/* Active Battles */}
        {battles.length > 0 && (
            <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Swords size={14} color={TERTIARY} />
                        <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Battles</span>
                    </div>
                    <Link to="/battles" style={{ fontSize: 10, color: PRIMARY, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>More →</Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {battles.map((b: any) => {
                        const live = b.status === 'active' || b.status === 'voting';
                        return (
                            <Link key={b.id} to={`/battles/${b.slug || b.id}`}
                                style={{ position: 'relative', overflow: 'hidden', height: 100, borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '10px 12px', textDecoration: 'none', color: '#fff', background: 'rgba(15,19,29,0.7)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', transition: 'border-color 0.2s, transform 0.15s' }}
                                onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${PRIMARY}66`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}>
                                {b.cardImageUrl && (
                                    <img src={b.cardImageUrl} alt="" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                )}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.15))' }} />
                                <div style={{ position: 'relative', zIndex: 1 }}>
                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: live ? TERTIARY : 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {live ? 'Live' : b.status === 'completed' ? 'Ended' : 'Upcoming'}
                                    </span>
                                    <p style={{ margin: '5px 0 0', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>
        )}

        {/* Latest News */}
        {latestArticle && (
            <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Newspaper size={14} color={SECONDARY} />
                        <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Latest News</span>
                    </div>
                    <Link to="/articles" style={{ fontSize: 10, color: PRIMARY, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>More →</Link>
                </div>
                <Link
                    to={latestArticle.slug ? `/article/${latestArticle.slug}` : '/articles'}
                    style={{ display: 'block', borderRadius: 12, overflow: 'hidden', textDecoration: 'none', color: 'inherit', background: 'rgba(15,19,29,0.7)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', transition: 'border-color 0.2s' }}
                    onMouseEnter={ev => (ev.currentTarget.style.borderColor = `${PRIMARY}66`)}
                    onMouseLeave={ev => (ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                >
                    {latestArticle.coverImageUrl && (
                        <div style={{ height: 80, overflow: 'hidden', position: 'relative' }}>
                            <img src={latestArticle.coverImageUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,0.7), transparent)' }} />
                        </div>
                    )}
                    <div style={{ padding: '10px 12px' }}>
                        {latestArticle.category && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: SECONDARY, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{latestArticle.category} · </span>
                        )}
                        <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                            {latestArticle.title}
                        </p>
                    </div>
                </Link>
            </section>
        )}

        {/* Recent Activity */}
        {activity.length > 0 && (
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Music size={14} color={SECONDARY} />
                    <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Recent Activity</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {activity.map((t: any) => (
                        <Link key={t.id} to={`/profile/${t.profile?.username || ''}`}
                            style={{ display: 'flex', gap: 10, textDecoration: 'none', color: TEXT, alignItems: 'flex-start' }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: S_HIGH }}>
                                {t.profile?.avatar && (
                                    <img src={t.profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t.profile?.displayName || t.profile?.username || 'Unknown'}
                                </p>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Music size={10} /> {t.title}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        )}

        {/* Recent Comments */}
        {comments.length > 0 && (
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <MessageCircle size={14} color='#a78bfa' />
                    <span style={{ fontSize: 10, color: SUB, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Recent Comments</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {comments.map((c: any) => {
                        const targetName = c.track?.title || c.profile?.displayName || c.profile?.username || 'a post';
                        return (
                            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: S_HIGH, marginTop: 1 }}>
                                    {c.avatarUrl && (
                                        <img src={c.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TEXT }}>
                                        {c.username}
                                        <span style={{ color: SUB, fontWeight: 400 }}> on {targetName}</span>
                                    </p>
                                    <p style={{ margin: '3px 0 0', fontSize: 11, color: SUB, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4, fontStyle: 'italic' }}>
                                        {c.content.length > 80 ? c.content.slice(0, 80) + '…' : c.content}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        )}

        {showCommunity && battles.length === 0 && activity.length === 0 && comments.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: SUB, fontSize: 13 }}><AltSpinner /></div>
        )}
        </>
    );

    // Mobile (xs, <600px): replace the icon-strip with a FAB that opens a radial
    // pie menu for this page's content — Create Post is a direct action, the rest
    // (page sections / community) open a bottom sheet with the same content the
    // desktop rail shows.
    if (bp === 'xs' || (bp === 'sm' && hasPageContent)) {
        const wedgeItems: PieItem[] = [
            { key: 'post', label: primaryAction ? primaryAction.label : 'Post', icon: primaryAction ? <Zap size={20} /> : <Plus size={20} />, onClick: primaryAction ? primaryAction.onClick : () => navigate('/create-post') },
            ...(railSections && railSections.length > 0
                ? railSections.map(s => ({ key: s.key, label: s.label, icon: s.icon, onClick: () => setMobileSheet({ title: s.label, content: s.content }) }))
                : topSlot ? [{ key: 'page', label: 'Page', icon: <Layers size={20} />, onClick: () => setMobileSheet({ title: 'Page', content: topSlot }) }] : []),
            ...(showCommunity ? [{ key: 'community', label: 'Community', icon: <Activity size={20} />, onClick: () => setMobileSheet({ title: 'Community', content: communityContent }) }] : []),
        ];
        const fabBottom = MOBILE_NAV_HEIGHT + 16 + (player.currentTrack ? 90 : 0);

        return (
            <>
                <button onClick={() => setMobilePieOpen(true)} aria-label="Page menu"
                    style={{ position: 'fixed', right: 16, bottom: fabBottom, width: 52, height: 52, borderRadius: '50%', background: PRIMARY, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 20px ${PRIMARY}66`, zIndex: 210, cursor: 'pointer' }}>
                    <Sparkles size={22} />
                </button>
                <RadialPieMenu open={mobilePieOpen} onClose={() => setMobilePieOpen(false)} items={wedgeItems} />
                <AltMobileSheet open={!!mobileSheet} onClose={() => setMobileSheet(null)} title={mobileSheet?.title}>
                    {mobileSheet?.content}
                </AltMobileSheet>
            </>
        );
    }

    const w = collapsed ? 48 : 303;
    const pb = player.currentTrack ? 90 : 0;

    /* — collapsed strip — */
    if (collapsed) {
        return (
            <>
            <aside style={{ width: w, minWidth: w, background: BG, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: pb, gap: 18, flexShrink: 0, transition: 'width 0.25s ease, min-width 0.25s ease', fontFamily: FONT, overflowX: 'hidden' }}>
                <button onClick={toggle} title="Expand activity" style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PanelRightOpen size={18} />
                </button>
                {/* Page controls stay reachable while collapsed — each opens a sheet. */}
                {railSections?.map(s => (
                    <button key={s.key} onClick={() => setMobileSheet({ title: s.label, content: s.content })} title={s.label}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {s.icon}
                    </button>
                ))}
                {showCommunity && <>
                    <div title="Battles" style={{ color: TERTIARY, opacity: 0.7, display: 'flex' }}><Swords size={16} /></div>
                    <div title="Activity" style={{ color: SECONDARY, opacity: 0.7, display: 'flex' }}><Activity size={16} /></div>
                </>}
            </aside>
            <AltMobileSheet open={!!mobileSheet} onClose={() => setMobileSheet(null)} title={mobileSheet?.title}>
                {mobileSheet?.content}
            </AltMobileSheet>
            </>
        );
    }

    /* — expanded sidebar — */
    return (
        <aside style={{ width: w, minWidth: w, background: BG, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0, fontFamily: FONT, color: TEXT, paddingBottom: pb, transition: 'width 0.25s ease, min-width 0.25s ease', overflowX: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} color={SECONDARY} /> Community
                </h3>
                <button onClick={toggle} title="Collapse activity" style={{ background: 'none', border: 'none', color: SUB, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                    <PanelRightClose size={17} />
                </button>
            </div>

            {/* Primary action — page-specific override (e.g. "Enter Battle") or default "Create Post" */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                {primaryAction ? (
                    <button onClick={primaryAction.onClick}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '9px 0', background: PRIMARY, border: 'none', borderRadius: 9, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800, letterSpacing: '0.01em', boxSizing: 'border-box', fontFamily: FONT }}>
                        <Zap size={15} /> {primaryAction.label}
                    </button>
                ) : (
                    <Link to="/create-post"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '9px 0', background: PRIMARY, borderRadius: 9, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 800, letterSpacing: '0.01em', boxSizing: 'border-box' }}>
                        <Plus size={15} /> Create Post
                    </Link>
                )}
            </div>

            {/* Content — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* Page-specific extras (e.g. Home injects Top Artists + Trending Tracks) */}
                {topSlot}

{communityContent}
            </div>
        </aside>
    );
};
