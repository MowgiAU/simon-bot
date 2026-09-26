/**
 * Alt F — Project Converter (Ableton Live → FL Studio).
 * Upload a zipped Live project (or a bare .als) → POST /api/convert/ableton-to-fl,
 * then show the conversion report and a download link (kept for an hour).
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { DirectUploadUnavailable, uploadFile } from '../lib/uploadFile';
import { AltSidebar, BG, S_CONT, S_HIGH, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT, CONTENT_MAX } from '../components/altshell/AltSidebar';
import { AltHeader } from '../components/altshell/AltHeader';
import { ArrangementViewer, type ArrangementData } from '../components/ArrangementViewer';
import { useAltBreakpoint } from '../components/altshell/useAltBreakpoint';
import {
    ArrowRightLeft, ArrowRight, UploadCloud, FileArchive, CheckCircle2, AlertTriangle, FileWarning,
    Download, RotateCcw, Loader2, LogIn, FolderInput, FileAudio, Puzzle, Boxes, FolderPlus,
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
        plugins: string[];
        /** Kontakt-style players in the project, with the library each one looks like. */
        libraries: { plugin: string; track: string; library: string | null; fingerprint: string }[];
        converted: string[];
        /** Devices that couldn't come across, with the reason. */
        deviceNotes: { device: string; why: string }[];
        warnings: string[];
    };
    /** The converted .flp was parsed back, so a preview can be fetched for it. */
    hasArrangement?: boolean;
}

type Phase =
    | { kind: 'idle' }
    | { kind: 'uploading'; pct: number; file: string }
    | { kind: 'converting'; file: string }
    | { kind: 'done'; result: ConvertResult }
    | { kind: 'error'; message: string };

interface KnownPlugin {
    name: string;
    aliases: string[] | null;
    displayName: string | null;
    imageUrl: string | null;
    link: string | null;
    developer: string | null;
    description: string | null;
}

const MAX_MB = 600;
const WARNINGS_COLLAPSED = 6;

