/**
 * Mixer — FL Studio mixer console, styled after the Stitch Mixer design.
 *
 * Layout: an inspector panel on the left (effect slots, EQ, sends, outputs for
 * whichever insert is selected) and a horizontally-scrolling bank of channel
 * strips on the right, master first.
 *
 * The design's decorative parts stay decorative (effect slots, EQ curve,
 * output pickers — the simulator has no plugin host behind them), but every
 * control that maps onto real DAWStore state is wired: fader → volume, knob →
 * pan, LED → mute, and the inspector's send knob → reverb.
 */
import React, { useState } from 'react';
import {
    Menu, Minus, Square, X, ChevronDown, ChevronUp,
    Circle, Triangle, Clock, ArrowDown,
} from 'lucide-react';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';
import { daw, dawFx, dawFont } from './dawTheme';

const STRIP_W = 52;
const MASTER_W = 64;
const FADER_H = 120;
const MAX_GAIN = 1.25;   // matches the previous mixer's range, so audio behaviour is unchanged

const vertText: React.CSSProperties = {
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    letterSpacing: '0.12em',
};

/** Vertical fader. Drag anywhere on the track; the handle follows the pointer. */
const Fader: React.FC<{
    value: number;
    onChange: (v: number) => void;
    height: number;
    trackW: number;
    handleW: number;
    handleH: number;
    active?: boolean;
    highlight?: boolean;
    /** data-academy-id so lessons can point the coachmark bubble at a specific fader */
    academyId?: string;
}> = ({ value, onChange, height, trackW, handleW, handleH, active, highlight, academyId }) => {
    const trackRef = React.useRef<HTMLDivElement>(null);

    const apply = (clientY: number) => {
        const el = trackRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const pct = 1 - (clientY - r.top) / r.height;
        onChange(Math.max(0, Math.min(MAX_GAIN, pct * MAX_GAIN)));
    };

    const pct = Math.min(value / MAX_GAIN, 1) * 100;

    return (
        <div
            ref={trackRef}
            data-academy-id={academyId}
            onPointerDown={e => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                apply(e.clientY);
            }}
            onPointerMove={e => { if (e.buttons) { e.preventDefault(); apply(e.clientY); } }}
            style={{
                position: 'relative', height, width: handleW,
                display: 'flex', justifyContent: 'center',
                cursor: 'pointer',
                // Without this the browser's own pan gesture can swallow the drag
                touchAction: 'none',
            }}
        >
            {/* Track */}
            <div style={{
                width: trackW, height: '100%',
                background: daw.well, borderRadius: 2,
                boxShadow: highlight
                    ? `${dawFx.faderTrackShadow}, 0 0 0 1px ${daw.green}`
                    : dawFx.faderTrackShadow,
                position: 'relative', overflow: 'hidden',
            }}>
                {active && (
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: `${pct}%`, background: daw.green, opacity: 0.5,
                    }} />
                )}
            </div>
            {/* Handle */}
            <div style={{
                position: 'absolute', left: '50%', bottom: `${pct}%`,
                transform: 'translate(-50%, 50%)',
                width: handleW, height: handleH, borderRadius: 2,
                background: active ? dawFx.faderHandleActive : dawFx.faderHandle,
                border: `1px solid ${active ? daw.greenEdge : '#555'}`,
                boxShadow: dawFx.faderHandleShadow,
                pointerEvents: 'none',
            }} />
        </div>
    );
};

const Led: React.FC<{ on: boolean; onClick?: () => void; title?: string }> = ({ on, onClick, title }) => (
    <div
        onClick={onClick}
        title={title}
        style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: on ? daw.green : daw.well,
            boxShadow: on ? dawFx.ledOn : dawFx.ledOff,
            cursor: onClick ? 'pointer' : 'default',
        }}
    />
);

/** Inspector row / output picker — decorative, matching the design's dropdowns */
const PickerRow: React.FC<{ icon?: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: daw.dark, border: `1px solid ${daw.border}`, borderRadius: 3,
        padding: '3px 8px', fontSize: 11,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {icon}
            <span style={{ color: daw.white }}>{label}</span>
        </div>
        <ChevronDown size={12} color={daw.text} />
    </div>
);

interface MixerProps {
    highlightInserts?: number[];
    /** Open the Parametric EQ for an insert — wired to slot 1, as in FL */
    onOpenEQ?: (insertId: number) => void;
}

