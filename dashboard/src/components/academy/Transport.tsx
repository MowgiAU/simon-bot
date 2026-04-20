/**
 * Transport — Play/Stop, BPM, Swing controls bar.
 * Mimics the FL Studio toolbar transport section.
 */
import React from 'react';
import { colors, borderRadius } from '../../theme/theme';
import { FLKnob } from './FLKnob';
import { useDAWStore } from './DAWStore';
import { Play, Square } from 'lucide-react';

interface TransportProps {
    highlightBpm?: boolean;
}

export const Transport: React.FC<TransportProps> = ({ highlightBpm }) => {
    const playing = useDAWStore(s => s.state.transport.playing);
    const bpm = useDAWStore(s => s.state.transport.bpm);
    const swing = useDAWStore(s => s.state.transport.swing);
    const currentStep = useDAWStore(s => s.state.transport.currentStep);
    const play = useDAWStore(s => s.play);
    const stop = useDAWStore(s => s.stop);
    const setBpm = useDAWStore(s => s.setBpm);
    const setSwing = useDAWStore(s => s.setSwing);
    const initEngine = useDAWStore(s => s.initEngine);

    const handlePlay = async () => {
        await initEngine();
        if (playing) { stop(); } else { play(); }
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            background: '#1a1d1f',
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            padding: '8px 16px',
        }}>
            {/* Play/Stop */}
            <button
                onClick={handlePlay}
                style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: playing ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                    border: `2px solid ${playing ? colors.error : colors.primary}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                }}
                title={playing ? 'Stop' : 'Play'}
            >
                {playing
                    ? <Square size={14} color={colors.error} fill={colors.error} />
                    : <Play size={16} color={colors.primary} fill={colors.primary} />}
            </button>

            {/* Step indicator */}
            <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: 16 }, (_, i) => (
                    <div key={i} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: i === currentStep && playing ? colors.primary : i < currentStep && playing ? colors.primaryDark : '#313537',
                        transition: 'background 0.08s',
                    }} />
                ))}
            </div>

            {/* BPM */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                border: highlightBpm ? `1px solid ${colors.primary}` : '1px solid transparent',
                borderRadius: borderRadius.sm, padding: '4px 8px',
                boxShadow: highlightBpm ? `0 0 8px ${colors.primary}40` : 'none',
            }}>
                <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: 600 }}>BPM</span>
                <input
                    type="number"
                    value={bpm}
                    min={40} max={300}
                    onChange={e => setBpm(Number(e.target.value) || 120)}
                    style={{
                        width: 52, background: '#252729', border: `1px solid ${colors.border}`,
                        borderRadius: '4px', padding: '4px 6px', color: colors.textPrimary,
                        fontSize: '13px', fontFamily: 'monospace', textAlign: 'center',
                    }}
                />
            </div>

            {/* Swing */}
            <FLKnob value={swing} onChange={setSwing} size={28} label="Swing" color="#F59E0B" />
        </div>
    );
};