const FrontpageAltFConvert: React.FC = () => {
    const { user } = useAuth();
    const bp = useAltBreakpoint();
    const narrow = bp === 'xs' || bp === 'sm';
    const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
    const [dragging, setDragging] = useState(false);
    const [showAllWarnings, setShowAllWarnings] = useState(false);
    const [registry, setRegistry] = useState<KnownPlugin[]>([]);
    // Libraries the user names for players we couldn't identify: fingerprint -> what they typed / saved
    const [libraryDraft, setLibraryDraft] = useState<Record<string, string>>({});
    const [namedByYou, setNamedByYou] = useState<Record<string, { library: string; status: string }>>({});
    const [naming, setNaming] = useState<string | null>(null);
    const [namingError, setNamingError] = useState('');
    // Keeping a conversion: it becomes a project in the user's library rather than expiring
    // The converted arrangement, shown read-only — nothing here plays, so the refs the
    // viewer uses to drive its playhead stay at zero.
    const [arrangement, setArrangement] = useState<ArrangementData | null>(null);
    const [zoom, setZoom] = useState(5.5);
    const previewTimeRef = useRef(0);
    const previewPlayingRef = useRef(false);

    const [saving, setSaving] = useState(false);
    const [savedProject, setSavedProject] = useState<{ id: string; name: string } | null>(null);
    const [saveError, setSaveError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // The site's plugin list, used to show what a converted project needs
    useEffect(() => {
        axios.get<KnownPlugin[]>('/api/plugins/registry').then(({ data }) => setRegistry(data)).catch(() => setRegistry([]));
    }, []);

    // The converted arrangement, fetched once a conversion finishes. Clearing it on any
    // other phase means starting another upload drops the previous project's preview.
    useEffect(() => {
        // Asked for unconditionally: a conversion that produced no preview just 404s here,
        // so a missing hasArrangement flag can't quietly hide a preview that does exist.
        if (phase.kind !== 'done') { setArrangement(null); return; }
        let live = true;
        axios.get<ArrangementData>(`/api/convert/${phase.result.id}/arrangement`, { withCredentials: true })
            .then(({ data }) => {
                if (!live) return;
                // Templates convert to an arrangement with no clips — an empty grid says nothing.
                const clips = (data.tracks ?? []).reduce((n, t) => n + (t.clips?.length ?? 0), 0);
                setArrangement(clips > 0 ? data : null);
            })
            .catch(() => { if (live) setArrangement(null); });
        return () => { live = false; };
    }, [phase]);

    /** The registry entry for a plugin name as Live had it, by name or alias (case-insensitive). */
    const matchPlugin = (name: string): KnownPlugin | undefined => {
        const want = name.trim().toLowerCase();
        return registry.find((p) => p.name.trim().toLowerCase() === want
            || (Array.isArray(p.aliases) ? p.aliases : []).some((a) => String(a).split(',').some((one) => one.trim().toLowerCase() === want)));
    };

    /** Tells the site which library this player loads, keyed by the hash of its saved state. */
    const nameLibrary = async (fingerprint: string, plugin: string) => {
        const library = (libraryDraft[fingerprint] ?? '').trim();
        if (library.length < 2) return;
        setNaming(fingerprint);
        setNamingError('');
        try {
            const { data } = await axios.post<{ library: string; status: string }>('/api/convert/library-name', { fingerprint, plugin, library }, { withCredentials: true });
            setNamedByYou((n) => ({ ...n, [fingerprint]: data }));
        } catch (e: any) {
            setNamingError(e?.response?.data?.error || 'That didn’t save — please try again.');
        } finally {
            setNaming(null);
        }
    };

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
        try {
            let result: ConvertResult;
            try {
                // Straight to storage, so the project isn't capped at what a proxied request allows
                const up = await uploadFile(file, 'convert', (pct) => setPhase({ kind: 'uploading', pct, file: file.name }));
                setPhase({ kind: 'converting', file: file.name });
                result = (await axios.post<ConvertResult>('/api/convert/from-upload', { key: up.key, name: up.name }, { withCredentials: true })).data;
            } catch (e) {
                if (!(e instanceof DirectUploadUnavailable)) throw e;
                result = await uploadInPieces(file);
            }
            setPhase({ kind: 'done', result });
        } catch (e: any) {
            setPhase({ kind: 'error', message: e?.response?.data?.error || e?.message || 'Conversion failed. Please try again.' });
        }
    };

    /**
     * The way in when storage can't take the file directly: the project goes through the API in
     * pieces, since a proxied request body can't exceed 100 MB in one go.
     */
    const uploadInPieces = async (file: File): Promise<ConvertResult> => {
        const { data: started } = await axios.post<{ uploadId: string; chunkSize: number }>(
            '/api/convert/upload/start', { name: file.name, size: file.size }, { withCredentials: true });
        for (let sent = 0; sent < file.size; sent += started.chunkSize) {
            const form = new FormData();
            form.append('uploadId', started.uploadId);
            form.append('chunk', file.slice(sent, Math.min(sent + started.chunkSize, file.size)));
            await axios.post('/api/convert/upload/chunk', form, { withCredentials: true });
            setPhase({ kind: 'uploading', pct: Math.round((Math.min(sent + started.chunkSize, file.size) / file.size) * 100), file: file.name });
        }
        setPhase({ kind: 'converting', file: file.name });
        const { data } = await axios.post<ConvertResult>('/api/convert/upload/finish', { uploadId: started.uploadId }, { withCredentials: true });
        return data;
    };

    /** Keeps the conversion as a project, so it outlives the hour the download lasts. */
    const saveAsProject = async (id: string) => {
        setSaving(true);
        setSaveError('');
        try {
            const { data } = await axios.post<{ id: string; name: string }>(`/api/convert/${id}/save-as-project`, {}, { withCredentials: true });
            setSavedProject(data);
        } catch (e: any) {
            setSaveError(e?.response?.data?.error || 'That could not be saved to your projects.');
        } finally {
            setSaving(false);
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
        // Sample-library players: the ones we could name, grouped by library, then the rest
        const libs = r.report.libraries ?? [];
        const namedLibraries = [...libs.filter((l) => l.library)
            .reduce((map, l) => map.set(l.library!, [...(map.get(l.library!) ?? []), l]), new Map<string, typeof libs>())];
        const unknownLibraries = libs.filter((l) => !l.library);

        const cardGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 };
        /** A plugin or library as a card: its picture and blurb from our list when we have it. */
        const itemCard = (name: string, note?: string) => {
            const known = matchPlugin(name);
            const body = (
                <>
                    {known?.imageUrl
                        ? <img src={known.imageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 48, height: 48, borderRadius: 8, background: S_HIGH, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Puzzle size={20} color={SUB} /></div>}
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, overflowWrap: 'anywhere' }}>{known?.displayName || name}</div>
                        <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>
                            {known?.developer || 'Not in our plugin list yet'}{known?.link ? ' · Get it' : ''}
                        </div>
                        {note && <div style={{ fontSize: 12, color: SUB, marginTop: 6, overflowWrap: 'anywhere' }}>{note}</div>}
                        {known?.description && (
                            <div style={{ fontSize: 12, color: SUB, marginTop: 6, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {known.description}
                            </div>
                        )}
                    </div>
                </>
            );
            const style: React.CSSProperties = { display: 'flex', gap: 12, background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, textDecoration: 'none', color: TEXT };
            return known?.link
                ? <a key={name} href={known.link.startsWith('http') ? known.link : `https://${known.link}`} target="_blank" rel="noopener noreferrer" style={style}>{body}</a>
                : <div key={name} style={style}>{body}</div>;
        };
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

                {arrangement && section('Converted arrangement',
                    <>
                        <p style={{ margin: '0 0 12px', color: SUB, fontSize: 13 }}>
                            Read back from the .flp this conversion produced, so it shows what opens in FL Studio.
                            Click a clip for its notes or its sample.
                        </p>
                        <ArrangementViewer
                            arrangement={arrangement}
                            duration={0}
                            currentTimeRef={previewTimeRef}
                            isPlayingRef={previewPlayingRef}
                            projectFileUrl={null}
                            zoom={zoom}
                            setZoom={setZoom}
                        />
                    </>)}

                <p style={{ margin: '18px 0 0', color: SUB, fontSize: 13 }}>
                    Unzip the download and open the .flp from inside its folder so FL Studio finds the Samples folder next to it.
                    The full report is included as <em>Conversion report.txt</em>.
                </p>

                {r.report.plugins?.length > 0 && section(`Plugins this project needs (${r.report.plugins.length})`,
                    <>
                        <p style={{ margin: '0 0 12px', color: SUB, fontSize: 13 }}>
                            Install these in FL Studio before opening the project — anything missing shows FL's “plugin not found” message.
                        </p>
                        <div style={cardGrid}>{r.report.plugins.map((name) => itemCard(name))}</div>
                    </>)}

                {namedLibraries.length + unknownLibraries.length > 0 && section(`Sample libraries these tracks need (${namedLibraries.length + unknownLibraries.length})`,
                    <>
                        <p style={{ margin: '0 0 12px', color: SUB, fontSize: 13 }}>
                            The player opens with its preset, but its sounds live in a library installed on your machine — without it
                            you get a “content missing” message, in FL Studio and in Live alike. Install or register the library
                            (Kontakt: Native Access, or Libraries → Add Library), then open the project again.
                        </p>
                        {namedLibraries.length > 0 && (
                            <div style={cardGrid}>
                                {namedLibraries.map(([library, on]) => itemCard(library, `${on[0].plugin} on ${on.map((l) => `“${l.track}”`).join(', ')}`))}
                            </div>
                        )}
                        {unknownLibraries.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: namedLibraries.length ? 12 : 0 }}>
                                <p style={{ margin: 0, color: SUB, fontSize: 13 }}>
                                    These keep the library name inside their own saved data, so we can't read it — but if you know it,
                                    tell us: we check it first, and once it's confirmed every conversion of that same instrument is named for everyone.
                                </p>
                                {unknownLibraries.map((l) => {
                                    const saved = namedByYou[l.fingerprint];
                                    return (
                                        <div key={`${l.fingerprint}-${l.track}`} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
                                                <Boxes size={15} color={TERTIARY} style={{ flexShrink: 0, marginTop: 3 }} />
                                                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{l.plugin} on “{l.track}”</span>
                                            </div>
                                            {saved ? (
                                                <div style={{ marginTop: 8, fontSize: 13, color: SECONDARY, fontWeight: 700 }}>
                                                    {saved.status === 'approved'
                                                        ? `Already confirmed as ${saved.library} — your next conversion will say so`
                                                        : `Thanks — “${saved.library}” is with us to confirm before it names anyone else’s project`}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                                    <input
                                                        value={libraryDraft[l.fingerprint] ?? ''}
                                                        onChange={(e) => setLibraryDraft((d) => ({ ...d, [l.fingerprint]: e.target.value }))}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') nameLibrary(l.fingerprint, l.plugin); }}
                                                        placeholder="Which library is this? e.g. Shreddage 3"
                                                        style={{ flex: '1 1 220px', minWidth: 0, padding: '9px 12px', background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, fontFamily: FONT }}
                                                    />
                                                    <button
                                                        onClick={() => nameLibrary(l.fingerprint, l.plugin)}
                                                        disabled={naming === l.fingerprint || (libraryDraft[l.fingerprint] ?? '').trim().length < 2}
                                                        style={{ padding: '9px 16px', background: PRIMARY, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: FONT, cursor: 'pointer', opacity: naming === l.fingerprint ? 0.6 : 1 }}>
                                                        {naming === l.fingerprint ? 'Saving…' : 'Save name'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {namingError && <div style={{ fontSize: 13, color: PRIMARY }}>{namingError}</div>}
                            </div>
                        )}
                    </>)}

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

                {(r.report.deviceNotes ?? []).length > 0 && section('Why some devices couldn’t come across',
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {r.report.deviceNotes.map((n) => (
                            <div key={n.device} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{n.device}</div>
                                <div style={{ fontSize: 13, color: SUB, lineHeight: 1.6 }}>{n.why}</div>
                            </div>
                        ))}
                    </div>)}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 26 }}>
                    {savedProject ? (
                        <Link to={`/projects/${savedProject.id}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: S_HIGH, border: `1px solid ${SECONDARY}`, borderRadius: 10, color: TEXT, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                            <CheckCircle2 size={15} color={SECONDARY} /> Saved as “{savedProject.name}” — open it
                        </Link>
                    ) : (
                        <button onClick={() => saveAsProject(r.id)} disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, opacity: saving ? 0.6 : 1 }}>
                            <FolderPlus size={15} /> {saving ? 'Saving…' : 'Keep in my projects'}
                        </button>
                    )}
                    <button onClick={() => setPhase({ kind: 'idle' })}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: S_HIGH, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                        <RotateCcw size={15} /> Convert another project
                    </button>
                </div>
                {saveError && <div style={{ marginTop: 10, fontSize: 13, color: PRIMARY }}>{saveError}</div>}
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

                        {/* No right rail on this page, so the content takes the full column
                            width (the page container caps it at CONTENT_MAX). The plugin and
                            library grids are auto-fill, so they gain columns rather than stretch. */}
                        <div style={{ marginTop: 24 }}>
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
