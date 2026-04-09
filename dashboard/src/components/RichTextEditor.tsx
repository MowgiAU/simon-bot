import React, { useRef, useCallback, useEffect, useState } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import {
    Bold, Italic, Underline, Strikethrough, List, ListOrdered,
    Heading2, Heading3, Quote, Code, Link as LinkIcon, Image,
    Youtube, Music, User, AlignLeft, AlignCenter, AlignRight,
    Undo2, Redo2, Minus, Type, Twitter, FileAudio, FolderDown, Sliders,
} from 'lucide-react';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    onImageUpload?: (file: File) => Promise<string>;
    onFileUpload?: (file: File, type: 'audio' | 'project' | 'preset') => Promise<{ url: string; filename: string; size: number }>;
    placeholder?: string;
}

// ── Toolbar Button ────────────────────────────────────────────────────────────
const ToolbarBtn: React.FC<{
    icon: React.ReactNode;
    title: string;
    onClick: () => void;
    active?: boolean;
    separator?: boolean;
}> = ({ icon, title, onClick, active, separator }) => (
    <>
        {separator && <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />}
        <button
            type="button"
            title={title}
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', border: 'none', borderRadius: '6px',
                background: active ? `${colors.primary}25` : 'transparent',
                color: active ? colors.primary : colors.textSecondary,
                cursor: 'pointer', transition: 'all 0.15s',
            }}
        >
            {icon}
        </button>
    </>
);

// ── Embed Modal ───────────────────────────────────────────────────────────────
const EmbedModal: React.FC<{
    type: 'link' | 'image' | 'video' | 'track' | 'profile' | 'social';
    onInsert: (value: string, extra?: string) => void;
    onClose: () => void;
}> = ({ type, onInsert, onClose }) => {
    const [url, setUrl] = useState('');
    const [text, setText] = useState('');

    const labels: Record<string, { title: string; placeholder: string; hint: string }> = {
        link: { title: 'Insert Link', placeholder: 'https://example.com', hint: 'Enter URL and optional display text' },
        image: { title: 'Insert Image URL', placeholder: 'https://example.com/image.png', hint: 'Paste an image URL (or use the upload button in the toolbar)' },
        video: { title: 'Embed Video', placeholder: 'https://youtube.com/watch?v=...', hint: 'Paste a YouTube, Vimeo, or video URL' },
        track: { title: 'Embed Track', placeholder: '/track/username/track-slug', hint: 'Enter a Fuji Studio track URL (e.g. /track/artist/my-song)' },
        profile: { title: 'Embed Profile', placeholder: '/profile/username', hint: 'Enter a Fuji Studio profile URL (e.g. /profile/artist)' },
        social: { title: 'Embed Social Post', placeholder: 'https://twitter.com/user/status/123...', hint: 'Paste a Twitter/X or Instagram post URL' },
    };
    const cfg = labels[type] || labels.link;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
        }} onClick={onClose}>
            <div style={{
                background: colors.surface, borderRadius: borderRadius.lg, padding: '24px',
                width: '420px', maxWidth: '90vw', border: '1px solid rgba(255,255,255,0.08)',
            }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 4px', color: colors.textPrimary, fontSize: '16px' }}>{cfg.title}</h3>
                <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: '12px' }}>{cfg.hint}</p>
                <input
                    autoFocus
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={cfg.placeholder}
                    style={{
                        width: '100%', padding: '10px 12px', background: colors.background,
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm,
                        color: colors.textPrimary, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                        marginBottom: '10px',
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && url.trim()) { onInsert(url.trim(), text.trim()); onClose(); } }}
                />
                {type === 'link' && (
                    <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Display text (optional)"
                        style={{
                            width: '100%', padding: '10px 12px', background: colors.background,
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.sm,
                            color: colors.textPrimary, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                            marginBottom: '10px',
                        }}
                    />
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button type="button" onClick={onClose} style={{
                        padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: borderRadius.sm, color: colors.textSecondary, cursor: 'pointer', fontSize: '13px',
                    }}>Cancel</button>
                    <button type="button" onClick={() => { if (url.trim()) { onInsert(url.trim(), text.trim()); onClose(); } }} style={{
                        padding: '8px 16px', background: colors.primary, border: 'none',
                        borderRadius: borderRadius.sm, color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    }}>Insert</button>
                </div>
            </div>
        </div>
    );
};

