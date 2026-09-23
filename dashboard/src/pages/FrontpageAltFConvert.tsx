/**
 * Alt F — Project Converter (Ableton Live → FL Studio).
 * Upload a zipped Live project (or a bare .als) → POST /api/convert/ableton-to-fl,
 * then show the conversion report and a download link (kept for an hour).
 */
import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, CONTENT_MAX } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { useAltBreakpoint } from '../components/altshell/useAltBreakpoint';
import {
    ArrowRightLeft, ArrowRight, UploadCloud, FileArchive, CheckCircle2, AlertTriangle, FileWarning,
    Download, RotateCcw, Loader2, LogIn, FolderInput, FileAudio,
} from 'lucide-react';

interface ConvertResult {
    id: string;
    projectName: string;
    downloadName: string;
    samplesIncluded: number;
    missingSamples: string[];
    report: {
        source: string;
        target: string;
        stats: { tracks: number; midiClips: number; audioClips: number; notes: number; samples: number };
        converted: string[];
        warnings: string[];
    };
}

type Phase =
    | { kind: 'idle' }
    | { kind: 'uploading'; pct: number; file: string }
    | { kind: 'converting'; file: string }
    | { kind: 'done'; result: ConvertResult }
    | { kind: 'error'; message: string };

const MAX_MB = 200;
const WARNINGS_COLLAPSED = 6;

