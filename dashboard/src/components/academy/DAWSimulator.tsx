/**
 * DAWSimulator — FL Studio 21 window frame.
 * Flat dark chrome, thin title bar, integrated tabs.
 */
import React, { useState } from 'react';
import { Transport } from './Transport';
import { ChannelRack } from './ChannelRack';
import { Mixer } from './Mixer';
import { PianoRoll } from './PianoRoll';

type Panel = 'rack' | 'mixer' | 'piano';

interface Note {
    pitch: number;
    start: number;
    length: number;
}

interface DAWSimulatorProps {
    highlightSteps?: { channelId: string; stepIndex: number }[];
    highlightInserts?: number[];
    highlightBpm?: boolean;
    visiblePanels?: Panel[];
}

export const DAWSimulator: React.FC<DAWSimulatorProps> = ({
    highlightSteps, highlightInserts, highlightBpm, visiblePanels,
}) => {
    const defaultPanels: Panel[] = visiblePanels ?? ['rack', 'mixer', 'piano'];
    const [activePanel, setActivePanel] = useState<Panel>(defaultPanels[0]);
    const [pianoNotes, setPianoNotes] = useState<Note[]>([]);

    const tabs: { id: Panel; label: string }[] = [
        { id: 'rack', label: 'Channel rack' },
        { id: 'mixer', label: 'Mixer' },
        { id: 'piano', label: 'Piano roll' },
    ].filter(t => defaultPanels.includes(t.id));

    return (
        <div style={{
            background: '#2E3440',
            border: '1px solid #4A5268',
            borderRadius: '3px',
            overflow: 'hidden',
            boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
        }}>
            {/* Title bar */}
            <div style={{
                height: 26,
                background: '#333A48',
                borderBottom: '1px solid #4A5060',
                display: 'flex', alignItems: 'center',
                padding: '0 10px',
                gap: '8px',
            }}>
                {/* FL fruit icon */}
                <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: 'radial-gradient(circle at 40% 35%, #F09030, #D05020)',
                    boxShadow: '0 0 4px rgba(240,144,48,0.25)',
                }} />
                <span style={{ fontSize: '11px', color: '#8090A0', fontWeight: 400, letterSpacing: '0.02em' }}>
                    Fuji Studio
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    {[0,1,2].map(i => (
                        <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#4A5268', opacity: 0.5 }} />
                    ))}
                </div>
            </div>

            {/* Transport */}
            <Transport highlightBpm={highlightBpm} />

            {/* Panel tabs */}
            {tabs.length > 1 && (
                <div style={{
                    display: 'flex',
                    background: '#2A3040',
                    borderBottom: '1px solid #2E3440',
                    height: 26,
                }}>
                    {tabs.map(tab => {
                        const isActive = activePanel === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActivePanel(tab.id)}
                                style={{
                                    padding: '0 16px',
                                    height: '100%',
                                    background: isActive ? '#333A48' : 'transparent',
                                    border: 'none',
                                    borderBottom: isActive ? '2px solid #F09030' : '2px solid transparent',
                                    color: isActive ? '#B0B8C8' : '#5A6478',
                                    fontSize: '11px', fontWeight: isActive ? 500 : 400,
                                    cursor: 'pointer',
                                    transition: 'color 0.1s',
                                    letterSpacing: '0.01em',
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Active panel */}
            <div>
                {activePanel === 'rack' && <ChannelRack highlightSteps={highlightSteps} />}
                {activePanel === 'mixer' && <Mixer highlightInserts={highlightInserts} />}
                {activePanel === 'piano' && <PianoRoll notes={pianoNotes} onChange={setPianoNotes} />}
            </div>
        </div>
    );
};
