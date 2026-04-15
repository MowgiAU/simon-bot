import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Plus, Trash2, Edit3, Save, X, Search } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { colors, spacing, borderRadius } from '../theme/theme';

const API = import.meta.env.VITE_API_URL || '';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProfileStyle {
    id: string;
    userId: string;
    gradient: string | null;
    animation: 'none' | 'shimmer' | 'pulse' | 'rainbow';
    glowColor: string | null;
    glowIntensity: number;
    badgeLabel: string | null;
    badgeColor: string | null;
    note: string | null;
    grantedAt: string;
    profile: { username: string; displayName: string | null; avatar: string | null } | null;
}

interface SearchResult {
    userId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
}

// ── Preset catalogue ─────────────────────────────────────────────────────────

const GRADIENT_PRESETS = [
    { label: 'None',   value: '' },
    { label: 'Sunset', value: 'linear-gradient(90deg,#FF6B6B,#FFD93D)' },
    { label: 'Ocean',  value: 'linear-gradient(90deg,#4facfe,#00f2fe)' },
    { label: 'Forest', value: 'linear-gradient(90deg,#11998e,#38ef7d)' },
    { label: 'Gold',   value: 'linear-gradient(90deg,#f7971e,#ffd200)' },
    { label: 'Nebula', value: 'linear-gradient(90deg,#a18cd1,#fbc2eb)' },
    { label: 'Neon',   value: 'linear-gradient(90deg,#08f7fe,#09fa6e)' },
    { label: 'Rose',   value: 'linear-gradient(90deg,#f953c6,#b91d73)' },
    { label: 'Fuji',   value: `linear-gradient(90deg,${colors.primary},${colors.accent})` },
    { label: 'Custom…', value: '__custom__' },
];

const ANIMATION_OPTIONS = [
    { value: 'none',     label: 'None' },
    { value: 'shimmer',  label: 'Shimmer sweep' },
    { value: 'pulse',    label: 'Pulse glow' },
    { value: 'rainbow',  label: 'Rainbow cycle' },
];

const GLOW_PRESETS = [
    { label: 'None',   value: '' },
    { label: 'Teal',   value: colors.primary },
    { label: 'Cyan',   value: colors.accent },
    { label: 'Gold',   value: '#FFD700' },
    { label: 'Rose',   value: '#f953c6' },
    { label: 'Orange', value: '#f7971e' },
    { label: 'Purple', value: '#a18cd1' },
];

// ── Blank form state ─────────────────────────────────────────────────────────

type FormState = Omit<ProfileStyle, 'id' | 'grantedAt' | 'profile'> & { _displayName: string; _avatar: string | null };

const blank = (): FormState => ({
    userId: '',
    _displayName: '',
    _avatar: null,
    gradient: null,
    animation: 'none',
    glowColor: null,
    glowIntensity: 6,
    badgeLabel: null,
    badgeColor: null,
    note: null,
});

// ── User Picker ─────────────────────────────────────────────────────────────