const FrontpageAltFConvert: React.FC = () => {
    const { user } = useAuth();
    const bp = useAltBreakpoint();
    const narrow = bp === 'xs' || bp === 'sm';
    const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
    const [dragging, setDragging] = useState(false);
    const [showAllWarnings, setShowAllWarnings] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const start = async (file: File) => {
        if (!/\.(zip|als)$/i.test(file.name)) {
            setPhase({ kind: 'error', message: 'Upload a .zip of your Ableton project folder, or an .als file.' });
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            setPhase({ kind: 'error', message: `That file is over the ${MAX_MB} MB limit.` });
            return;
        }
        setShowAllWarnings(false);
        setPhase({ kind: 'uploading', pct: 0, file: file.name });
        const form = new FormData();
        form.append('project', file);
        try {
            const { data } = await axios.post<ConvertResult>('/api/convert/ableton-to-fl', form, {
                withCredentials: true,
                onUploadProgress: (e) => {
                    const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
                    setPhase(pct >= 100 ? { kind: 'converting', file: file.name } : { kind: 'uploading', pct, file: file.name });
                },
            });
            setPhase({ kind: 'done', result: data });
        } catch (e: any) {
            setPhase({ kind: 'error', message: e?.response?.data?.error || 'Conversion failed. Please try again.' });
        }
    };

    const onPick = (files: FileList | null) => {
        const f = files?.[0];
        if (f) start(f);
        if (inputRef.current) inputRef.current.value = '';
    };

    const card: React.CSSProperties = { background: S_CONT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: narrow ? 18 : 28 };
    const busy = phase.kind === 'uploading' || phase.kind === 'converting';

    const dawPill = (name: string, dim?: boolean) => (
        <div style={{ padding: '8px 14px', borderRadius: 9999, background: S_HIGH, border: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: dim ? SUB : TEXT, whiteSpace: 'nowrap' }}>{name}</div>
    );

    const renderDropzone = () => (
        <div
            role="button"
            tabIndex={0}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) onPick(e.dataTransfer.files); }}
            style={{
                border: `2px dashed ${dragging ? PRIMARY : 'rgba(255,255,255,0.14)'}`,
                background: dragging ? `${PRIMARY}10` : BG,
                borderRadius: 14, padding: narrow ? '32px 16px' : '48px 24px', textAlign: 'center',
                cursor: busy ? 'default' : 'pointer', transition: 'border-color 0.15s, background 0.15s',
            }}
        >
            <input ref={inputRef} type="file" accept=".zip,.als" style={{ display: 'none' }} onChange={(e) => onPick(e.target.files)} />
            {busy ? (
                <>
                    <Loader2 size={40} color={PRIMARY} style={{ animation: 'fujiSpin 1s linear infinite', marginBottom: 12 }} />
                    <style>{'@keyframes fujiSpin { to { transform: rotate(360deg); } }'}</style>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                        {phase.kind === 'uploading' ? `Uploading… ${phase.pct}%` : 'Converting your project…'}
                    </div>
                    <div style={{ color: SUB, fontSize: 13, wordBreak: 'break-all' }}>{phase.file}</div>
                    {phase.kind === 'uploading' && (
                        <div style={{ height: 6, background: S_HIGH, borderRadius: 3, marginTop: 16, overflow: 'hidden', maxWidth: 360, marginInline: 'auto' }}>
                            <div style={{ width: `${phase.pct}%`, height: '100%', background: PRIMARY, transition: 'width 0.2s' }} />
                        </div>
                    )}
                </>
            ) : (
                <>
                    <UploadCloud size={40} color={PRIMARY} style={{ marginBottom: 12 }} />
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Drop your project here, or click to choose</div>
                    <div style={{ color: SUB, fontSize: 13 }}>A .zip of your Live project folder (recommended) or an .als file · up to {MAX_MB} MB</div>
                </>
            )}
        </div>
    );

    const renderSteps = () => (
        <div style={{ ...card, marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderInput size={16} color={PRIMARY} /> Prepare your project in Ableton Live
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, color: SUB, fontSize: 14, lineHeight: 1.7 }}>
                <li>Open the set and choose <strong style={{ color: TEXT }}>File → Collect All and Save</strong>, ticking every “Collect files from” option, so all samples are copied into the project folder.</li>
                <li>Zip the whole project folder (the one containing your .als file).</li>
                <li>Upload the zip here. An .als on its own works too, but the samples won’t be included.</li>
            </ol>
        </div>
    );

    const renderResult = (r: ConvertResult) => {
        const { stats } = r.report;
        const warnings = showAllWarnings ? r.report.warnings : r.report.warnings.slice(0, WARNINGS_COLLAPSED);
        const tile = (label: string, value: string | number) => (
            <div style={{ flex: '1 1 120px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
                <div style={{ fontSize: 12, color: SUB, fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
        );
        const listRow = (icon: React.ReactNode, text: string, key: number) => (
            <li key={key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5, color: TEXT }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>{icon}</span><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{text}</span>
            </li>
        );
        const section = (title: string, children: React.ReactNode) => (
            <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>{title}</div>
                {children}
            </div>
        );
        const ul: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 };

        return (
            <div style={card}>
                <div style={{ display: 'flex', alignItems: narrow ? 'flex-start' : 'center', gap: 16, flexDirection: narrow ? 'column' : 'row' }}>
                    <CheckCircle2 size={40} color={SECONDARY} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, overflowWrap: 'anywhere' }}>{r.projectName} is ready</h2>
                        <p style={{ margin: '4px 0 0', color: SUB, fontSize: 14 }}>{r.report.source} → {r.report.target} · download available for 1 hour</p>
                    </div>
                    <a href={`/api/convert/download/${r.id}`} download={r.downloadName}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: PRIMARY, borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap', alignSelf: narrow ? 'stretch' : 'auto', justifyContent: 'center' }}>
                        <Download size={17} /> Download for FL Studio
                    </a>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                    {tile('Tracks', stats.tracks)}
                    {tile('MIDI clips', stats.midiClips)}
                    {tile('Audio clips', stats.audioClips)}
                    {tile('Notes', stats.notes.toLocaleString())}
                    {tile('Samples included', `${r.samplesIncluded}/${stats.samples}`)}
                </div>

                <p style={{ margin: '18px 0 0', color: SUB, fontSize: 13 }}>
                    Unzip the download and open the .flp from inside its folder so FL Studio finds the Samples folder next to it.
                    The full report is included as <em>Conversion report.txt</em>.
                </p>

                {r.report.converted.length > 0 && section('Converted instruments',
                    <ul style={ul}>{r.report.converted.map((c, i) => listRow(<CheckCircle2 size={15} color={SECONDARY} />, c, i))}</ul>)}

                {r.missingSamples.length > 0 && section(`Samples missing from your upload (${r.missingSamples.length})`,
                    <>
                        <p style={{ margin: '0 0 10px', color: SUB, fontSize: 13 }}>
                            These channels will open empty. Re-save the set with File → Collect All and Save (tick every option), zip the folder and convert again.
                        </p>
                        <ul style={ul}>{r.missingSamples.map((s, i) => listRow(<FileAudio size={15} color={TERTIARY} />, s, i))}</ul>
                    </>)}

                {r.report.warnings.length > 0 && section('Things to check in FL Studio',
                    <>
                        <ul style={ul}>{warnings.map((w, i) => listRow(<AlertTriangle size={15} color={PRIMARY} />, w, i))}</ul>
                        {r.report.warnings.length > WARNINGS_COLLAPSED && (
                            <button onClick={() => setShowAllWarnings((v) => !v)}
                                style={{ marginTop: 10, background: 'none', border: 'none', color: PRIMARY, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: FONT }}>
                                {showAllWarnings ? 'Show fewer' : `Show all ${r.report.warnings.length}`}
                            </button>
                        )}
                    </>)}

                <button onClick={() => setPhase({ kind: 'idle' })}
                    style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                    <RotateCcw size={15} /> Convert another project
                </button>
            </div>
        );
    };

    return (
        <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
            <AltSidebar active="Convert" />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AltHeader breadcrumb={[{ label: 'Project Converter' }]} />
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: narrow ? '20px 16px 60px' : '24px 32px 60px', boxSizing: 'border-box' }}>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${PRIMARY}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <ArrowRightLeft size={26} color={PRIMARY} />
                            </div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: narrow ? 22 : 26, fontWeight: 800 }}>Project Converter</h1>
                                <p style={{ margin: '4px 0 0', color: SUB, fontSize: 14 }}>Turn an Ableton Live project into an FL Studio project — arrangement, MIDI, samples, drum kits, mixer and effects included.</p>
                            </div>
                        </div>

                        <div style={{ maxWidth: 820, marginTop: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                                {dawPill('Ableton Live 10–12')}
                                <ArrowRight size={18} color={PRIMARY} />
                                {dawPill('FL Studio 21+')}
                                <span style={{ color: SUB, fontSize: 12, marginLeft: 4 }}>FL Studio → Ableton is coming later</span>
                            </div>

                            {!user ? (
                                <div style={{ ...card, textAlign: 'center' }}>
                                    <FileArchive size={40} color={PRIMARY} style={{ marginBottom: 12 }} />
                                    <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Sign in to convert a project</h2>
                                    <p style={{ margin: '0 0 18px', color: SUB, fontSize: 14 }}>The converter is free for Fuji Studio members.</p>
                                    <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: PRIMARY, borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
                                        <LogIn size={16} /> Sign in
                                    </Link>
                                </div>
                            ) : phase.kind === 'done' ? (
                                renderResult(phase.result)
                            ) : (
                                <>
                                    <div style={card}>
                                        {renderDropzone()}
                                        {phase.kind === 'error' && (
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, color: TERTIARY, fontSize: 14, fontWeight: 600 }}>
                                                <FileWarning size={17} style={{ flexShrink: 0, marginTop: 1 }} /> {phase.message}
                                            </div>
                                        )}
                                    </div>
                                    {renderSteps()}
                                </>
                            )}

                            <p style={{ margin: '20px 0 0', color: SUB, fontSize: 12, lineHeight: 1.6 }}>
                                Your VST plugins (Serum, Kontakt, FabFilter…) open in FL with their presets, as long as they’re installed, and Ableton’s own
                                effects — EQ Eight, Compressor, Reverb, Delay, Auto Filter, Saturator and more — become FL’s equivalents with matching settings.
                                Drum Racks and Simplers come across as FL Sampler channels with their samples loaded. Ableton’s own instruments can’t be opened
                                in FL Studio, so those tracks arrive as empty channels with their MIDI — the report lists what each one used.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FrontpageAltFConvert;
