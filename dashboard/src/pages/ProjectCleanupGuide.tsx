import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, borderRadius } from '../theme/theme';
import { ArrowLeft, FolderOpen, Trash2, Package, FileAudio, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react';

interface StepProps {
    number: number;
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const Step: React.FC<StepProps> = ({ number, title, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, overflow: 'hidden' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: spacing.md, backgroundColor: 'transparent', border: 'none',
                    color: colors.textPrimary, cursor: 'pointer', textAlign: 'left'
                }}
            >
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colors.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '14px', color: '#000', flexShrink: 0
                }}>{number}</div>
                <span style={{ fontWeight: 600, fontSize: '16px', flex: 1 }}>{title}</span>
                {open ? <ChevronDown size={20} color={colors.textSecondary} /> : <ChevronRight size={20} color={colors.textSecondary} />}
            </button>
            {open && (
                <div style={{ padding: `0 ${spacing.md} ${spacing.md}`, color: colors.textSecondary, lineHeight: 1.7 }}>
                    {children}
                </div>
            )}
        </div>
    );
};

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{
        backgroundColor: 'rgba(34, 197, 94, 0.1)', borderLeft: `3px solid ${colors.primary}`,
        padding: '12px 16px', borderRadius: `0 ${borderRadius.sm} ${borderRadius.sm} 0`,
        margin: '12px 0', fontSize: '14px', color: colors.textPrimary
    }}>
        <strong style={{ color: colors.primary }}>Tip: </strong>{children}
    </div>
);

const Warning: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{
        backgroundColor: 'rgba(234, 179, 8, 0.1)', borderLeft: '3px solid #eab308',
        padding: '12px 16px', borderRadius: `0 ${borderRadius.sm} ${borderRadius.sm} 0`,
        margin: '12px 0', fontSize: '14px', color: colors.textPrimary
    }}>
        <AlertTriangle size={14} style={{ marginRight: '6px', verticalAlign: 'middle', color: '#eab308' }} />
        <strong style={{ color: '#eab308' }}>Warning: </strong>{children}
    </div>
);

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
    <div style={{
        backgroundColor: colors.background, padding: '12px 16px', borderRadius: borderRadius.sm,
        fontFamily: 'monospace', fontSize: '13px', color: colors.textPrimary, margin: '8px 0',
        overflowX: 'auto', border: `1px solid ${colors.border}`
    }}>
        {children}
    </div>
);

