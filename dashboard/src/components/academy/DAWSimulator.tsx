/**
 * DAWSimulator — FL Studio 21 window frame containing Transport, ChannelRack, Mixer, PianoRoll.
 * Authentic FL title bar + tabbed panels.
 */
import React, { useState } from 'react';
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

    const tabs: { id: Panel; label: string; icon: React.ReactNode }[] = [
        { id: 'rack', label: 'Channel Rack', icon: <LayoutGrid size={12} /> },
        { id: 'mixer', label: 'Mixer', icon: <Sliders size={12} /> },
        { id: 'piano', label: 'Piano Roll', icon: <Piano size={12} /> },
    ].filter(t => defaultPanels.includes(t.id));

    return (
        <div style={{
            background: '#2B2B2B',
            border: '1px solid #555',
            borderRadius: '4px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
        }}>
            {/* FL Studio window title bar */}
            <div style={{
                height: 22,
                background: 'linear-gradient(180deg, #5A5A5A 0%, #444 50%, #3A3A3A 100%)',
                borderBottom: '1px solid #666',
                display: 'flex', alignItems: 'center',
                padding: '0 8px',
                gap: '6px',
            }}>
                {/* FL "fruit" icon placeholder */}
                <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #E88C3A, #E8503A)',
                }} />
                <span style={{ fontSize: '11px', color: '#DDD', fontWeight: 500 }}>
                    Fuji Studio Simulator
                </span>
            </div>

            {/* Transport */}
            <Transport highlightBpm={highlightBpm} />

            {/* Panel tabs — FL Studio tab bar */}
            {tabs.length > 1 && (
                <div style={{
                    display: 'flex',
                    background: '#2A2A2A',
                    borderBottom: '1px solid #444',
                }}>
                    {tabs.map(tab => {
                        const isActive = activePanel === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActivePanel(tab.id)}
                                style={{
                                    padding: '5px 16px',
                                    background: isActive
                                        ? 'linear-gradient(180deg, #3A3A3A 0%, #2E2E2E 100%)'
                                        : 'transparent',
                                    border: 'none',
                                    borderBottom: isActive ? '2px solid #6FBF40' : '2px solid transparent',
                                    borderRight: '1px solid #333',
                                    color: isActive ? '#DDD' : '#777',
                                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    transition: 'color 0.1s',
                                }}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Active panel */}
            <div style={{ padding: '0' }}>
                {activePanel === 'rack' && <ChannelRack highlightSteps={highlightSteps} />}
                {activePanel === 'mixer' && <Mixer highlightInserts={highlightInserts} />}
                {activePanel === 'piano' && <PianoRoll notes={pianoNotes} onChange={setPianoNotes} />}
            </div>
        </div>
    );
};
