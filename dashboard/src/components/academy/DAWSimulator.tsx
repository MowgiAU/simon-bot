/**
 * DAWSimulator — FL Studio 21 window frame.
 * Flat dark chrome, thin title bar, integrated tabs.
 */
import React, { useState } from 'react';
import { Transport } from './Transport';
import { ChannelRack } from './ChannelRack';
import { Mixer } from './Mixer';
import { PianoRoll } from './PianoRoll';
import { daw, dawFont } from './dawTheme';

type Panel = 'rack' | 'mixer' | 'piano';

interface Note {
    pitch: number;
    start: number;
    length: number;
}

interface DAWSimulatorProps {
    highlightChannelId?: string | null;
    highlightStepIndex?: number | null;
    highlightInserts?: number[];
    highlightBpm?: boolean;
    visiblePanels?: Panel[];
}

export const DAWSimulator: React.FC<DAWSimulatorProps> = ({
    highlightChannelId, highlightStepIndex, highlightInserts, highlightBpm, visiblePanels,
}) => {
    const defaultPanels: Panel[] = visiblePanels ?? ['rack', 'mixer', 'piano'];
    const [activePanel, setActivePanel] = useState<Panel>(defaultPanels[0]);
    const [pianoNotes, setPianoNotes] = useState<Note[]>([]);

    // Annotated before .filter(), not after: TS widens the literal's `id` to string
    // while inferring the array, so the annotation has to land on the source array.
    const allTabs: { id: Panel; label: string }[] = [
        { id: 'rack', label: 'Channel rack' },
        { id: 'mixer', label: 'Mixer' },
        { id: 'piano', label: 'Piano roll' },
    ];
    const tabs = allTabs.filter(t => defaultPanels.includes(t.id));

    return (
        <div style={{
            background: daw.bg,
            border: `1px solid ${daw.border}`,
            borderRadius: '4px',
            overflow: 'hidden',
            boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
            fontFamily: dawFont.sans,
        }}>
            {/* Title bar */}
            <div data-academy-id="daw-titlebar" style={{
                height: 26,
                background: daw.dark,
                borderBottom: `1px solid ${daw.border}`,
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
                <span style={{ fontSize: '11px', color: daw.text, fontWeight: 400, letterSpacing: '0.02em' }}>
                    Fuji Studio
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    {[0,1,2].map(i => (
                        <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: daw.highlight, opacity: 0.7 }} />
                    ))}
                </div>
            </div>

            {/* Transport */}
            <Transport highlightBpm={highlightBpm} />

            {/* Panel tabs */}
            {tabs.length > 1 && (
                <div style={{
                    display: 'flex',
                    background: daw.panel,
                    borderBottom: `1px solid ${daw.border}`,
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
                                    background: isActive ? daw.dark : 'transparent',
                                    border: 'none',
                                    borderBottom: `2px solid ${isActive ? daw.green : 'transparent'}`,
                                    color: isActive ? daw.textBright : daw.text,
                                    fontSize: '11px', fontWeight: isActive ? 500 : 400,
                                    cursor: 'pointer',
                                    transition: 'color 0.1s',
                                    letterSpacing: '0.01em',
                                    opacity: isActive ? 1 : 0.65,
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
                {activePanel === 'rack' && (
                    <ChannelRack highlightChannelId={highlightChannelId} highlightStepIndex={highlightStepIndex} />
                )}
                {activePanel === 'mixer' && <Mixer highlightInserts={highlightInserts} />}
                {activePanel === 'piano' && <PianoRoll notes={pianoNotes} onChange={setPianoNotes} />}
            </div>
        </div>
    );
};