export const ProjectCleanupGuide: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: spacing.lg }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'none', border: 'none', color: colors.textSecondary,
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                        marginBottom: spacing.lg, padding: 0, fontSize: '14px'
                    }}
                >
                    <ArrowLeft size={18} /> Back
                </button>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                    <Package size={32} color={colors.primary} style={{ marginRight: '16px' }} />
                    <div>
                        <h1 style={{ margin: 0, color: colors.textPrimary }}>FL Studio Project Cleanup Guide</h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>
                            How to tidy up your project, remove unused files, and export as a zip loop package
                        </p>
                    </div>
                </div>

                {/* Explanation Block */}
                <div style={{
                    backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md,
                    marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}`
                }}>
                    <p style={{ margin: 0, color: colors.textPrimary, lineHeight: 1.6 }}>
                        Before sharing your project or uploading to Fuji Studio, it's a good idea to clean up unused samples, 
                        plugins, and organize your files. This guide walks you through the full process — from removing clutter 
                        to exporting a portable zip that anyone can open.
                    </p>
                </div>

                {/* Steps */}
                <Step number={1} title="Save a Backup Copy" defaultOpen>
                    <p>Before making any changes, always save a backup of your original project.</p>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>Open your project in FL Studio.</li>
                        <li>Go to <strong>File → Save As...</strong> and save a copy with a new name (e.g., <code>MyBeat_cleanup.flp</code>).</li>
                        <li>Work from this copy so your original stays untouched.</li>
                    </ol>
                    <Tip>Keep your original .flp safe in case you need to go back to it later.</Tip>
                </Step>

                <Step number={2} title="Remove Unused Channels & Patterns">
                    <p>Get rid of channels and patterns that aren't contributing to the final mix.</p>
                    
                    <h4 style={{ color: colors.textPrimary, margin: '16px 0 8px' }}>Unused Channels</h4>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>Open the <strong>Channel Rack</strong> (F6).</li>
                        <li>Look for channels that have no notes in any pattern and aren't routed to the mixer.</li>
                        <li>Right-click the channel → <strong>Delete</strong>.</li>
                    </ol>

                    <h4 style={{ color: colors.textPrimary, margin: '16px 0 8px' }}>Unused Patterns</h4>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>Open the <strong>Playlist</strong> (F5).</li>
                        <li>Look for patterns that are muted, empty, or not placed in the playlist.</li>
                        <li>In the <strong>Picker Panel</strong> (left side of playlist), right-click empty patterns → <strong>Delete</strong>.</li>
                    </ol>

                    <Tip>
                        Use <strong>Tools → Macros → Purge unused audio clips</strong> in the playlist to automatically remove audio clips that aren't placed anywhere.
                    </Tip>
                </Step>

                <Step number={3} title="Remove Unused Mixer Tracks">
                    <p>Clean up mixer inserts that aren't receiving any signal.</p>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>Open the <strong>Mixer</strong> (F9).</li>
                        <li>Scroll through the mixer inserts and identify any that are unused (no input signal, no plugins loaded).</li>
                        <li>For unused inserts: remove any leftover effects by right-clicking effect slots → <strong>Delete</strong>.</li>
                        <li>Reset the insert: right-click the insert name → <strong>Reset to default</strong>.</li>
                    </ol>
                    <Warning>Don't remove inserts that are used as send/return tracks — check the routing first!</Warning>
                </Step>

                <Step number={4} title="Remove Unused Automation Clips">
                    <p>Automation clips for deleted or bypassed parameters add unnecessary bloat.</p>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>In the <strong>Browser</strong> panel, navigate to <strong>Current project → Automation</strong>.</li>
                        <li>Check for automation clips that no longer control anything (they'll show up as "unlinked").</li>
                        <li>Right-click unlinked automation clips → <strong>Delete</strong>.</li>
                        <li>Also check the playlist for automation clips that are muted or not placed.</li>
                    </ol>
                </Step>

                <Step number={5} title="Collect & Consolidate Samples">
                    <p>Gather all audio files your project uses into one folder so the .flp can find them anywhere.</p>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>Go to <strong>File → Export → Project data files...</strong></li>
                        <li>Choose a folder (or create a new one) to collect all samples into.</li>
                        <li>FL Studio will copy every sample/audio clip used in the project to that folder.</li>
                        <li>After collecting, re-save the project so it references the new sample locations.</li>
                    </ol>
                    <Tip>
                        If you're on FL Studio 21+, you can also use <strong>File → Export → Zipped loop package</strong> directly 
                        which handles this automatically (see Step 7).
                    </Tip>
                </Step>

                <Step number={6} title="Check for Missing Samples & Plugins">
                    <p>Make sure nothing is broken before packaging.</p>

                    <h4 style={{ color: colors.textPrimary, margin: '16px 0 8px' }}>Missing Samples</h4>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>In the <strong>Channel Rack</strong>, look for any channels with a <strong style={{ color: '#ef4444' }}>red icon</strong> — this means the sample file is missing.</li>
                        <li>Right-click → <strong>Locate</strong> to find and relink the sample, or remove the channel if it's not needed.</li>
                    </ol>

                    <h4 style={{ color: colors.textPrimary, margin: '16px 0 8px' }}>Missing Plugins</h4>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>When you open a project, FL Studio will warn you about any missing plugins.</li>
                        <li>If a plugin is no longer needed, replace it with an empty Fruity Wrapper or delete the channel.</li>
                        <li>If sharing the project, note that the recipient will also need the same third-party plugins installed.</li>
                    </ol>
                    <Warning>
                        Third-party plugins (Serum, Omnisphere, etc.) are NOT included in the zip export. 
                        Recipients will need their own licenses. Consider bouncing plugin channels to audio (Consolidation) 
                        if you want the project to be fully portable.
                    </Warning>
                </Step>

                <Step number={7} title="Export as Zipped Loop Package (.zip)">
                    <p>This is the best way to share an FL Studio project — it bundles the .flp with all its samples into a single .zip file.</p>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>Go to <strong>File → Export → Zipped loop package...</strong></li>
                        <li>Choose where to save the .zip file and give it a clear name.</li>
                        <li>FL Studio will package:
                            <ul style={{ marginTop: '4px' }}>
                                <li>The .flp project file</li>
                                <li>All audio samples used in the project</li>
                                <li>Score and automation data</li>
                            </ul>
                        </li>
                        <li>The resulting .zip can be shared with anyone running FL Studio.</li>
                    </ol>

                    <h4 style={{ color: colors.textPrimary, margin: '16px 0 8px' }}>To open a zip loop package:</h4>
                    <ol style={{ paddingLeft: '24px' }}>
                        <li>Drag the .zip file into FL Studio's <strong>Browser</strong> panel, or</li>
                        <li>Extract the contents and open the .flp file normally.</li>
                    </ol>
                    <Tip>
                        The zip loop package format is the standard way FL Studio users share projects. 
                        It's what we recommend when uploading project files to Fuji Studio.
                    </Tip>
                </Step>

                <Step number={8} title="Final Checklist">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {[
                            'Backup saved before cleanup',
                            'Unused channels and patterns removed',
                            'Unused mixer inserts cleaned up',
                            'Unlinked automation clips deleted',
                            'No missing samples (no red icons)',
                            'Samples collected into project folder',
                            'Exported as zipped loop package (.zip)',
                            'Tested the zip by opening on a clean session',
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: colors.textPrimary }}>
                                <CheckCircle size={16} color={colors.primary} />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </Step>

                {/* Footer */}
                <div style={{
                    textAlign: 'center', color: colors.textSecondary, fontSize: '13px',
                    padding: `${spacing.lg} 0`, borderTop: `1px solid ${colors.border}`, marginTop: spacing.lg
                }}>
                    Need help? Ask in the <strong style={{ color: colors.primary }}>#production-help</strong> channel on our Discord server.
                </div>
            </div>
        </div>
    );
};