export const Mixer: React.FC<MixerProps> = ({ highlightInserts, onOpenEQ }) => {
    const inserts = useDAWStore(s => s.state.mixerInserts);
    const masterVolume = useDAWStore(s => s.state.masterVolume);
    const setInsertVolume = useDAWStore(s => s.setInsertVolume);
    const setInsertPan = useDAWStore(s => s.setInsertPan);
    const toggleInsertMute = useDAWStore(s => s.toggleInsertMute);
    const setInsertReverb = useDAWStore(s => s.setInsertReverb);
    const setMasterVolume = useDAWStore(s => s.setMasterVolume);

    // Which strip the inspector is describing. Insert 1 if present, else master.
    const [selectedId, setSelectedId] = useState<number>(() => inserts[1]?.id ?? inserts[0]?.id ?? 0);
    const selected = inserts.find(i => i.id === selectedId) ?? inserts[0];

    return (
        <div style={{
            background: daw.bg,
            fontFamily: dawFont.sans,
            color: daw.text,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Channel-strip scrollbar — pseudo-elements can't be set inline */}
            <style>{`
                .fuji-mixer-scroll::-webkit-scrollbar { height: 8px; }
                .fuji-mixer-scroll::-webkit-scrollbar-track { background: ${daw.dark}; }
                .fuji-mixer-scroll::-webkit-scrollbar-thumb {
                    background: ${daw.highlight}; border-radius: 4px;
                }
            `}</style>

            {/* ── Title bar ── */}
            <header style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: daw.dark, borderBottom: `1px solid ${daw.border}`,
                padding: '4px 12px', fontSize: 11, userSelect: 'none',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: daw.textBright }}>
                    <Menu size={12} />
                    <span style={{ fontWeight: 600 }}>Mixer — {selected?.label ?? 'Master'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: daw.text }}>
                    <span style={{ fontSize: 10 }}>Wide</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Minus size={12} /><Square size={10} /><X size={12} />
                    </div>
                </div>
            </header>

            {/* ── Main ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Inspector */}
                <aside style={{
                    width: 220, flexShrink: 0,
                    background: daw.panel, borderRight: `1px solid ${daw.border}`,
                    display: 'flex', flexDirection: 'column', gap: 8, padding: 8,
                }}>
                    <PickerRow label="(none)" />

                    {/* Effect slots. Slot 1 hosts the real Parametric EQ 2; the rest are
                        decorative, since there's no general plugin host behind them. */}
                    <div style={{
                        border: `1px solid ${daw.border}`, background: daw.bg,
                        borderRadius: 3, padding: 4,
                        display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                        {Array.from({ length: 8 }, (_, i) => {
                            const isEQ = i === 0;
                            return (
                                <div key={i}
                                    onClick={isEQ && selected ? () => onOpenEQ?.(selected.id) : undefined}
                                    data-academy-id={isEQ && selected ? `mixer-slot-eq-${selected.id}` : undefined}
                                    title={isEQ ? 'Open Fruity Parametric EQ 2' : undefined}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '1px 6px', borderRadius: 2, fontSize: 11,
                                        color: isEQ ? daw.textBright : daw.textDim,
                                        cursor: isEQ ? 'pointer' : 'default',
                                        background: isEQ ? daw.dark : 'transparent',
                                    }}>
                                    <span style={{
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        ▾ {isEQ ? 'Fruity Parametric EQ 2' : `Slot ${i + 1}`}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                        <div style={{
                                            width: 12, height: 12, borderRadius: '50%',
                                            border: `1px solid ${daw.textDim}`,
                                        }} />
                                        <Led on />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* EQ visualiser — decorative */}
                    <div style={{
                        height: 96, position: 'relative', borderRadius: 3,
                        background: daw.dark, border: `1px solid ${daw.border}`, padding: 8,
                    }}>
                        <div style={{
                            position: 'absolute', inset: 8, borderRadius: 3,
                            border: `1px dashed ${daw.textDim}`, opacity: 0.3,
                        }} />
                        <div style={{
                            position: 'absolute', left: 8, right: 8, top: '50%',
                            height: 2, background: daw.textDim, transform: 'translateY(-50%)',
                        }} />
                        <span style={{
                            position: 'absolute', bottom: 4, left: 8,
                            fontSize: 10, color: daw.textDim,
                        }}>Equalizer</span>
                    </div>

                    {/* Send — the one inspector control that's wired to real state */}
                    {selected && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: daw.dark, border: `1px solid ${daw.border}`,
                            borderRadius: 3, padding: '4px 8px',
                        }}>
                            <span style={{ fontSize: 11 }}>Reverb send</span>
                            <FLKnob
                                value={selected.reverbWet}
                                onChange={v => setInsertReverb(selected.id, v)}
                                size={22} color={daw.green} label="Reverb send" showLabel={false}
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <PickerRow icon={<Circle size={11} color={daw.text} fill={daw.text} />} label="(none)" />
                        <PickerRow icon={<Triangle size={11} color={daw.text} fill={daw.text} />} label="(none)" />
                    </div>
                </aside>

                {/* Channel strips */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: daw.bg, overflow: 'hidden' }}>
                    <div className="fuji-mixer-scroll" style={{
                        flex: 1, display: 'flex', gap: 4, padding: 8, overflowX: 'auto',
                    }}>
                        {inserts.map((ins, idx) => {
                            const isMaster = idx === 0;
                            const isSelected = ins.id === selectedId;
                            const hl = highlightInserts?.includes(ins.id) ?? false;
                            const vol = isMaster ? masterVolume : ins.volume;
                            const width = isMaster ? MASTER_W : STRIP_W;

                            return (
                                <React.Fragment key={ins.id}>
                                    <div
                                        onClick={() => setSelectedId(ins.id)}
                                        data-academy-id={`mixer-insert-${ins.id}`}
                                        style={{
                                            width, flexShrink: 0,
                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                            padding: '8px 0', borderRadius: 3, cursor: 'pointer',
                                            background: isSelected ? daw.highlight : daw.panel,
                                            border: `1px solid ${hl ? daw.green : daw.border}`,
                                            boxShadow: hl ? `0 0 8px ${daw.green}88` : 'none',
                                        }}>
                                        {/* Number / M badge */}
                                        <div style={{
                                            fontSize: 10, marginBottom: 4,
                                            color: isSelected ? daw.white : daw.text,
                                            fontWeight: isSelected ? 700 : 400,
                                            border: isSelected ? `1px solid ${daw.green}` : '1px solid transparent',
                                            borderRadius: 2, padding: '0 4px',
                                            ...(isMaster ? {
                                                width: '100%', textAlign: 'center' as const,
                                                borderBottom: `1px solid ${daw.textDim}`,
                                                paddingBottom: 4, borderRadius: 0,
                                            } : {}),
                                        }}>
                                            {isMaster ? 'M' : idx}
                                        </div>

                                        {/* Vertical label */}
                                        <div style={{
                                            ...vertText,
                                            height: 84, margin: '10px 0', fontSize: 11,
                                            color: isSelected ? daw.white : daw.textBright,
                                            whiteSpace: 'nowrap', overflow: 'hidden',
                                        }}>
                                            {ins.label}
                                        </div>

                                        <Led
                                            on={!ins.muted}
                                            onClick={() => toggleInsertMute(ins.id)}
                                            title={ins.muted ? 'Unmute' : 'Mute'}
                                        />

                                        {/* Pan */}
                                        <div style={{ margin: '8px 0' }}>
                                            <FLKnob
                                                value={ins.pan} min={-1} max={1}
                                                onChange={v => setInsertPan(ins.id, v)}
                                                size={isMaster ? 32 : 28}
                                                color={daw.green}
                                                label="Pan" showLabel={false}
                                            />
                                        </div>

                                        {!isMaster && (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                color: daw.textDim, fontSize: 9, marginBottom: 6,
                                            }}>
                                                <ChevronDown size={9} />
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: daw.textDim }} />
                                                <ChevronUp size={9} />
                                            </div>
                                        )}

                                        {/* Fader */}
                                        <Fader
                                            value={vol}
                                            onChange={v => isMaster ? setMasterVolume(v) : setInsertVolume(ins.id, v)}
                                            academyId={`mixer-fader-${ins.id}`}
                                            height={FADER_H}
                                            trackW={isMaster ? 8 : 6}
                                            handleW={isMaster ? 24 : 20}
                                            handleH={isMaster ? 16 : 12}
                                            active={isSelected && !ins.muted}
                                            highlight={hl}
                                        />

                                        {/* Bottom cluster */}
                                        <div style={{
                                            marginTop: 10, display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', gap: 8, color: daw.textDim,
                                        }}>
                                            {isMaster
                                                ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${daw.textDim}` }} />
                                                : <Clock size={12} />}
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: daw.textDim }} />
                                            {isSelected
                                                ? <ArrowDown size={15} color={daw.green} />
                                                : <ChevronUp size={12} />}
                                        </div>
                                    </div>

                                    {/* Divider after master, as in the design */}
                                    {isMaster && (
                                        <div style={{ width: 4, flexShrink: 0, background: daw.dark, margin: '0 4px' }} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Bottom rail */}
                    <div style={{
                        height: 16, background: daw.dark, borderTop: `1px solid ${daw.border}`,
                        display: 'flex', alignItems: 'center', padding: '0 8px',
                    }}>
                        <div style={{
                            height: 4, width: '25%', margin: '0 auto',
                            background: daw.textDim, borderRadius: 9999,
                        }} />
                    </div>
                </div>
            </div>
        </div>
    );
};
