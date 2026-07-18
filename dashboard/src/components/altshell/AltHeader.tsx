/**
 * Shared top bar for all Alt desktop preview pages.
 * Breadcrumb + search (left), Upload + Messages + Notifications + Settings (right).
 * Accept an optional leftSlot for page-specific controls (e.g. slider arrows on Home).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useChat } from '../ChatProvider';
import { MusicNotificationMenu } from '../MusicNotificationMenu';
import { MessengerPopup } from '../MessengerPopup';
import { BG, S_CONT, PRIMARY, TERTIARY, TEXT, SUB, BORDER } from './AltSidebar';
import { useAltBreakpoint } from './useAltBreakpoint';
import { ChevronRight, Search, Upload, MessageCircle, Settings } from 'lucide-react';

export interface BreadcrumbItem {
    label: string;
    to?: string;
}

interface AltHeaderProps {
    breadcrumb?: BreadcrumbItem[];
    leftSlot?: React.ReactNode;
    accent?: string;
}

export const AltHeader: React.FC<AltHeaderProps> = ({ breadcrumb = [], leftSlot, accent = PRIMARY }) => {
    const { dropdownOpen: messengerOpen, setDropdownOpen: setMessengerOpen, unreadTotal: unreadMsgCount } = useChat();
    const bp = useAltBreakpoint();

    return (
        <header style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(15,19,29,0.7)', backdropFilter: 'blur(20px)', position: 'relative', zIndex: 50 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                {leftSlot && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{leftSlot}</div>}
                {breadcrumb.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SUB, flexShrink: 0 }}>
                        {breadcrumb.map((item, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <ChevronRight size={14} color={SUB} />}
                                {item.to
                                    ? <Link to={item.to} style={{ color: SUB, textDecoration: 'none' }}>{item.label}</Link>
                                    : <span style={{ color: TEXT }}>{item.label}</span>}
                            </React.Fragment>
                        ))}
                    </div>
                )}
                {/* Hide search at xs; shrink at md */}
                {bp !== 'xs' && (
                    <div style={{ position: 'relative', maxWidth: bp === 'md' ? 200 : 360, flex: 1 }}>
                        <Search size={18} color={SUB} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            placeholder="Search producers, tracks…"
                            style={{ width: '100%', background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 9999, padding: '8px 16px 8px 38px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                        />
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Upload: icon-only at xs */}
                <Link to="/upload" style={{ display: 'flex', alignItems: 'center', gap: bp === 'xs' ? 0 : 8, background: accent, color: '#fff', fontWeight: 700, fontSize: 13, padding: bp === 'xs' ? '9px' : '8px 16px', borderRadius: 9999, textDecoration: 'none' }}>
                    <Upload size={18} />{bp !== 'xs' && ' Upload'}
                </Link>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setMessengerOpen(!messengerOpen)}
                        style={{ width: 36, height: 36, borderRadius: '50%', background: messengerOpen ? `${accent}22` : S_CONT, border: messengerOpen ? `1px solid ${accent}55` : `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: messengerOpen ? accent : SUB, cursor: 'pointer', position: 'relative' }}
                    >
                        <MessageCircle size={18} />
                        {unreadMsgCount > 0 && (
                            <span style={{ position: 'absolute', top: -4, right: -4, background: TERTIARY, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 9999, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                            </span>
                        )}
                    </button>
                    <MessengerPopup />
                </div>
                <div style={{ position: 'relative' }} onClick={() => setMessengerOpen(false)}>
                    <MusicNotificationMenu />
                </div>
                <Link to="/account" style={{ width: 36, height: 36, borderRadius: '50%', background: S_CONT, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, textDecoration: 'none' }}>
                    <Settings size={18} />
                </Link>
            </div>
        </header>
    );
};
