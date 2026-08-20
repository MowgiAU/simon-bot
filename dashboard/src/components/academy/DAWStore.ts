/**
 * DAW State Provider — React context bridging the AudioEngine to UI components.
 * Uses Zustand (already in dashboard deps) for fast, fine-grained updates.
 */
import { create } from 'zustand';
import {
    AudioEngine,
    DAWState,
    createDefaultDAWState,
    ChannelConfig,
    MixerInsert,
    EQBand,
    createDefaultChannel,
    normalizeDAWState,
} from './AudioEngine';

interface DAWStore {
    state: DAWState;
    engine: AudioEngine | null;

    // --- Init ---
    initEngine: () => Promise<void>;
    disposeEngine: () => void;

    // --- Transport ---
    play: () => void;
    stop: () => void;
    setBpm: (bpm: number) => void;
    setSwing: (swing: number) => void;
    setCurrentStep: (step: number) => void;

    // --- Channels ---
    toggleStep: (channelId: string, stepIndex: number) => void;
    /** Replace a channel's whole step pattern at once (right-click fill, clear) */
    setChannelSteps: (channelId: string, steps: boolean[]) => void;
    setChannelVolume: (channelId: string, volume: number) => void;
    setChannelPan: (channelId: string, pan: number) => void;
    toggleChannelMute: (channelId: string) => void;
    setChannelFreq: (channelId: string, freq: number) => void;
    addChannel: (name: string) => void;
    setChannels: (channels: ChannelConfig[]) => void;

    // --- Mixer ---
    setInsertVolume: (insertId: number, volume: number) => void;
    setInsertPan: (insertId: number, pan: number) => void;
    toggleInsertMute: (insertId: number) => void;
    setInsertReverb: (insertId: number, wet: number) => void;
    /** Patch one EQ band on an insert (freq / gain / q / type / enabled) */
    setEQBand: (insertId: number, bandIndex: number, patch: Partial<EQBand>) => void;

    // --- Playlist ---
    /** Place a clip on a track at a bar (no-op if one is already there) */
    addPlaylistClip: (track: number, startBar: number, type?: 'pattern' | 'automation', label?: string) => void;
    removePlaylistClip: (clipId: string) => void;
    /** Click-to-toggle a bar cell, which is how the playlist grid is edited */
    togglePlaylistClip: (track: number, startBar: number) => void;
    togglePlaylistTrackMute: (trackId: number) => void;
    setMasterVolume: (volume: number) => void;

    // --- Bulk state (for lesson engine) ---
    loadState: (state: DAWState) => void;
    getSnapshot: () => DAWState;
}