// ── Main Editor ───────────────────────────────────────────────────────────────
export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, onImageUpload, onFileUpload, placeholder }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const projectInputRef = useRef<HTMLInputElement>(null);
    const presetInputRef = useRef<HTMLInputElement>(null);
    const [embedModal, setEmbedModal] = useState<null | 'link' | 'image' | 'video' | 'track' | 'profile' | 'social'>(null);
    const isInternalUpdate = useRef(false);
    const savedRange = useRef<Range | null>(null);

    const saveSelection = useCallback(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
            savedRange.current = sel.getRangeAt(0).cloneRange();
        }
    }, []);

    const restoreSelection = useCallback(() => {
        const range = savedRange.current;
        if (range && editorRef.current) {
            editorRef.current.focus();
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
            savedRange.current = null;
        } else {
            editorRef.current?.focus();
        }
    }, []);

    // Sync external value into editor
    useEffect(() => {
        if (editorRef.current && !isInternalUpdate.current) {
            if (editorRef.current.innerHTML !== value) {
                editorRef.current.innerHTML = value;
            }
        }
        isInternalUpdate.current = false;
    }, [value]);

    const exec = useCallback((cmd: string, val?: string) => {
        document.execCommand(cmd, false, val);
        editorRef.current?.focus();
        handleInput();
    }, []);

    const handleInput = useCallback(() => {
        if (editorRef.current) {
            isInternalUpdate.current = true;
            onChange(editorRef.current.innerHTML);
        }
    }, [onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); exec('bold'); }
            else if (e.key === 'i') { e.preventDefault(); exec('italic'); }
            else if (e.key === 'u') { e.preventDefault(); exec('underline'); }
            else if (e.key === 'z') { e.preventDefault(); exec(e.shiftKey ? 'redo' : 'undo'); }
        }
    }, [exec]);

    const insertHTML = useCallback((html: string) => {
        restoreSelection();
        document.execCommand('insertHTML', false, html);
        handleInput();
    }, [handleInput, restoreSelection]);

    const handleImageUpload = useCallback(async (file: File) => {
        if (!onImageUpload) return;
        try {
            const url = await onImageUpload(file);
            insertHTML(`<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0;" />`);
        } catch {
            // upload failed silently
        }
    }, [onImageUpload, insertHTML]);

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleFileUpload = useCallback(async (file: File, type: 'audio' | 'project' | 'preset') => {
        if (!onFileUpload) return;
        try {
            const result = await onFileUpload(file, type);
            const safeFilename = result.filename.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const sizeStr = formatFileSize(result.size);
            let html = '';

            if (type === 'audio') {
                html = `<div class="article-embed article-audio-file" data-embed-type="audio-file" data-embed-url="${result.url}" data-filename="${safeFilename}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:12px;"><span style="font-size:20px;">&#127925;</span><div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeFilename}</div><div style="color:${colors.textSecondary};font-size:12px;">Audio Sample &middot; ${sizeStr}</div></div><audio controls preload="none" src="${result.url}" style="height:32px;max-width:260px;"></audio></div>`;
            } else if (type === 'project') {
                const icon = safeFilename.toLowerCase().endsWith('.flp') ? '&#128196;' : '&#128230;';
                html = `<div class="article-embed article-project-file" data-embed-type="project-file" data-embed-url="${result.url}" data-filename="${safeFilename}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:12px;">${icon}<div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeFilename}</div><div style="color:${colors.textSecondary};font-size:12px;">Project File &middot; ${sizeStr}</div></div><a href="${result.url}" download style="color:${colors.primary};font-size:13px;font-weight:600;white-space:nowrap;text-decoration:none;">&#8595; Download</a></div>`;
            } else if (type === 'preset') {
                html = `<div class="article-embed article-preset-file" data-embed-type="preset-file" data-embed-url="${result.url}" data-filename="${safeFilename}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:12px;"><span style="font-size:20px;">&#127899;</span><div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeFilename}</div><div style="color:${colors.textSecondary};font-size:12px;">Preset &middot; ${sizeStr}</div></div><a href="${result.url}" download style="color:${colors.primary};font-size:13px;font-weight:600;white-space:nowrap;text-decoration:none;">&#8595; Download</a></div>`;
            }

            if (html) insertHTML(html);
        } catch {
            // upload failed silently
        }
    }, [onFileUpload, insertHTML]);

    const handleInsertEmbed = useCallback((type: string, url: string, displayText?: string) => {
        let html = '';

        if (type === 'link') {
            const label = displayText || url;
            html = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${colors.primary};text-decoration:underline;">${label}</a>`;
        } else if (type === 'image') {
            html = `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0;" />`;
        } else if (type === 'video') {
            // Extract YouTube embed URL
            const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&]+)/);
            if (ytMatch) {
                html = `<div class="article-embed article-video" style="position:relative;padding-bottom:56.25%;height:0;margin:16px 0;border-radius:12px;overflow:hidden;"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div>`;
            } else {
                html = `<div class="article-embed article-video" style="margin:16px 0;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${colors.primary};">${url}</a></div>`;
            }
        } else if (type === 'track') {
            // Track embed card placeholder — rendered interactively on article view
            const trackPath = url.startsWith('/') ? url : `/${url}`;
            const parts = trackPath.replace(/^\/track\//, '').split('/');
            const artist = parts[0] || 'artist';
            const trackName = (parts[1] || 'track').replace(/-/g, ' ');
            html = `<div class="article-embed article-track" data-embed-type="track" data-embed-url="${trackPath}" contenteditable="false" style="background:linear-gradient(135deg,${colors.surface} 0%,rgba(16,185,129,0.04) 100%);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:14px;"><div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,rgba(16,185,129,0.3),rgba(16,185,129,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:18px;margin-left:2px;">&#9654;</span></div><div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:700;font-size:14px;text-transform:capitalize;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${trackName}</div><div style="color:${colors.textSecondary};font-size:12px;">by ${artist} &middot; Interactive player on publish</div></div><div style="padding:6px 12px;border-radius:8px;background:${colors.primary};color:white;font-size:11px;font-weight:700;white-space:nowrap;">TRACK EMBED</div></div>`;
        } else if (type === 'profile') {
            const profilePath = url.startsWith('/') ? url : `/${url}`;
            const username = profilePath.replace(/^\/profile\//, '').split('/')[0] || 'user';
            html = `<div class="article-embed article-profile" data-embed-type="profile" data-embed-url="${profilePath}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:14px;"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,rgba(16,185,129,0.3),rgba(16,185,129,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:18px;">&#128100;</span></div><div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:700;font-size:14px;">@${username}</div><div style="color:${colors.textSecondary};font-size:12px;">Mini profile card on publish</div></div><div style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.08);color:${colors.textSecondary};font-size:11px;font-weight:700;white-space:nowrap;">PROFILE EMBED</div></div>`;
        } else if (type === 'social') {
            // Twitter/X or Instagram embed
            const isTweet = url.includes('twitter.com') || url.includes('x.com');
            const isInsta = url.includes('instagram.com');
            const label = isTweet ? 'Twitter/X Post' : isInsta ? 'Instagram Post' : 'Social Post';
            html = `<div class="article-embed article-social" data-embed-type="social" data-embed-url="${url}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:12px;"><span style="font-size:20px;">${isTweet ? '&#120143;' : '&#128247;'}</span><div><div style="color:${colors.textPrimary};font-weight:600;font-size:14px;">${label}</div><div style="color:${colors.textSecondary};font-size:12px;">${url}</div></div></div>`;
        }

        if (html) insertHTML(html);
    }, [insertHTML]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        // Handle pasted images
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/') && onImageUpload) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) handleImageUpload(file);
                return;
            }
        }
        // For text paste, strip formatting but keep basic structure
        const html = e.clipboardData.getData('text/html');
        if (html) {
            e.preventDefault();
            // Allow basic HTML tags through
            const clean = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/on\w+="[^"]*"/gi, '')
                .replace(/javascript:/gi, '');
            document.execCommand('insertHTML', false, clean);
            handleInput();
        }
    }, [onImageUpload, handleImageUpload, handleInput]);

    return (
        <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, overflow: 'hidden', background: colors.background }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '8px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.08)', background: colors.surface,
                alignItems: 'center',
            }}>
                <ToolbarBtn icon={<Bold size={15} />} title="Bold (Ctrl+B)" onClick={() => exec('bold')} />
                <ToolbarBtn icon={<Italic size={15} />} title="Italic (Ctrl+I)" onClick={() => exec('italic')} />
                <ToolbarBtn icon={<Underline size={15} />} title="Underline (Ctrl+U)" onClick={() => exec('underline')} />
                <ToolbarBtn icon={<Strikethrough size={15} />} title="Strikethrough" onClick={() => exec('strikeThrough')} />

                <ToolbarBtn icon={<Heading2 size={15} />} title="Heading 2" onClick={() => exec('formatBlock', 'h2')} separator />
                <ToolbarBtn icon={<Heading3 size={15} />} title="Heading 3" onClick={() => exec('formatBlock', 'h3')} />
                <ToolbarBtn icon={<Type size={15} />} title="Paragraph" onClick={() => exec('formatBlock', 'p')} />

                <ToolbarBtn icon={<List size={15} />} title="Bullet List" onClick={() => exec('insertUnorderedList')} separator />
                <ToolbarBtn icon={<ListOrdered size={15} />} title="Numbered List" onClick={() => exec('insertOrderedList')} />
                <ToolbarBtn icon={<Quote size={15} />} title="Block Quote" onClick={() => exec('formatBlock', 'blockquote')} />
                <ToolbarBtn icon={<Code size={15} />} title="Code Block" onClick={() => exec('formatBlock', 'pre')} />
                <ToolbarBtn icon={<Minus size={15} />} title="Horizontal Rule" onClick={() => exec('insertHorizontalRule')} />

                <ToolbarBtn icon={<AlignLeft size={15} />} title="Align Left" onClick={() => exec('justifyLeft')} separator />
                <ToolbarBtn icon={<AlignCenter size={15} />} title="Align Center" onClick={() => exec('justifyCenter')} />
                <ToolbarBtn icon={<AlignRight size={15} />} title="Align Right" onClick={() => exec('justifyRight')} />

                <ToolbarBtn icon={<LinkIcon size={15} />} title="Insert Link" onClick={() => { saveSelection(); setEmbedModal('link'); }} separator />
                <ToolbarBtn icon={<Image size={15} />} title="Upload Image" onClick={() => { saveSelection(); fileInputRef.current?.click(); }} />
                <ToolbarBtn icon={<Image size={15} />} title="Image from URL" onClick={() => { saveSelection(); setEmbedModal('image'); }} />
                <ToolbarBtn icon={<Youtube size={15} />} title="Embed Video" onClick={() => { saveSelection(); setEmbedModal('video'); }} />
                <ToolbarBtn icon={<Music size={15} />} title="Embed Track" onClick={() => { saveSelection(); setEmbedModal('track'); }} />
                <ToolbarBtn icon={<User size={15} />} title="Embed Profile" onClick={() => { saveSelection(); setEmbedModal('profile'); }} />
                <ToolbarBtn icon={<Twitter size={15} />} title="Embed Social Post" onClick={() => { saveSelection(); setEmbedModal('social'); }} />

                <ToolbarBtn icon={<FileAudio size={15} />} title="Upload Audio Sample" onClick={() => { saveSelection(); audioInputRef.current?.click(); }} separator />
                <ToolbarBtn icon={<FolderDown size={15} />} title="Upload Project File" onClick={() => { saveSelection(); projectInputRef.current?.click(); }} />
                <ToolbarBtn icon={<Sliders size={15} />} title="Upload Preset" onClick={() => { saveSelection(); presetInputRef.current?.click(); }} />

                <ToolbarBtn icon={<Undo2 size={15} />} title="Undo (Ctrl+Z)" onClick={() => exec('undo')} separator />
                <ToolbarBtn icon={<Redo2 size={15} />} title="Redo (Ctrl+Shift+Z)" onClick={() => exec('redo')} />
            </div>

            {/* Editable area */}
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                data-placeholder={placeholder || 'Start writing your article...'}
                style={{
                    minHeight: '400px', maxHeight: '70vh', overflowY: 'auto',
                    padding: '20px 24px', color: colors.textPrimary, fontSize: '15px',
                    lineHeight: 1.7, outline: 'none', fontFamily: "'Inter', sans-serif",
                }}
            />

            {/* Hidden file input for image uploads */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                    e.target.value = '';
                }}
            />

            {/* Hidden file input for audio uploads */}
            <input
                ref={audioInputRef}
                type="file"
                accept=".mp3,.wav,.flac,.ogg,.aac,.m4a,.aiff,.aif"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'audio');
                    e.target.value = '';
                }}
            />

            {/* Hidden file input for project file uploads */}
            <input
                ref={projectInputRef}
                type="file"
                accept=".flp,.zip,.als,.logicx"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'project');
                    e.target.value = '';
                }}
            />

            {/* Hidden file input for preset uploads */}
            <input
                ref={presetInputRef}
                type="file"
                accept=".fst,.fxp,.fxb,.nmsv,.vstpreset,.adv,.adg,.aupreset,.wav,.zip,.rar,.7z"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'preset');
                    e.target.value = '';
                }}
            />

            {/* Embed modals */}
            {embedModal && (
                <EmbedModal
                    type={embedModal}
                    onInsert={(url, extra) => handleInsertEmbed(embedModal, url, extra)}
                    onClose={() => setEmbedModal(null)}
                />
            )}

            {/* Editor styles */}
            <style>{`
                [data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: ${colors.textTertiary};
                    pointer-events: none;
                }
                [contenteditable] h2 { font-size: 24px; font-weight: 700; margin: 24px 0 12px; color: ${colors.textPrimary}; }
                [contenteditable] h3 { font-size: 18px; font-weight: 600; margin: 20px 0 10px; color: ${colors.textPrimary}; }
                [contenteditable] p { margin: 8px 0; }
                [contenteditable] blockquote {
                    border-left: 3px solid ${colors.primary};
                    margin: 16px 0; padding: 12px 20px;
                    background: rgba(16,185,129,0.06); border-radius: 0 8px 8px 0;
                    color: ${colors.textSecondary}; font-style: italic;
                }
                [contenteditable] pre {
                    background: ${colors.surface}; padding: 16px;
                    border-radius: 8px; font-family: 'JetBrains Mono', monospace;
                    font-size: 13px; overflow-x: auto; margin: 16px 0;
                    border: 1px solid rgba(255,255,255,0.06);
                }
                [contenteditable] img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
                [contenteditable] a { color: ${colors.primary}; }
                [contenteditable] hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0; }
                [contenteditable] ul, [contenteditable] ol { padding-left: 24px; margin: 8px 0; }
                [contenteditable] li { margin: 4px 0; }
                [contenteditable] .article-embed { user-select: none; }
                [contenteditable] .article-embed:hover { border-color: ${colors.primary} !important; }
            `}</style>
        </div>
    );
};
