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
    createDefaultChannel,
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
            engineInstance.onStep((step) => {
                set(prev => ({
                    state: { ...prev.state, transport: { ...prev.state.transport, currentStep: step } },
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
            set({ state: { ...state, transport: { ...state.transport, playing: true, currentStep: 0 } } });
            sync();
            engineInstance.play();
        },
        stop: () => {
            const { state } = get();
            engineInstance?.stop();
            set({ state: { ...state, transport: { ...state.transport, playing: false, currentStep: 0 } } });
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
        setMasterVolume: (volume) => {
            set(prev => ({ state: { ...prev.state, masterVolume: volume } }));
            sync();
        },

        // Bulk
        loadState: (newState) => {
            set({ state: newState });
            sync();
        },
        getSnapshot: () => get().state,
    };
});