export const useDAWStore = create<DAWStore>((set, get) => {
    let engineInstance: AudioEngine | null = null;

    const sync = () => {
        const { state } = get();
        engineInstance?.updateState(state);
    };

    return {
        state: createDefaultDAWState(),
        engine: null,

        initEngine: async () => {
            if (engineInstance) return;
            const { state } = get();
            engineInstance = new AudioEngine(state);
            await engineInstance.init();
            engineInstance.onStep((step, bar) => {
                set(prev => ({
                    state: {
                        ...prev.state,
                        transport: { ...prev.state.transport, currentStep: step, currentBar: bar },
                    },
                }));
            });
            set({ engine: engineInstance });
        },

        disposeEngine: () => {
            engineInstance?.dispose();
            engineInstance = null;
            set({ engine: null });
        },

        // Transport
        play: () => {
            const { state } = get();
            if (!engineInstance) return;
            set({ state: { ...state, transport: { ...state.transport, playing: true, currentStep: 0, currentBar: 0 } } });
            sync();
            engineInstance.play();
        },
        stop: () => {
            const { state } = get();
            engineInstance?.stop();
            set({ state: { ...state, transport: { ...state.transport, playing: false, currentStep: 0, currentBar: 0 } } });
        },
        setBpm: (bpm) => {
            set(prev => ({ state: { ...prev.state, transport: { ...prev.state.transport, bpm } } }));
            sync();
        },
        setSwing: (swing) => {
            set(prev => ({ state: { ...prev.state, transport: { ...prev.state.transport, swing } } }));
            sync();
        },
        setCurrentStep: (step) => {
            set(prev => ({ state: { ...prev.state, transport: { ...prev.state.transport, currentStep: step } } }));
        },

        // Channels
        toggleStep: (channelId, stepIndex) => {
            set(prev => {
                const channels = prev.state.channels.map(ch =>
                    ch.id === channelId ? { ...ch, steps: ch.steps.map((s, i) => i === stepIndex ? !s : s) } : ch
                );
                return { state: { ...prev.state, channels } };
            });
            sync();
        },
        setChannelSteps: (channelId, steps) => {
            set(prev => ({
                state: {
                    ...prev.state,
                    channels: prev.state.channels.map(ch => ch.id === channelId ? { ...ch, steps } : ch),
                },
            }));
            sync();
        },
        setChannelVolume: (channelId, volume) => {
            set(prev => ({
                state: { ...prev.state, channels: prev.state.channels.map(ch => ch.id === channelId ? { ...ch, volume } : ch) },
            }));
            sync();
        },
        setChannelPan: (channelId, pan) => {
            set(prev => ({
                state: { ...prev.state, channels: prev.state.channels.map(ch => ch.id === channelId ? { ...ch, pan } : ch) },
            }));
            sync();
        },
        toggleChannelMute: (channelId) => {
            set(prev => ({
                state: { ...prev.state, channels: prev.state.channels.map(ch => ch.id === channelId ? { ...ch, muted: !ch.muted } : ch) },
            }));
            sync();
        },
        setChannelFreq: (channelId, freq) => {
            set(prev => ({
                state: { ...prev.state, channels: prev.state.channels.map(ch => ch.id === channelId ? { ...ch, baseFreq: freq } : ch) },
            }));
            sync();
        },
        addChannel: (name) => {
            set(prev => {
                const id = name.toLowerCase().replace(/\s+/g, '-');
                const channels = [...prev.state.channels, createDefaultChannel(id, name)];
                return { state: { ...prev.state, channels } };
            });
            sync();
        },
        setChannels: (channels) => {
            set(prev => ({ state: { ...prev.state, channels } }));
            sync();
        },

        // Mixer
        setInsertVolume: (insertId, volume) => {
            set(prev => ({
                state: { ...prev.state, mixerInserts: prev.state.mixerInserts.map(i => i.id === insertId ? { ...i, volume } : i) },
            }));
            sync();
        },
        setInsertPan: (insertId, pan) => {
            set(prev => ({
                state: { ...prev.state, mixerInserts: prev.state.mixerInserts.map(i => i.id === insertId ? { ...i, pan } : i) },
            }));
            sync();
        },
        toggleInsertMute: (insertId) => {
            set(prev => ({
                state: { ...prev.state, mixerInserts: prev.state.mixerInserts.map(i => i.id === insertId ? { ...i, muted: !i.muted } : i) },
            }));
            sync();
        },
        setInsertReverb: (insertId, wet) => {
            set(prev => ({
                state: { ...prev.state, mixerInserts: prev.state.mixerInserts.map(i => i.id === insertId ? { ...i, reverbWet: wet } : i) },
            }));
            sync();
        },
        setEQBand: (insertId, bandIndex, patch) => {
            set(prev => ({
                state: {
                    ...prev.state,
                    mixerInserts: prev.state.mixerInserts.map(i => i.id === insertId
                        ? { ...i, eqBands: i.eqBands.map((b, bi) => bi === bandIndex ? { ...b, ...patch } : b) }
                        : i),
                },
            }));
            sync();
        },
        setMasterVolume: (volume) => {
            set(prev => ({ state: { ...prev.state, masterVolume: volume } }));
            sync();
        },

        // Playlist
        addPlaylistClip: (track, startBar, type = 'pattern', label) => {
            set(prev => {
                const pl = prev.state.playlist;
                if (pl.clips.some(c => c.track === track && c.startBar === startBar)) return prev;
                const clip = {
                    id: `${type}-${track}-${startBar}-${Date.now()}`,
                    track, startBar, lengthBars: 1, type,
                    label: label ?? (type === 'pattern' ? 'Pattern 1' : 'Automation'),
                };
                return { state: { ...prev.state, playlist: { ...pl, clips: [...pl.clips, clip] } } };
            });
            sync();
        },
        removePlaylistClip: (clipId) => {
            set(prev => ({
                state: {
                    ...prev.state,
                    playlist: {
                        ...prev.state.playlist,
                        clips: prev.state.playlist.clips.filter(c => c.id !== clipId),
                    },
                },
            }));
            sync();
        },
        togglePlaylistClip: (track, startBar) => {
            set(prev => {
                const pl = prev.state.playlist;
                const existing = pl.clips.find(c => c.track === track && c.startBar === startBar);
                const clips = existing
                    ? pl.clips.filter(c => c.id !== existing.id)
                    : [...pl.clips, {
                        id: `pattern-${track}-${startBar}-${Date.now()}`,
                        track, startBar, lengthBars: 1,
                        type: 'pattern' as const, label: 'Pattern 1',
                    }];
                return { state: { ...prev.state, playlist: { ...pl, clips } } };
            });
            sync();
        },
        togglePlaylistTrackMute: (trackId) => {
            set(prev => ({
                state: {
                    ...prev.state,
                    playlist: {
                        ...prev.state.playlist,
                        tracks: prev.state.playlist.tracks.map(t =>
                            t.id === trackId ? { ...t, muted: !t.muted } : t),
                    },
                },
            }));
            sync();
        },

        // Bulk
        loadState: (newState) => {
            // Normalized on the way in: lesson initState saved before the EQ existed has
            // inserts with no eqBands, which would otherwise break the filter chain.
            set({ state: normalizeDAWState(newState) });
            sync();
        },
        getSnapshot: () => get().state,
    };
});
