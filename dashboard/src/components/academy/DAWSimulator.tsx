/**
 * DAWSimulator — Full assembled DAW view combining Transport, ChannelRack, Mixer, and PianoRoll.
 * Used inside the lesson player. Panels can be toggled via tabs.
 */
import React, { useState } from 'react';
import { colors, borderRadius } from '../../theme/theme';
import { Transport } from './Transport';
import { ChannelRack } from './ChannelRack';
import { Mixer } from './Mixer';
import { PianoRoll } from './PianoRoll';
import { LayoutGrid, Sliders, Piano } from 'lucide-react';

type Panel = 'rack' | 'mixer' | 'piano';

interface Note {
    pitch: number;
    start: number;
    length: number;
}

interface DAWSimulatorProps {
    /** Step highlights from lesson engine */
    highlightSteps?: { channelId: string; stepIndex: number }[];
    highlightInserts?: number[];
    highlightBpm?: boolean;
    /** Show only specific panels */
    visiblePanels?: Panel[];
}

export const DAWSimulator: React.FC<DAWSimulatorProps> = ({
    highlightSteps, highlightInserts, highlightBpm, visiblePanels,
}) => {
    const defaultPanels: Panel[] = visiblePanels ?? ['rack', 'mixer', 'piano'];
    const [activePanel, setActivePanel] = useState<Panel>(defaultPanels[0]);
    const [pianoNotes, setPianoNotes] = useState<Note[]>([]);

    const tabs: { id: Panel; label: string; icon: React.ReactNode }[] = [
        { id: 'rack', label: 'Channel Rack', icon: <LayoutGrid size={14} /> },
        { id: 'mixer', label: 'Mixer', icon: <Sliders size={14} /> },
        { id: 'piano', label: 'Piano Roll', icon: <Piano size={14} /> },
    ].filter(t => defaultPanels.includes(t.id));

    return (
        <div style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
        }}>
            {/* Transport bar */}
            <Transport highlightBpm={highlightBpm} />

            {/* Panel tabs */}
            {tabs.length > 1 && (
                <div style={{
                    display: 'flex', borderBottom: `1px solid ${colors.border}`,
                    background: 'rgba(255,255,255,0.02)',
                }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActivePanel(tab.id)}
                            style={{
                                flex: 1, padding: '8px 12px',
                                background: activePanel === tab.id ? 'rgba(16,185,129,0.08)' : 'transparent',
                                border: 'none', borderBottom: activePanel === tab.id ? `2px solid ${colors.primary}` : '2px solid transparent',
                                color: activePanel === tab.id ? colors.primary : colors.textSecondary,
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                transition: 'all 0.15s',
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Active panel */}
            <div style={{ padding: '8px' }}>
                {activePanel === 'rack' && <ChannelRack highlightSteps={highlightSteps} />}
                {activePanel === 'mixer' && <Mixer highlightInserts={highlightInserts} />}
                {activePanel === 'piano' && <PianoRoll notes={pianoNotes} onChange={setPianoNotes} />}
            </div>
        </div>
    );
};
