/**
 * ArticleEditorRich — modern TipTap-based article body editor.
 *
 * Drop-in replacement for RichTextEditor with the same prop contract
 * (value HTML in / onChange HTML out, onImageUpload, onFileUpload).
 *
 * Embeds (track / profile / playlist / social / video / audio-file /
 * project-file / preset-file) are stored as a single preserved-HTML atom
 * node whose renderHTML emits the exact same
 *   <div class="article-embed article-… data-embed-type=… data-embed-url=…">…</div>
 * markup the legacy editor produced — so existing published articles round-trip
 * and the public ArticleEmbeds hydrator needs no changes.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { colors } from '../theme/theme';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
    Heading2, Heading3, Quote, Code, Link as LinkIcon, Image as ImageIcon,
    Youtube, Music, User, AlignLeft, AlignCenter, AlignRight,
    Undo2, Redo2, Minus, Twitter, FileAudio, FolderDown, Sliders, ListMusic, Trash2,
} from 'lucide-react';

interface ArticleEditorRichProps {
    value: string;
    onChange: (html: string) => void;
    onImageUpload?: (file: File) => Promise<string>;
    onFileUpload?: (file: File, type: 'audio' | 'project' | 'preset') => Promise<{ url: string; filename: string; size: number }>;
    placeholder?: string;
}

// ── Embed HTML builders (byte-compatible with the legacy editor) ────────────────
const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

function buildEmbedHtml(type: string, url: string, displayText?: string): { html: string; embedType: string } | null {
    if (type === 'image') {
        return { html: `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0;" />`, embedType: 'image' };
    }
    if (type === 'video') {
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&]+)/);
        const html = ytMatch
            ? `<div class="article-embed article-video" style="position:relative;padding-bottom:56.25%;height:0;margin:16px 0;border-radius:12px;overflow:hidden;"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe></div>`
            : `<div class="article-embed article-video" style="margin:16px 0;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${colors.primary};">${esc(url)}</a></div>`;
        return { html, embedType: 'video' };
    }
    if (type === 'playlist') {
        let playlistId = url.trim();
        try { playlistId = new URL(playlistId).pathname; } catch { /* already a path */ }
        playlistId = playlistId.replace(/^\/playlists?\//, '').split('/')[0] || playlistId;
        return { html: `<div class="article-embed article-playlist" data-embed-type="playlist" data-embed-url="${playlistId}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:14px;"><div style="width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,rgba(242, 120, 10,0.3),rgba(242, 120, 10,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:20px;">&#127925;</span></div><div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:700;font-size:14px;">Playlist</div><div style="color:${colors.textSecondary};font-size:12px;">Interactive playlist player on publish</div></div><div style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.08);color:${colors.textSecondary};font-size:11px;font-weight:700;white-space:nowrap;">PLAYLIST</div></div>`, embedType: 'playlist' };
    }
    if (type === 'track') {
        let trackPath = url;
        try { trackPath = new URL(url).pathname; } catch { /* already a path */ }
        if (!trackPath.startsWith('/')) trackPath = `/${trackPath}`;
        if (trackPath.match(/^\/playlists?\//)) {
            const playlistId = trackPath.replace(/^\/playlists?\//, '').split('/')[0];
            return buildEmbedHtml('playlist', playlistId);
        }
        const parts = trackPath.replace(/^\/track\//, '').split('/');
        const artist = parts[0] || 'artist';
        const trackName = (parts[1] || 'track').replace(/-/g, ' ');
        return { html: `<div class="article-embed article-track" data-embed-type="track" data-embed-url="${trackPath}" contenteditable="false" style="background:linear-gradient(135deg,${colors.surface} 0%,rgba(242, 120, 10,0.04) 100%);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:14px;"><div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,rgba(242, 120, 10,0.3),rgba(242, 120, 10,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:18px;margin-left:2px;">&#9654;</span></div><div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:700;font-size:14px;text-transform:capitalize;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(trackName)}</div><div style="color:${colors.textSecondary};font-size:12px;">by ${esc(artist)} &middot; Interactive player on publish</div></div><div style="padding:6px 12px;border-radius:8px;background:${colors.primary};color:white;font-size:11px;font-weight:700;white-space:nowrap;">TRACK EMBED</div></div>`, embedType: 'track' };
    }
    if (type === 'profile') {
        let profilePath = url;
        try { profilePath = new URL(url).pathname; } catch { /* already a path */ }
        if (!profilePath.startsWith('/')) profilePath = `/${profilePath}`;
        const username = profilePath.replace(/^\/profile\//, '').split('/')[0] || 'user';
        return { html: `<div class="article-embed article-profile" data-embed-type="profile" data-embed-url="${profilePath}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:14px;"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,rgba(242, 120, 10,0.3),rgba(242, 120, 10,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:18px;">&#128100;</span></div><div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:700;font-size:14px;">@${esc(username)}</div><div style="color:${colors.textSecondary};font-size:12px;">Mini profile card on publish</div></div><div style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.08);color:${colors.textSecondary};font-size:11px;font-weight:700;white-space:nowrap;">PROFILE EMBED</div></div>`, embedType: 'profile' };
    }
    if (type === 'social') {
        const isTweet = url.includes('twitter.com') || url.includes('x.com');
        const isInsta = url.includes('instagram.com');
        const label = isTweet ? 'Twitter/X Post' : isInsta ? 'Instagram Post' : 'Social Post';
        return { html: `<div class="article-embed article-social" data-embed-type="social" data-embed-url="${url}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:12px;"><span style="font-size:20px;">${isTweet ? '&#120143;' : '&#128247;'}</span><div><div style="color:${colors.textPrimary};font-weight:600;font-size:14px;">${label}</div><div style="color:${colors.textSecondary};font-size:12px;">${esc(url)}</div></div></div>`, embedType: 'social' };
    }
    return null;
}

function buildFileEmbedHtml(type: 'audio' | 'project' | 'preset', url: string, filename: string, size: number): { html: string; embedType: string } {
    const safe = esc(filename);
    const sizeStr = formatFileSize(size);
    if (type === 'audio') {
        return { html: `<div class="article-embed article-audio-file" data-embed-type="audio-file" data-embed-url="${url}" data-filename="${safe}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:12px;"><span style="font-size:20px;">&#127925;</span><div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe}</div><div style="color:${colors.textSecondary};font-size:12px;">Audio Sample &middot; ${sizeStr}</div></div><audio controls preload="none" src="${url}" style="height:32px;max-width:260px;"></audio></div>`, embedType: 'audio-file' };
    }
    const icon = safe.toLowerCase().endsWith('.flp') ? '&#128196;' : '&#128230;';
    const embedType = type === 'project' ? 'project-file' : 'preset-file';
    const cls = type === 'project' ? 'article-project-file' : 'article-preset-file';
    const labelLine = type === 'project' ? `Project File &middot; ${sizeStr}` : `Preset &middot; ${sizeStr}`;
    const leadIcon = type === 'project' ? icon : '<span style="font-size:20px;">&#127899;</span>';
    return { html: `<div class="article-embed ${cls}" data-embed-type="${embedType}" data-embed-url="${url}" data-filename="${safe}" contenteditable="false" style="background:${colors.surface};border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:12px;">${leadIcon}<div style="flex:1;min-width:0;"><div style="color:${colors.textPrimary};font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe}</div><div style="color:${colors.textSecondary};font-size:12px;">${labelLine}</div></div><a href="${url}" download style="color:${colors.primary};font-size:13px;font-weight:600;white-space:nowrap;text-decoration:none;">&#8595; Download</a></div>`, embedType };
}

// ── In-editor node view: a friendly card (the stored HTML stays verbatim) ────────
const EMBED_LABEL: Record<string, string> = {
    track: 'Track embed', profile: 'Profile embed', playlist: 'Playlist embed',
    social: 'Social post', video: 'Video', 'audio-file': 'Audio sample',
    'project-file': 'Project file', 'preset-file': 'Preset file', image: 'Image',
};
const EmbedNodeView: React.FC<any> = ({ node, deleteNode, selected }) => {
    const type: string = node.attrs.embedType || 'embed';
    const html: string = node.attrs.html || '';
    const urlMatch = html.match(/data-embed-url="([^"]*)"/) || html.match(/src="([^"]*)"/);
    const fileMatch = html.match(/data-filename="([^"]*)"/);
    const detail = fileMatch?.[1] || urlMatch?.[1] || '';
    const isImage = type === 'image';
    return (
        <NodeViewWrapper>
            <div
                contentEditable={false}
                style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: isImage ? 0 : '12px 14px',
                    margin: '12px 0', borderRadius: 12, border: `1px solid ${selected ? colors.primary : colors.border}`,
                    background: colors.surface, position: 'relative',
                }}
            >
                {isImage
                    ? <span dangerouslySetInnerHTML={{ __html: html }} style={{ display: 'block', width: '100%' }} />
                    : <>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {type === 'track' && <Music size={16} color={colors.primary} />}
                            {type === 'playlist' && <ListMusic size={16} color={colors.primary} />}
                            {type === 'profile' && <User size={16} color={colors.primary} />}
                            {type === 'video' && <Youtube size={16} color={colors.primary} />}
                            {type === 'social' && <Twitter size={16} color={colors.primary} />}
                            {type === 'audio-file' && <FileAudio size={16} color={colors.primary} />}
                            {type === 'project-file' && <FolderDown size={16} color={colors.primary} />}
                            {type === 'preset-file' && <Sliders size={16} color={colors.primary} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{EMBED_LABEL[type] || 'Embed'}</div>
                            {detail && <div style={{ fontSize: 12, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>}
                        </div>
                    </>}
                <button type="button" onClick={() => deleteNode()} title="Remove"
                    style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: 6, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                    <Trash2 size={13} />
                </button>
            </div>
        </NodeViewWrapper>
    );
};

// ── Preserved-HTML atom node ────────────────────────────────────────────────────
const ArticleEmbed = Node.create({
    name: 'articleEmbed',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
        return {
            html: { default: '' },
            embedType: { default: null },
        };
    },
    parseHTML() {
        return [
            {
                tag: 'div.article-embed',
                priority: 100,
                getAttrs: (el) => ({
                    html: (el as HTMLElement).outerHTML,
                    embedType: (el as HTMLElement).getAttribute('data-embed-type')
                        || ((el as HTMLElement).className.match(/article-(video|social|track|profile|playlist|audio-file|project-file|preset-file)/)?.[1] ?? null),
                }),
            },
        ];
    },
    renderHTML({ node }) {
        const tmp = document.createElement('div');
        tmp.innerHTML = node.attrs.html || '';
        const el = tmp.firstElementChild as HTMLElement | null;
        return el || ['div', { class: 'article-embed' }];
    },
    addNodeView() {
        return ReactNodeViewRenderer(EmbedNodeView);
    },
});

// ── Toolbar ─────────────────────────────────────────────────────────────────────
const Btn: React.FC<{ onClick: () => void; active?: boolean; title: string; children: React.ReactNode }> = ({ onClick, active, title, children }) => (
    <button type="button" title={title} onMouseDown={e => { e.preventDefault(); onClick(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', background: active ? `${colors.primary}22` : 'transparent', color: active ? colors.primary : colors.textSecondary }}>
        {children}
    </button>
);
const Sep = () => <div style={{ width: 1, height: 20, background: colors.border, margin: '0 4px' }} />;

export const ArticleEditorRich: React.FC<ArticleEditorRichProps> = ({ value, onChange, onImageUpload, onFileUpload, placeholder }) => {
    const imageInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const projectInputRef = useRef<HTMLInputElement>(null);
    const presetInputRef = useRef<HTMLInputElement>(null);
    const lastEmitted = useRef<string>(value);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [2, 3] } }),
            Underline,
            Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank', style: `color:${colors.primary};text-decoration:underline;` } }),
            Image.configure({ HTMLAttributes: { style: 'max-width:100%;border-radius:8px;margin:12px 0;' } }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Placeholder.configure({ placeholder: placeholder || 'Write your article…' }),
            ArticleEmbed,
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            lastEmitted.current = html;
            onChange(html);
        },
    });

    // Sync external value in (e.g. when loading an article) without clobbering typing
    useEffect(() => {
        if (!editor) return;
        if (value !== lastEmitted.current) {
            lastEmitted.current = value;
            editor.commands.setContent(value || '', false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, editor]);

    const insertEmbed = useCallback((type: string, url: string) => {
        if (!editor) return;
        const built = buildEmbedHtml(type, url);
        if (!built) return;
        if (built.embedType === 'image') {
            editor.chain().focus().setImage({ src: url }).run();
        } else {
            editor.chain().focus().insertContent({ type: 'articleEmbed', attrs: built }).run();
        }
    }, [editor]);

    const doFileUpload = useCallback(async (file: File, type: 'audio' | 'project' | 'preset') => {
        if (!editor || !onFileUpload) return;
        try {
            const r = await onFileUpload(file, type);
            const built = buildFileEmbedHtml(type, r.url, r.filename, r.size);
            editor.chain().focus().insertContent({ type: 'articleEmbed', attrs: built }).run();
        } catch { /* silent */ }
    }, [editor, onFileUpload]);

    const doImageUpload = useCallback(async (file: File) => {
        if (!editor || !onImageUpload) return;
        try {
            const url = await onImageUpload(file);
            editor.chain().focus().setImage({ src: url }).run();
        } catch { /* silent */ }
    }, [editor, onImageUpload]);

    const promptInsert = (type: string, label: string) => {
        const url = window.prompt(label);
        if (url && url.trim()) insertEmbed(type, url.trim());
    };
    const insertLink = () => {
        const url = window.prompt('Link URL');
        if (url && url.trim()) editor?.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    };

    if (!editor) return null;

    return (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden', background: colors.background }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, padding: 6, borderBottom: `1px solid ${colors.border}`, background: colors.surface, position: 'sticky', top: 0, zIndex: 5 }}>
                <Btn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></Btn>
                <Btn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></Btn>
                <Btn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></Btn>
                <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></Btn>
                <Sep />
                <Btn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
                <Btn title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Btn>
                <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></Btn>
                <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
                <Btn title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} /></Btn>
                <Btn title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code size={16} /></Btn>
                <Btn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={16} /></Btn>
                <Sep />
                <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
                <Btn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
                <Btn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
                <Sep />
                <Btn title="Link" active={editor.isActive('link')} onClick={insertLink}><LinkIcon size={16} /></Btn>
                <Btn title="Upload image" onClick={() => imageInputRef.current?.click()}><ImageIcon size={16} /></Btn>
                <Btn title="Video (YouTube URL)" onClick={() => promptInsert('video', 'YouTube / video URL')}><Youtube size={16} /></Btn>
                <Btn title="Track embed" onClick={() => promptInsert('track', 'Track URL (e.g. /track/artist/song)')}><Music size={16} /></Btn>
                <Btn title="Playlist embed" onClick={() => promptInsert('playlist', 'Playlist URL or ID')}><ListMusic size={16} /></Btn>
                <Btn title="Profile embed" onClick={() => promptInsert('profile', 'Profile URL (e.g. /profile/username)')}><User size={16} /></Btn>
                <Btn title="Social post" onClick={() => promptInsert('social', 'Twitter/X or Instagram URL')}><Twitter size={16} /></Btn>
                <Btn title="Upload audio" onClick={() => audioInputRef.current?.click()}><FileAudio size={16} /></Btn>
                <Btn title="Upload project file" onClick={() => projectInputRef.current?.click()}><FolderDown size={16} /></Btn>
                <Btn title="Upload preset" onClick={() => presetInputRef.current?.click()}><Sliders size={16} /></Btn>
                <Sep />
                <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></Btn>
                <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></Btn>
            </div>

            <EditorContent editor={editor} className="article-rich-editor" />

            {/* Hidden file inputs */}
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) doImageUpload(f); e.target.value = ''; }} />
            <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) doFileUpload(f, 'audio'); e.target.value = ''; }} />
            <input ref={projectInputRef} type="file" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) doFileUpload(f, 'project'); e.target.value = ''; }} />
            <input ref={presetInputRef} type="file" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) doFileUpload(f, 'preset'); e.target.value = ''; }} />

            <style>{`
                .article-rich-editor .ProseMirror { min-height: 300px; padding: 16px 18px; outline: none; color: ${colors.textPrimary}; font-size: 15px; line-height: 1.7; }
                .article-rich-editor .ProseMirror:focus { outline: none; }
                .article-rich-editor .ProseMirror p { margin: 0 0 12px; }
                .article-rich-editor .ProseMirror h2 { font-size: 22px; font-weight: 800; margin: 20px 0 10px; }
                .article-rich-editor .ProseMirror h3 { font-size: 18px; font-weight: 700; margin: 18px 0 8px; }
                .article-rich-editor .ProseMirror ul, .article-rich-editor .ProseMirror ol { padding-left: 24px; margin: 0 0 12px; }
                .article-rich-editor .ProseMirror blockquote { border-left: 3px solid ${colors.primary}; padding-left: 14px; color: ${colors.textSecondary}; margin: 12px 0; }
                .article-rich-editor .ProseMirror pre { background: ${colors.surface}; border-radius: 8px; padding: 12px 14px; overflow-x: auto; }
                .article-rich-editor .ProseMirror hr { border: none; border-top: 1px solid ${colors.border}; margin: 20px 0; }
                .article-rich-editor .ProseMirror img { max-width: 100%; border-radius: 8px; }
                .article-rich-editor .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: ${colors.textTertiary}; pointer-events: none; height: 0; }
            `}</style>
        </div>
    );
};

export default ArticleEditorRich;
