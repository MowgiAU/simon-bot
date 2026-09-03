import {
    Client,
    Message,
    TextChannel,
    EmbedBuilder,
    PermissionResolvable,
    Guild,
} from 'discord.js';
import { z } from 'zod';
import axios from 'axios';
import * as mm from 'music-metadata';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';
import { WordCensor } from '../../services/WordCensor.js';

/** Shared with AutoResponderPlugin.hasAudioAttachment and its duration probe, so the two
 *  can never drift apart on what counts as "an audio file". */
const AUDIO_EXT = /\.(mp3|wav|flac|ogg|oga|opus|m4a|aac|aiff?|wma|alac)$/i;

/**
 * YAGPDB-style auto-responder.  Matches incoming messages against
 * per-guild regex / exact / startsWith / contains rules and replies
 * with a configurable response.
 *
 * Placeholder support in responses:
 *   {user}        - @mention the author
 *   {username}    - plain username
 *   {displayname} - display name / nickname
 *   {channel}     - #channel mention
 *   {server}      - guild name
 *   {matchN}      - Nth regex capture group (1-indexed)
 */
export class AutoResponderPlugin implements IPlugin {
    id = 'auto-responder';
    name = 'Auto Responder';
    description = 'Regex-based auto-responder (YAGPDB-style custom commands).';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = ['SendMessages', 'ViewChannel', 'AddReactions'];
    commands: string[] = [];
    events: string[] = ['messageCreate', 'messageUpdate'];
    dashboardSections = ['auto-responder'];
    readonly defaultEnabled = true;

    configSchema = z.object({});

    private simonClient: Client | null;

    constructor(simonClient?: Client | null) {
        this.simonClient = simonClient ?? null;
    }

    private context: IPluginContext | null = null;
    private logger = new Logger('AutoResponderPlugin');
    private censor!: WordCensor;
    // Cooldown tracker. Keyed `guildId:categoryId` for a category cooldown (server-wide —
    // no user in the key, so it blocks every user once tripped) or `userId:ruleId` for a
    // standalone rule's own cooldown (per-user). -> expiry timestamp.
    private cooldowns = new Map<string, number>();
    // Global per-user cooldown tracker (guildId:userId -> expiry timestamp)
    private userCooldowns = new Map<string, number>();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Resolve an emoji string to something message.react() can use.
     * Handles:  Unicode chars (pass-through), custom emoji <:name:id> (pass-through),
     *           :flag_xx: → regional indicator unicode, :name: → guild custom emoji lookup.
     */
    private resolveEmoji(emojiStr: string, guild: Guild): string | null {
        const trimmed = emojiStr.trim();

        // Already a custom emoji format like <:name:123456> or <a:name:123456>
        if (/^<a?:\w+:\d+>$/.test(trimmed)) return trimmed;

        // Not wrapped in colons → assume unicode character, pass through
        if (!trimmed.startsWith(':') || !trimmed.endsWith(':') || trimmed.length < 3) return trimmed;

        const name = trimmed.slice(1, -1); // strip colons

        // Discord flag shortcodes: :flag_xx: → regional indicator symbols
        const flagMatch = name.match(/^flag_([a-z]{2})$/i);
        if (flagMatch) {
            const code = flagMatch[1].toUpperCase();
            return String.fromCodePoint(
                ...code.split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65),
            );
        }

        // Look up guild custom emoji by name
        const custom = guild.emojis.cache.find(e => e.name?.toLowerCase() === name.toLowerCase());
        if (custom) return custom.id;

