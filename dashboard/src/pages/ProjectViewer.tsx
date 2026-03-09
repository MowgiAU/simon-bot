import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthProvider';
import { colors, spacing, borderRadius } from '../theme/theme';
import { 
    Layout, 
    Play, 
    Pause, 
    Search, 
    Box, 
    Clock, 
    Music,
    Zap,
    Download,
    RefreshCw,
    Info
} from 'lucide-react';

// Interfaces for our Project Data
interface ProjectArrangement {
    bpm: number;
    signature: [number, number];
    tracks: Array<{
        id: string;
        name: string;
        color?: string;
        clips: Array<{
            id: string;
            start: number; // in beats/bars
            length: number;
            type: 'audio' | 'pattern' | 'automation';
            name: string;
        }>;
    }>;
}

interface ProjectMetadata {
    id: string;
    filename: string;
    url: string; // Preview audio URL
    arrangement: ProjectArrangement;
    projectFile?: {
        url: string; // FLP download URL
        filename: string;
    };
    metadata: {
        bpm: number;
        key?: string;
        duration?: number;
    };
}

export const ProjectViewer: React.FC = () => {
    const { selectedGuild } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<ProjectMetadata | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0); // in seconds
    const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
    
    // Performance-optimized playhead ref
    const playheadRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const requestRef = useRef<number | null>(null);

    // Fetch list of projects
    useEffect(() => {
        if (!selectedGuild) return;
        fetchProjects();
    }, [selectedGuild, searchTerm]);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/fuji/samples/search', {
                params: {
                    projectsOnly: 'true',
                    q: searchTerm,
                    guildId: selectedGuild?.id
                }
            });
            setProjects(res.data);
        } catch (e) {
            console.error('Failed to fetch projects', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProject = async (sampleId: string) => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/projects/${sampleId}`);
            setSelectedProject(res.data);
            setViewMode('timeline');
            
            // Setup audio
            if (audioRef.current) {
                audioRef.current.pause();
            }
            audioRef.current = new Audio(res.data.url);
            audioRef.current.addEventListener('ended', () => setIsPlaying(false));
        } catch (e) {
            console.error('Failed to load project details', e);
        } finally {
            setLoading(false);
        }
    };

    // RAF for smooth playhead
    // currentTimeRef avoids stale closure without triggering re-renders inside animate()
    const currentTimeRef = useRef(0);
    const isPlayingRef = useRef(false);
    isPlayingRef.current = isPlaying;

    const animate = () => {
        if (audioRef.current && isPlayingRef.current) {
            const time = audioRef.current.currentTime;
            currentTimeRef.current = time;
            setCurrentTime(time);
            
            // Sync playhead CSS Variable for ultra-smooth movement without re-renders
            if (playheadRef.current && selectedProject) {
                const bpm = selectedProject.arrangement.bpm || 140;
                const beatsPerSec = bpm / 60;
                const currentBeat = time * beatsPerSec;
                // Standard: 100px per bar (4 beats)
                const pixelsPerBeat = 25; 
                playheadRef.current.style.setProperty('--playhead-pos', `${currentBeat * pixelsPerBeat}px`);
            }
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => {
             if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            audioRef.current?.pause();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const togglePlayback = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    // Shared UI Components
    const Header = () => (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
            <Layout size={32} color={colors.primary} style={{ marginRight: '16px' }} />
            <div>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Project Viewer</h1>
                <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Explore arrangements, automation, and project structures.</p>
            </div>
        </div>
    );

    const Explanation = () => (
        <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
             <p style={{ margin: 0, color: colors.textPrimary }}>
                This viewer visualizes the inner structure of DAW projects (FL Studio, Ableton, etc.) synced with their audio renders. 
                Browse your community's projects below to see how they were built.
             </p>
        </div>
    );

    if (viewMode === 'timeline' && selectedProject) {
        const bpm = selectedProject.arrangement.bpm || 140;
        const pixelsPerBeat = 25; // Zoom constant

        return (
            <div style={{ padding: spacing.lg, color: colors.textPrimary, height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                        <button 
                            onClick={() => { setViewMode('grid'); setIsPlaying(false); audioRef.current?.pause(); }}
                            style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.textPrimary, padding: '6px 12px', borderRadius: borderRadius.sm, cursor: 'pointer' }}
                        >
                            Back to Browse
                        </button>
                        <h2 style={{ margin: 0 }}>{selectedProject.filename}</h2>
                        <div style={{ display: 'flex', gap: spacing.sm, color: colors.textSecondary, fontSize: '14px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={14}/> {bpm} BPM</span>
                            {selectedProject.metadata.key && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Music size={14}/> {selectedProject.metadata.key}</span>}
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: spacing.md }}>
                         {selectedProject.projectFile && (
                             <a 
                                href={selectedProject.projectFile.url} 
                                download 
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: borderRadius.md, textDecoration: 'none', border: `1px solid ${colors.border}` }}
                             >
                                <Download size={18} /> Download Project
                             </a>
                         )}
                    </div>
                </div>

                {/* Timeline Toolbar */}
                <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`, border: `1px solid ${colors.border}`, borderBottom: 'none', display: 'flex', alignItems: 'center', gap: spacing.lg }}>
                    <button 
                        onClick={togglePlayback}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: colors.primary, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />}
                    </button>

                    <div style={{ flex: 1, height: '2px', backgroundColor: colors.border, position: 'relative' }}>
                        {/* Global Progress */}
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(currentTime / (audioRef.current?.duration || 1)) * 100}%`, backgroundColor: colors.primary }} />
                    </div>

                    <div style={{ fontVariantNumeric: 'tabular-nums', color: colors.textSecondary }}>
                        {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                    </div>
                </div>

                {/* The Timeline Canvas */}
                <div style={{ 
                    flex: 1, 
                    backgroundColor: '#111', 
                    border: `1px solid ${colors.border}`, 
                    overflowX: 'auto', 
                    overflowY: 'auto', 
                    position: 'relative' 
                }}>
                    {/* Playhead */}
                    <div 
                        ref={playheadRef}
                        style={{ 
                            position: 'absolute', 
                            top: 0, 
                            bottom: 0, 
                            width: '2px', 
                            backgroundColor: '#fff', 
                            zIndex: 10,
                            transform: 'translateX(var(--playhead-pos, 0))',
                            boxShadow: '0 0 10px rgba(255,255,255,0.5)'
                        }} 
                    />

                    {/* Timeline Headers (Bars) */}
                    <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, height: '30px', backgroundColor: '#181818' }}>
                         {Array.from({ length: 128 }).map((_, i) => (
                             <div key={i} style={{ minWidth: `${pixelsPerBeat * 4}px`, borderRight: `1px solid #333`, paddingLeft: '4px', fontSize: '10px', color: '#666', paddingTop: '8px' }}>
                                 {i + 1}
                             </div>
                         ))}
                    </div>

                    {/* Tracks */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {selectedProject.arrangement.tracks.map(track => (
                            <div key={track.id} style={{ display: 'flex', borderBottom: '1px solid #222', height: '60px', minWidth: 'fit-content' }}>
                                {/* Track Info Panel (Sticky) */}
                                <div style={{ 
                                    position: 'sticky', 
                                    left: 0, 
                                    width: '150px', 
                                    backgroundColor: colors.surface, 
                                    borderRight: `2px solid ${track.color || colors.primary}`, 
                                    zIndex: 5,
                                    padding: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '13px'
                                }}>
                                    {track.name}
                                </div>
                                
                                {/* Track Clips Area */}
                                <div style={{ position: 'relative', flex: 1 }}>
                                    {track.clips.map(clip => (
                                        <div 
                                            key={clip.id}
                                            style={{
                                                position: 'absolute',
                                                left: `${clip.start * pixelsPerBeat}px`,
                                                width: `${clip.length * pixelsPerBeat}px`,
                                                top: '10px',
                                                bottom: '10px',
                                                backgroundColor: track.color ? `${track.color}44` : `${colors.primary}22`,
                                                border: `1px solid ${track.color || colors.primary}`,
                                                borderRadius: '4px',
                                                padding: '4px',
                                                fontSize: '10px',
                                                overflow: 'hidden',
                                                whiteSpace: 'nowrap',
                                                textOverflow: 'ellipsis',
                                                color: '#fff',
                                                backdropFilter: 'blur(2px)'
                                            }}
                                        >
                                            {clip.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: spacing.lg }}>
            <Header />
            <Explanation />

            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.xl }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} size={18} />
                    <input 
                        type="text" 
                        placeholder="Search projects..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '12px 12px 12px 42px', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, color: colors.textPrimary }}
                    />
                </div>
                <button 
                    onClick={fetchProjects}
                    style={{ padding: '0 20px', backgroundColor: colors.primary, border: 'none', borderRadius: borderRadius.md, fontWeight: 600, cursor: 'pointer' }}
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {loading && projects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>
                    <RefreshCw className="spin" size={32} style={{ marginBottom: '16px' }} />
                    <p>Loading projects...</p>
                </div>
            ) : projects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px', backgroundColor: colors.surface, border: `1px dashed ${colors.border}`, borderRadius: borderRadius.lg }}>
                    <Info size={48} color={colors.textSecondary} style={{ marginBottom: '16px' }} />
                    <h3>No projects found</h3>
                    <p style={{ color: colors.textSecondary }}>Try a different search or scan a project to get started.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing.lg }}>
                    {projects.map((p) => (
                        <div 
                            key={p.id} 
                            onClick={() => handleSelectProject(p.id)}
                            style={{ 
                                backgroundColor: colors.surface, 
                                borderRadius: borderRadius.lg, 
                                border: `1px solid ${colors.border}`, 
                                overflow: 'hidden', 
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ height: '160px', backgroundColor: '#181818', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                <Box size={60} color={colors.primary} style={{ opacity: 0.2 }} />
                                <div style={{ position: 'absolute', bottom: spacing.md, right: spacing.md, backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: borderRadius.sm, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} /> {p.duration ? `${Math.floor(p.duration / 60)}:${Math.floor(p.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                                </div>
                            </div>
                            <div style={{ padding: spacing.md }}>
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.filename}</h3>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>{p.pack?.name || 'Community Share'}</span>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {p.bpm && <span style={{ padding: '2px 6px', backgroundColor: '#333', borderRadius: '4px', fontSize: '11px' }}>{p.bpm} BPM</span>}
                                        {p.key && <span style={{ padding: '2px 6px', backgroundColor: '#333', borderRadius: '4px', fontSize: '11px' }}>{p.key}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