function UserPicker({ value, displayName, onSelect, onClear, disabled }: {
    value: string;
    displayName: string;
    onSelect: (userId: string, displayName: string, avatar: string | null) => void;
    onClear: () => void;
    disabled: boolean;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [open, setOpen] = useState(false);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (query.length < 2) { setResults([]); return; }
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const r = await fetch(`${API}/api/profile-styles/users/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
                setResults(r.ok ? await r.json() : []);
            } catch { setResults([]); }
            setSearching(false);
        }, 350);
        return () => clearTimeout(t);
    }, [query]);

    if (value) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                <Search size={14} color={colors.primary} />
                <span style={{ flex: 1, color: colors.textPrimary, fontSize: '14px' }}>{displayName || value}</span>
                {!disabled && (
                    <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: '2px', lineHeight: 0 }}>
                        <X size={14} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <Search size={14} color={colors.textSecondary} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder="Search by username or display name…"
                    style={{ ...inputStyle, paddingLeft: '30px' }}
                    autoComplete="off"
                />
                {searching && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: colors.textSecondary }}>…</span>}
            </div>
            {open && results.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', zIndex: 200, maxHeight: '220px', overflowY: 'auto', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                    {results.map(u => (
                        <button key={u.userId}
                            onMouseDown={() => { onSelect(u.userId, u.displayName || u.username, u.avatar); setQuery(''); setOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left' }}>
                            {u.avatar ? (
                                <img src={u.avatar.startsWith('http') ? u.avatar : `${API}${u.avatar}`} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                    {(u.displayName || u.username).charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>{u.displayName || u.username}</div>
                                {u.displayName && <div style={{ fontSize: '11px', color: colors.textSecondary }}>@{u.username}</div>}
                            </div>
                        </button>
                    ))}
                </div>
            )}
            {open && query.length >= 2 && !searching && results.length === 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', zIndex: 200, padding: '12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>No profiles found</span>
                </div>
            )}
        </div>
    );
}

// ── Live preview component ───────────────────────────────────────────────────

function StylePreview({ form }: { form: FormState }) {
    const gradient = form.gradient || '';
    const glowColor = form.glowColor || '';
    const glowPx = glowColor ? `0 0 ${form.glowIntensity * 3}px ${glowColor}88, 0 0 ${form.glowIntensity * 6}px ${glowColor}44` : 'none';

    const textStyle: React.CSSProperties = gradient
        ? { background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
        : { color: colors.textPrimary };

    const animClass = form.animation !== 'none' ? `ps-anim-${form.animation}` : '';

    return (
        <div style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: '20px 24px', border: `1px solid rgba(255,255,255,0.07)` }}>
            <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.textSecondary }}>Live Preview</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Avatar mock */}
                <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: gradient || colors.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', fontWeight: 800, color: '#1a1a1a',
                    boxShadow: glowPx,
                    border: glowColor ? `2px solid ${glowColor}66` : '2px solid transparent',
                    flexShrink: 0,
                }}>U</div>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={animClass} style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em', ...textStyle }}>
                            Username
                        </span>
                        {form.badgeLabel && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: `${form.badgeColor || '#FFD700'}22`, border: `1px solid ${form.badgeColor || '#FFD700'}55`, color: form.badgeColor || '#FFD700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {form.badgeLabel}
                            </span>
                        )}
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary }}>@username · Artist Profile</p>
                </div>
            </div>
        </div>
    );
}

// ── Editor Modal ─────────────────────────────────────────────────────────────

function StyleEditor({
    initial,
    onSave,
    onClose,
    saving,
}: {
    initial: FormState;
    onSave: (form: FormState) => void;
    onClose: () => void;
    saving: boolean;
}) {
    const [form, setForm] = useState(initial);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [customColor1, setCustomColor1] = useState('#FF6B6B');
    const [customColor2, setCustomColor2] = useState('#4ECDC4');
    const glowColorInputRef = useRef<HTMLInputElement>(null);

    const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

    const pickGradient = (preset: (typeof GRADIENT_PRESETS)[number]) => {
        if (preset.value === '__custom__') {
            setSelectedPreset('__custom__');
            const g = `linear-gradient(90deg, ${customColor1}, ${customColor2})`;
            set('gradient', g);
            return;
        }
        setSelectedPreset(preset.value);
        set('gradient', preset.value || null);
    };

    const applyCustomColors = (c1: string, c2: string) => {
        const g = `linear-gradient(90deg, ${c1}, ${c2})`;
        set('gradient', g);
        setSelectedPreset('__custom__');
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: '28px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', border: `1px solid rgba(255,255,255,0.07)` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.textPrimary }}>Enhanced Style</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: '4px' }}><X size={20} /></button>
                </div>

                {/* User search */}
                <div style={{ marginBottom: '16px' }}>
                    <span style={labelStyle}>User</span>
                    <UserPicker
                        value={form.userId}
                        displayName={form._displayName}
                        onSelect={(userId, displayName, avatar) => setForm(f => ({ ...f, userId, _displayName: displayName, _avatar: avatar }))}
                        onClear={() => setForm(f => ({ ...f, userId: '', _displayName: '', _avatar: null }))}
                        disabled={!!initial.userId}
                    />
                </div>

                {/* Gradient presets */}
                <div style={{ marginBottom: '16px' }}>
                    <span style={labelStyle}>Username Gradient</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                        {GRADIENT_PRESETS.map(p => (
                            <button key={p.label} onClick={() => pickGradient(p)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                    color: colors.textSecondary,
                                    outline: (selectedPreset ?? form.gradient ?? '') === p.value ? `2px solid ${colors.primary}` : '2px solid transparent',
                                    outlineOffset: '2px',
                                }}>
                                {p.value && p.value !== '__custom__' && (
                                    <span style={{ width: '22px', height: '10px', borderRadius: '3px', background: p.value, flexShrink: 0, display: 'inline-block' }} />
                                )}
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {selectedPreset === '__custom__' && (
                        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>Start</span>
                                    <input type="color" value={customColor1}
                                        onChange={e => { setCustomColor1(e.target.value); applyCustomColors(e.target.value, customColor2); }}
                                        style={{ width: '48px', height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', backgroundColor: 'transparent', padding: '2px' }} />
                                </div>
                                <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: `linear-gradient(90deg, ${customColor1}, ${customColor2})` }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>End</span>
                                    <input type="color" value={customColor2}
                                        onChange={e => { setCustomColor2(e.target.value); applyCustomColors(customColor1, e.target.value); }}
                                        style={{ width: '48px', height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', backgroundColor: 'transparent', padding: '2px' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Animation */}
                <div style={{ marginBottom: '16px' }}>
                    <span style={labelStyle}>Text Animation</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {ANIMATION_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => set('animation', opt.value as any)}
                                style={{ ...chipStyle, backgroundColor: form.animation === opt.value ? `${colors.primary}22` : 'rgba(255,255,255,0.05)', color: form.animation === opt.value ? colors.primary : colors.textSecondary, border: form.animation === opt.value ? `1px solid ${colors.primary}44` : '1px solid rgba(255,255,255,0.07)' }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Glow */}
                <div style={{ marginBottom: '16px' }}>
                    <span style={labelStyle}>Avatar Glow</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                        {GLOW_PRESETS.map(p => (
                            <button key={p.label} onClick={() => set('glowColor', p.value || null)}
                                style={{ ...chipStyle, backgroundColor: 'rgba(255,255,255,0.04)', border: (form.glowColor ?? '') === p.value ? `2px solid ${colors.primary}` : `2px solid transparent` }}>
                                {p.value && <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.value, display: 'inline-block', marginRight: '5px' }} />}
                                <span style={{ color: colors.textSecondary }}>{p.label}</span>
                            </button>
                        ))}
                        {/* Custom glow color */}
                        <button onClick={() => glowColorInputRef.current?.click()}
                            style={{ ...chipStyle, backgroundColor: 'rgba(255,255,255,0.04)', border: (form.glowColor && !GLOW_PRESETS.find(g => g.value === form.glowColor)) ? `2px solid ${colors.primary}` : `2px solid transparent` }}>
                            {form.glowColor && !GLOW_PRESETS.find(g => g.value === form.glowColor) && (
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: form.glowColor, display: 'inline-block', marginRight: '5px' }} />
                            )}
                            <span style={{ color: colors.textSecondary }}>Custom…</span>
                        </button>
                        <input ref={glowColorInputRef} type="color" value={form.glowColor || '#ffffff'}
                            onChange={e => set('glowColor', e.target.value)}
                            style={{ display: 'none' }} />
                    </div>
                    {form.glowColor && (
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>Intensity</span>
                            <input type="range" min="1" max="10" value={form.glowIntensity} onChange={e => set('glowIntensity', Number(e.target.value))} style={{ flex: 1, accentColor: colors.primary }} />
                            <span style={{ fontSize: '12px', color: colors.textPrimary, width: '20px' }}>{form.glowIntensity}</span>
                        </div>
                    )}
                </div>

                {/* Badge */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <label>
                        <span style={labelStyle}>Badge Label (optional)</span>
                        <input value={form.badgeLabel || ''} onChange={e => set('badgeLabel', e.target.value || null)} placeholder="e.g. OG Member" style={inputStyle} />
                    </label>
                    <label>
                        <span style={labelStyle}>Badge Color</span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                            <input type="color" value={form.badgeColor || '#FFD700'} onChange={e => set('badgeColor', e.target.value)} style={{ width: '38px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }} />
                            <input value={form.badgeColor || ''} onChange={e => set('badgeColor', e.target.value || null)} placeholder="#FFD700" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                        </div>
                    </label>
                </div>

                {/* Note */}
                <label style={{ display: 'block', marginBottom: '20px' }}>
                    <span style={labelStyle}>Internal Note (optional)</span>
                    <input value={form.note || ''} onChange={e => set('note', e.target.value || null)} placeholder="e.g. Granted for winning Beat Battle #3" style={inputStyle} />
                </label>

                {/* Preview */}
                <StylePreview form={form} />

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={btnSecondary}>Cancel</button>
                    <button onClick={() => onSave(form)} disabled={saving || !form.userId} style={{ ...btnPrimary, opacity: saving || !form.userId ? 0.5 : 1 }}>
                        <Save size={14} /> {saving ? 'Saving…' : 'Save Style'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Shared micro-styles ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: colors.textPrimary, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: 0 };
const chipStyle: React.CSSProperties = { padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', backgroundColor: colors.primary, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' };

// ── Animation keyframes injected once ────────────────────────────────────────

const ANIM_CSS = `
@keyframes ps-shimmer-move { 0% { left: -70%; } 100% { left: 120%; } }
@keyframes ps-pulse   { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes ps-rainbow { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
.ps-anim-shimmer { position: relative !important; overflow: hidden !important; display: inline-block !important; }
.ps-anim-shimmer::after {
  content: '';
  position: absolute;
  top: -20%;
  left: -70%;
  width: 45%;
  height: 140%;
  background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
  animation: ps-shimmer-move 2.2s ease-in-out infinite;
  pointer-events: none;
}
.ps-anim-pulse   { animation: ps-pulse 2s ease-in-out infinite !important; }
.ps-anim-rainbow { animation: ps-rainbow 4s linear infinite !important; }
`;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProfileStyles() {
    const { selectedGuild } = useAuth();
    const guildId = selectedGuild?.id;

    const [styles, setStyles] = useState<ProfileStyle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [editing, setEditing] = useState<FormState | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!guildId) return;
        setLoading(true);
        try {
            const r = await fetch(`${API}/api/guilds/${guildId}/profile-styles`, { credentials: 'include' });
            if (!r.ok) throw new Error('Failed');
            setStyles(await r.json());
        } catch {
            setError('Failed to load styles.');
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => { load(); }, [load]);

    // Inject animation CSS once
    useEffect(() => {
        if (document.getElementById('ps-anim-css')) return;
        const el = document.createElement('style');
        el.id = 'ps-anim-css';
        el.textContent = ANIM_CSS;
        document.head.appendChild(el);
    }, []);

    const save = async (form: FormState) => {
        if (!guildId || !form.userId) return;
        setSaving(true);
        try {
            // Strip UI-only fields before sending to API
            const { _displayName, _avatar, ...payload } = form;
            const r = await fetch(`${API}/api/guilds/${guildId}/profile-styles`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!r.ok) throw new Error('Failed');
            setEditing(null);
            await load();
        } catch {
            alert('Failed to save. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (userId: string) => {
        if (!guildId) return;
        setDeleting(userId);
        try {
            await fetch(`${API}/api/guilds/${guildId}/profile-styles/${userId}`, { method: 'DELETE', credentials: 'include' });
            setConfirming(null);
            await load();
        } finally {
            setDeleting(null);
        }
    };

    const openEdit = (s?: ProfileStyle) => {
        if (s) {
            setEditing({
                userId: s.userId,
                _displayName: s.profile?.displayName || s.profile?.username || s.userId,
                _avatar: s.profile?.avatar || null,
                gradient: s.gradient,
                animation: s.animation,
                glowColor: s.glowColor,
                glowIntensity: s.glowIntensity,
                badgeLabel: s.badgeLabel,
                badgeColor: s.badgeColor,
                note: s.note,
            });
        } else {
            setEditing(blank());
        }
    };

    return (
        <div style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <Sparkles size={32} color={colors.primary} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                    <h1 style={{ margin: 0 }}>Enhanced Profile Styles</h1>
                    <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Grant gradient text, glow effects, and animations on users' public profile pages.</p>
                </div>
            </div>

            {/* Explanation */}
            <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
                <p style={{ margin: 0, color: colors.textPrimary }}>
                    Enhanced styles are applied client-side on the public profile page — similar to Discord's Enhanced Role Styles feature. Styles are guild-scoped and require a user's Discord ID. Users do not need to do anything to receive them.
                </p>
            </div>

            {/* Add button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button onClick={() => openEdit()} style={btnPrimary}>
                    <Plus size={14} /> Grant Style
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <p style={{ color: colors.textSecondary }}>Loading…</p>
            ) : error ? (
                <p style={{ color: '#F43F5E' }}>{error}</p>
            ) : styles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: colors.surface, borderRadius: borderRadius.lg, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Sparkles size={36} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: colors.textPrimary }}>No enhanced styles yet</p>
                    <p style={{ margin: 0, color: colors.textSecondary, fontSize: '13px' }}>Click "Grant Style" to add the first one.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {styles.map(s => {
                        const gradient = s.gradient || '';
                        const glowPx = s.glowColor ? `0 0 ${s.glowIntensity * 3}px ${s.glowColor}88` : 'none';
                        const textStyle: React.CSSProperties = gradient
                            ? { background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                            : { color: colors.textPrimary };
                        return (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                {/* Avatar swatch */}
                                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: gradient || colors.primary, flexShrink: 0, boxShadow: glowPx, border: s.glowColor ? `2px solid ${s.glowColor}55` : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#1a1a1a' }}>U</div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                                        <span key={gradient || 'none'} style={{ fontWeight: 700, fontSize: '14px', ...textStyle }}>
                                            {s.profile?.displayName || s.profile?.username || s.userId}
                                        </span>
                                        {s.profile?.username && (
                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>@{s.profile.username}</span>
                                        )}
                                        {s.badgeLabel && (
                                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px', backgroundColor: `${s.badgeColor || '#FFD700'}22`, border: `1px solid ${s.badgeColor || '#FFD700'}55`, color: s.badgeColor || '#FFD700', textTransform: 'uppercase' }}>
                                                {s.badgeLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: colors.textSecondary, flexWrap: 'wrap' }}>
                                        {gradient && <span>Gradient</span>}
                                        {s.animation !== 'none' && <span>· {s.animation}</span>}
                                        {s.glowColor && <span>· Glow</span>}
                                        {s.note && <span style={{ fontStyle: 'italic' }}>· {s.note}</span>}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    <button onClick={() => openEdit(s)} style={{ ...chipStyle, backgroundColor: 'rgba(255,255,255,0.05)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.07)' }}>
                                        <Edit3 size={13} />
                                    </button>
                                    {confirming === s.userId ? (
                                        <>
                                            <button onClick={() => remove(s.userId)} disabled={deleting === s.userId} style={{ ...chipStyle, backgroundColor: '#F43F5E22', color: '#F43F5E', border: '1px solid #F43F5E44' }}>
                                                {deleting === s.userId ? '…' : 'Confirm'}
                                            </button>
                                            <button onClick={() => setConfirming(null)} style={{ ...chipStyle, backgroundColor: 'rgba(255,255,255,0.04)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.07)' }}>
                                                <X size={13} />
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => setConfirming(s.userId)} style={{ ...chipStyle, backgroundColor: 'rgba(255,255,255,0.04)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.07)' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Editor modal */}
            {editing && (
                <StyleEditor
                    initial={editing}
                    onSave={save}
                    onClose={() => setEditing(null)}
                    saving={saving}
                />
            )}
        </div>
    );
}