        // Return as-is and let Discord API try
        return trimmed;
    }

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.censor = new WordCensor(context.db);
        this.logger.info('Auto Responder Plugin initialized');
    }

    async shutdown(): Promise<void> {
        this.cooldowns.clear();
        this.userCooldowns.clear();
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    }

    /**
     * True when the message carries at least one audio file.
     *
     * Discord's contentType is the reliable signal but it comes back null often enough
     * (older clients, some upload paths) that a filename-extension fallback is needed —
     * otherwise a plain .wav drop would silently fail to trigger. Extensions cover the
     * formats producers actually post; .flp and other project files are deliberately not
     * audio and are left out.
     */
    private hasAudioAttachment(msg: Message): boolean {
        return msg.attachments.some(a =>
            (a.contentType || '').toLowerCase().startsWith('audio/') || AUDIO_EXT.test(a.name || ''),
        );
    }

    // Called by the plugin manager dispatcher (bot/index.ts → p.onMessage).
    // isEdit is true when this came from messageUpdate (a genuine content edit — the
    // dispatcher already filters out Discord's non-edit update events via editedTimestamp).
    async onMessage(msg: Message, isEdit: boolean = false): Promise<void> {
        // Periodic cleanup of stale cooldown entries (every 5 minutes)
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(() => {
                const now = Date.now();
                // Entries store expiry timestamps — delete only truly expired ones
                for (const [key, expiresAt] of this.cooldowns) {
                    if (now > expiresAt) this.cooldowns.delete(key);
                }
                for (const [key, expiresAt] of this.userCooldowns) {
                    if (now > expiresAt) this.userCooldowns.delete(key);
                }
            }, 300_000);
        }

        // Ignore bots and DMs
        // Attachment-only posts (an audio file with no caption) have empty content, so the
        // old `!msg.content` bail dropped them before any rule could see them. They're allowed
        // through now; the matcher below still requires content for every text trigger type,
        // so no existing rule changes behaviour.
        if (msg.author.bot || !msg.guild) return;
        if (!msg.content && msg.attachments.size === 0) return;
        if (!this.context) return;

        const { db } = this.context;
        const guildId = msg.guild.id;

        let rules: any[];
        let categories: any[];
        let globalCooldownSeconds = 0;
        try {
            [rules, categories] = await Promise.all([
                db.autoResponderRule.findMany({ where: { guildId, enabled: true } }),
                db.autoResponderCategory.findMany({ where: { guildId } }),
            ]);
            const settings = await db.autoResponderSettings.findUnique({ where: { guildId } });
            globalCooldownSeconds = settings?.globalCooldownSeconds ?? 0;
        } catch {
            return; // DB not ready
        }

        if (!rules.length) return;

        // Pre-compute censored usernames (async, but constant for the entire message)
        const safeUsername = await this.censor.clean(guildId, msg.author.username);
        const safeDisplayName = await this.censor.clean(guildId, msg.member?.displayName || msg.author.username);

        // Build a lookup map for categories
        const categoryMap = new Map<string, any>(categories.map((c: any) => [c.id, c]));

        const channelId = msg.channel.id;
        // Lazily fetch the triggering message through the simon client (for reactions/sends as that bot)
        let simonMsgFetched = false;
        let simonMsg: Message | null = null;
        const getSimonMsg = async (): Promise<Message | null> => {
            if (!simonMsgFetched) {
                simonMsgFetched = true;
                if (this.simonClient) {
                    const simonChannel = this.simonClient.channels.cache.get(msg.channel.id) as TextChannel | null;
                    if (simonChannel) {
                        simonMsg = await simonChannel.messages.fetch(msg.id).catch(() => null);
                    }
                }
            }
            return simonMsg;
        };

        // Lazily probes the message's audio attachment for its duration — memoized so
        // multiple audioAttachment rules with a minDurationSeconds filter (or the same rule
        // matching more than one attachment) only download and parse the file once per
        // message, not once per rule. null means "couldn't determine" (no audio attachment,
        // download failed, or the file's metadata didn't include a duration) — callers treat
        // that as "doesn't qualify" rather than guessing, same as a malformed regex is
        // skipped rather than assumed to match.
        let audioDurationFetched = false;
        let audioDurationSecs: number | null = null;
        const getAudioDurationSecs = async (): Promise<number | null> => {
            if (!audioDurationFetched) {
                audioDurationFetched = true;
                const attachment = msg.attachments.find(a =>
                    (a.contentType || '').toLowerCase().startsWith('audio/') || AUDIO_EXT.test(a.name || ''),
                );
                if (attachment) {
                    try {
                        const resp = await axios.get(attachment.url, { responseType: 'arraybuffer', timeout: 15_000 });
                        const metadata = await mm.parseBuffer(Buffer.from(resp.data), attachment.contentType || undefined);
                        audioDurationSecs = metadata.format.duration ?? null;
                    } catch (err: any) {
                        this.logger.warn(`AutoResponder: failed to probe audio duration for ${attachment.name}: ${err?.message}`);
                    }
                }
            }
            return audioDurationSecs;
        };

        let textResponseSent = false; // only the first matching rule sends a text/embed reply

        // Evaluate global per-user cooldown ONCE before the loop so that rules firing
        // within this message don't cascade-block each other.
        const userKey = `${guildId}:${msg.author.id}`;
        const globalCooldownBlocked = globalCooldownSeconds > 0 &&
            Date.now() < (this.userCooldowns.get(userKey) || 0);
        let globalCooldownUpdated = false;

        for (const rule of rules) {
            // Resolve effective settings — category values take precedence when set
            const cat = rule.categoryId ? categoryMap.get(rule.categoryId) : null;
            // Channel/role filters: category fully overrides rule when category is assigned
            const effectiveAllowedChannels = cat ? cat.allowedChannels : rule.allowedChannels;
            const effectiveIgnoredChannels  = cat ? cat.ignoredChannels  : rule.ignoredChannels;
            const effectiveAllowedRoles = cat ? cat.allowedRoles : rule.allowedRoles;
            const effectiveIgnoredRoles = cat ? cat.ignoredRoles : rule.ignoredRoles;
            // Cooldown: category cooldown takes precedence only when it's explicitly set (> 0).
            // If the category has no cooldown (0/default), fall back to the rule's own cooldown.
            // This prevents a category's default-zero from silently wiping a rule-level cooldown.
            const effectiveCooldownSeconds =
                (cat?.cooldownSeconds ?? 0) > 0 ? cat!.cooldownSeconds : rule.cooldownSeconds;
            const effectiveCooldownReactionEmoji =
                (cat?.cooldownSeconds ?? 0) > 0 ? cat!.cooldownReactionEmoji : rule.cooldownReactionEmoji;

            // Channel filtering
            if (effectiveAllowedChannels) {
                try {
                    const allowed: string[] = JSON.parse(effectiveAllowedChannels);
                    if (allowed.length > 0 && !allowed.includes(channelId)) continue;
                } catch { /* ignore parse errors */ }
            }
            if (effectiveIgnoredChannels) {
                try {
                    const ignored: string[] = JSON.parse(effectiveIgnoredChannels);
                    if (ignored.includes(channelId)) continue;
                } catch { /* ignore parse errors */ }
            }

            // Role filtering. msg.member is the triggering user's GuildMember, which
            // messageCreate already provides for guild messages — no extra fetch needed.
            // A member with no roles simply can't match a non-empty allow-list, same as
            // the channel filter's behaviour above.
            if (effectiveAllowedRoles) {
                try {
                    const allowed: string[] = JSON.parse(effectiveAllowedRoles);
                    if (allowed.length > 0 && !msg.member?.roles.cache.hasAny(...allowed)) continue;
                } catch { /* ignore parse errors */ }
            }
            if (effectiveIgnoredRoles) {
                try {
                    const ignored: string[] = JSON.parse(effectiveIgnoredRoles);
                    if (ignored.length > 0 && msg.member?.roles.cache.hasAny(...ignored)) continue;
                } catch { /* ignore parse errors */ }
            }

            // Pattern matching (must happen before cooldown check).
            // Every trigger type except audioAttachment reads msg.content, and an
            // attachment-only post has none — skipping them here keeps a permissive existing
            // rule (say a `.*` regex) from suddenly firing on file uploads.
            if (!msg.content && rule.triggerType !== 'audioAttachment') continue;
            let match: RegExpMatchArray | null = null;
            try {
                switch (rule.triggerType) {
                    case 'audioAttachment': {
                        // Attachments are fixed when a message is posted — editing text can
                        // never add or remove one, so re-matching on an edit is never useful
                        // and would only reopen the door to the repeat-firing bug above.
                        if (isEdit) continue;
                        if (!this.hasAudioAttachment(msg)) break;
                        // `trigger` is an optional comma-separated extension whitelist
                        // ("wav, flac") for rules that should only fire on certain formats.
                        // Left blank, any audio file matches.
                        const wanted = (rule.trigger || '').split(',').map((t: string) =>
                            t.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
                        if (wanted.length) {
                            const ok = msg.attachments.some(a => {
                                const ext = (a.name || '').split('.').pop()?.toLowerCase() || '';
                                return wanted.includes(ext);
                            });
                            if (!ok) break;
                        }
                        // e.g. "only fire for clips at least 5 seconds long" — a short
                        // scrap/preview shouldn't trigger the same reaction as a full track.
                        if (rule.minDurationSeconds && rule.minDurationSeconds > 0) {
                            const durationSecs = await getAudioDurationSecs();
                            if (durationSecs == null || durationSecs < rule.minDurationSeconds) break;
                        }
                        match = [msg.content || ''];
                        break;
                    }
                    case 'regex': {
                        // An empty pattern compiles fine and matches EVERY message, so a rule
                        // left blank silently spams the whole server. Never intentional.
                        if (!rule.trigger?.trim()) continue;
                        // Strip inline flags (e.g. (?i)) — JS regex flags are applied separately
                        const pattern = rule.trigger.replace(/^\(\?[imsxUu-]+\)/g, '');
                        match = msg.content.match(new RegExp(pattern, 'i'));
                        break;
                    }
                    case 'exact':
                        if (msg.content.toLowerCase() === rule.trigger.toLowerCase()) {
                            match = [msg.content];
                        }
                        break;
                    case 'startsWith':
                        if (msg.content.toLowerCase().startsWith(rule.trigger.toLowerCase())) {
                            match = [msg.content];
                        }
                        break;
                    case 'contains': {
                        const terms = rule.trigger.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
                        if (terms.some((t: string) => msg.content.toLowerCase().includes(t))) {
                            match = [msg.content];
                        }
                        break;
                    }
                    case 'wholeWord': {
                        const terms = rule.trigger.split(',').map((t: string) => t.trim()).filter(Boolean);
                        if (terms.some((t: string) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(msg.content))) {
                            match = [msg.content];
                        }
                        break;
                    }
                    default:
                        continue;
                }
            } catch (err: any) {
                // Invalid regex - skip silently
                continue;
            }

            if (!match) continue;

            // Cooldown check (in-memory for speed) — only runs if message matched
            // A category cooldown is server-wide: the key has no user in it, so once ANY
            // user fires ANY rule in the category, that category is silent for everyone
            // until it expires. This is what makes a 600s category cooldown actually mean
            // "at most one reply from this category every 10 minutes" rather than "every
            // 10 minutes per person" — with a few dozen common-word rules in one category,
            // the per-user version let a busy server's worth of different people each fire
            // it independently, which read as the cooldown doing nothing.
            // A rule with no category keeps the old per-user behaviour, since nothing here
            // was reported as a problem for standalone rules and changing it wasn't asked for.
            const cooldownKey = cat ? `${guildId}:${cat.id}` : `${msg.author.id}:${rule.id}`;
            if (effectiveCooldownSeconds > 0) {
                const expiresAt = this.cooldowns.get(cooldownKey) || 0;
                if (Date.now() < expiresAt) {
                    // Still react normally even on cooldown
                    if (rule.reactionEmoji) {
                        try {
                            const resolved = this.resolveEmoji(rule.reactionEmoji, msg.guild!);
                            if (resolved) {
                                const sm = await getSimonMsg();
                                await (sm ?? msg).react(resolved);
                            }
                        } catch { /* ignore */ }
                    }
                    // Also react with the cooldown-specific emoji if set
                    if (effectiveCooldownReactionEmoji) {
                        try {
                            const resolved = this.resolveEmoji(effectiveCooldownReactionEmoji, msg.guild!);
                            if (resolved) {
                                const sm = await getSimonMsg();
                                await (sm ?? msg).react(resolved);
                            }
                        } catch { /* ignore */ }
                    }
                    continue; // skip text/embed response
                }
            }

            // Global per-user cooldown only suppresses text/embed — reactions always fire.
            // (Evaluated before the loop so a rule firing mid-loop can't block later rules.)

            // Helper: resolve placeholders in any string
            const resolvePlaceholders = (text: string): string => {
                let out = text
                    .replace(/\{user\}/gi, `<@${msg.author.id}>`)
                    .replace(/\{mention\}/gi, `<@${msg.author.id}>`)
                    .replace(/\{username\}/gi, safeUsername)
                    .replace(/\{displayname\}/gi, safeDisplayName)
                    .replace(/\{channel\}/gi, `<#${msg.channel.id}>`)
                    .replace(/\{server\}/gi, msg.guild!.name);
                if (match && match.length > 1) {
                    for (let i = 1; i < match.length && i <= 9; i++) {
                        out = out.replace(new RegExp(`\\{match${i}\\}`, 'gi'), match[i] || '');
                    }
                }
                return out;
            };

            // Build the message payload
            const mentionPrefix = rule.mentionUser ? `<@${msg.author.id}> ` : '';
            const responseText = rule.response ? resolvePlaceholders(rule.response) : '';
            const content = mentionPrefix + responseText || undefined;

            // Build embed if present
            let embed: EmbedBuilder | undefined;
            if (rule.embedJson) {
                try {
                    const raw = typeof rule.embedJson === 'string' ? JSON.parse(rule.embedJson) : rule.embedJson;
                    const e = new EmbedBuilder();
                    if (raw.title) e.setTitle(resolvePlaceholders(raw.title));
                    if (raw.description) e.setDescription(resolvePlaceholders(raw.description));
                    if (raw.url) e.setURL(raw.url);
                    if (raw.color) e.setColor(parseInt(String(raw.color).replace('#', ''), 16) as any);
                    if (raw.authorName) e.setAuthor({ name: resolvePlaceholders(raw.authorName), iconURL: raw.authorIconUrl || undefined, url: raw.authorUrl || undefined });
                    if (raw.footerText) e.setFooter({ text: resolvePlaceholders(raw.footerText), iconURL: raw.footerIconUrl || undefined });
                    if (raw.thumbnailUrl) e.setThumbnail(raw.thumbnailUrl);
                    if (raw.imageUrl) e.setImage(raw.imageUrl);
                    if (raw.timestamp) e.setTimestamp();
                    if (Array.isArray(raw.fields)) {
                        e.addFields(raw.fields.filter((f: any) => f.name || f.value).map((f: any) => ({
                            name: resolvePlaceholders(f.name || '\u200b').slice(0, 256),
                            value: resolvePlaceholders(f.value || '\u200b').slice(0, 1024),
                            inline: !!f.inline,
                        })));
                    }
                    // Helper to build link field value, splitting into multiple fields if >1024 chars
                    const addLinkFields = (fieldName: string, links: any[]) => {
                        let value = '';
                        for (const l of links) {
                            const desc = l.description ? `\n  ${resolvePlaceholders(l.description)}` : '';
                            const line = `• [${resolvePlaceholders(l.title)}](${l.url})${desc}\n`;
                            if (value.length + line.length > 1024) {
                                if (value) e.addFields({ name: fieldName, value: value.trimEnd(), inline: false });
                                value = line;
                                fieldName = `${fieldName} (cont.)`;
                            } else {
                                value += line;
                            }
                        }
                        if (value) e.addFields({ name: fieldName, value: value.trimEnd(), inline: false });
                    };
                    if (Array.isArray(raw.links) && raw.links.length > 0) {
                        const validLinks = raw.links.filter((l: any) => l.title && l.url);
                        if (validLinks.length > 0) addLinkFields('🔗 Links', validLinks);
                    }
                    if (Array.isArray(raw.linkCategories) && raw.linkCategories.length > 0) {
                        for (const linkCat of raw.linkCategories) {
                            if (!linkCat.category || !Array.isArray(linkCat.links)) continue;
                            const validLinks = linkCat.links.filter((l: any) => l.title && l.url);
                            if (validLinks.length === 0) continue;
                            addLinkFields(`🔗 ${resolvePlaceholders(linkCat.category)}`, validLinks);
                        }
                    }
                    embed = e;
                } catch (embedErr: any) {
                    this.logger.warn(`AutoResponder: failed to build embed for rule "${rule.name}": ${embedErr?.message}`);
                }
            }

            try {
                const sendPayload: any = {};
                if (content) sendPayload.content = content;
                if (embed) sendPayload.embeds = [embed];
                // Only restore the specific, admin-opted-in {user}/{mention}/mentionUser ping —
                // never anything else that might end up in rule.response.
                if (rule.mentionUser || /\{user\}|\{mention\}/i.test(rule.response || '')) {
                    sendPayload.allowedMentions = { users: [msg.author.id] };
                }

                // React to the message if reactionEmoji is set
                if (rule.reactionEmoji) {
                    try {
                        const resolved = this.resolveEmoji(rule.reactionEmoji, msg.guild!);
                        if (resolved) {
                            const sm = await getSimonMsg();
                            if (sm) {
                                try { await sm.react(resolved); } catch { await msg.react(resolved); }
                            } else {
                                await msg.react(resolved);
                            }
                        }
                    } catch (reactErr: any) {
                        this.logger.warn(`AutoResponder: failed to react with "${rule.reactionEmoji}": ${reactErr?.message}`);
                    }
                }

                // Send text/embed response if present (only once per message, not when global cooldown active)
                if (!textResponseSent && !globalCooldownBlocked && (sendPayload.content || sendPayload.embeds)) {
                    const sm = await getSimonMsg();
                    if (sm) {
                        try {
                            await (sm.channel as TextChannel).send(sendPayload);
                        } catch {
                            // Simon bot lacks permission in this channel — fall back to main bot
                            await (msg.channel as TextChannel).send(sendPayload);
                        }
                    } else {
                        await (msg.channel as TextChannel).send(sendPayload);
                    }
                    textResponseSent = true;
                } else if (!rule.reactionEmoji && !(sendPayload.content || sendPayload.embeds)) {
                    // No reaction and no response — skip this rule entirely
                    continue;
                }

                // Update per-rule (or per-category) cooldown — store expiry time
                if (effectiveCooldownSeconds > 0) {
                    this.cooldowns.set(cooldownKey, Date.now() + effectiveCooldownSeconds * 1000);
                }
                // Update global user cooldown once per message (first fired rule)
                if (globalCooldownSeconds > 0 && !globalCooldownBlocked && !globalCooldownUpdated) {
                    this.userCooldowns.set(userKey, Date.now() + globalCooldownSeconds * 1000);
                    globalCooldownUpdated = true;
                }

                // Increment match count + update lastTriggeredAt (fire-and-forget)
                db.autoResponderRule.update({
                    where: { id: rule.id },
                    data: { matchCount: { increment: 1 }, lastTriggeredAt: new Date() },
                }).catch(() => {});
            } catch (err: any) {
                this.logger.warn(`AutoResponder: failed to send in ${channelId}: ${err?.message}`);
            }
        }
    }
}
