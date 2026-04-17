import {
    Message,
    TextChannel,
    EmbedBuilder,
    PermissionResolvable,
    Guild,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

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
    events: string[] = ['messageCreate'];
    dashboardSections = ['auto-responder'];
    readonly defaultEnabled = true;

    configSchema = z.object({});

    private context: IPluginContext | null = null;
    private logger = new Logger('AutoResponderPlugin');
    // Per-rule cooldown tracker (ruleId -> last triggered timestamp)
    private cooldowns = new Map<string, number>();
    // Global per-user cooldown tracker (guildId:userId -> last triggered timestamp)
    private userCooldowns = new Map<string, number>();

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
        this.logger.info('Auto Responder Plugin initialized');
    }

    async shutdown(): Promise<void> {
        this.cooldowns.clear();
        this.userCooldowns.clear();
    }

    // Called by the plugin manager dispatcher (bot/index.ts → p.onMessage)
    async onMessage(msg: Message): Promise<void> {
        // Ignore bots and DMs
        if (msg.author.bot || !msg.guild || !msg.content) return;
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

        // Build a lookup map for categories
        const categoryMap = new Map<string, any>(categories.map((c: any) => [c.id, c]));

        const channelId = msg.channel.id;
        let textResponseSent = false; // only the first matching rule sends a text/embed reply

        // Evaluate global per-user cooldown ONCE before the loop so that rules firing
        // within this message don't cascade-block each other.
        const userKey = `${guildId}:${msg.author.id}`;
        const globalCooldownBlocked = globalCooldownSeconds > 0 &&
            (Date.now() - (this.userCooldowns.get(userKey) || 0)) < globalCooldownSeconds * 1000;
        let globalCooldownUpdated = false;

        for (const rule of rules) {
            // Resolve effective settings — category overrides per-rule when assigned
            const cat = rule.categoryId ? categoryMap.get(rule.categoryId) : null;
            const effectiveAllowedChannels = cat ? cat.allowedChannels : rule.allowedChannels;
            const effectiveIgnoredChannels  = cat ? cat.ignoredChannels  : rule.ignoredChannels;
            const effectiveCooldownSeconds  = cat ? cat.cooldownSeconds  : rule.cooldownSeconds;
            const effectiveCooldownReactionEmoji = cat ? cat.cooldownReactionEmoji : rule.cooldownReactionEmoji;

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

            // Pattern matching (must happen before cooldown check)
            let match: RegExpMatchArray | null = null;
            try {
                switch (rule.triggerType) {
                    case 'regex': {
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
            // When cooldown comes from a category, use the category ID as the key so that
            // ANY rule in the category firing puts the entire category on cooldown.
            const cooldownKey = cat ? cat.id : rule.id;
            if (effectiveCooldownSeconds > 0) {
                const lastFired = this.cooldowns.get(cooldownKey) || 0;
                if (Date.now() - lastFired < effectiveCooldownSeconds * 1000) {
                    // Still react normally even on cooldown
                    if (rule.reactionEmoji) {
                        try {
                            const resolved = this.resolveEmoji(rule.reactionEmoji, msg.guild!);
                            if (resolved) await msg.react(resolved);
                        } catch { /* ignore */ }
                    }
                    // Also react with the cooldown-specific emoji if set
                    if (effectiveCooldownReactionEmoji) {
                        try {
                            const resolved = this.resolveEmoji(effectiveCooldownReactionEmoji, msg.guild!);
                            if (resolved) await msg.react(resolved);
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
                    .replace(/\{username\}/gi, msg.author.username)
                    .replace(/\{displayname\}/gi, msg.member?.displayName || msg.author.username)
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
                            name: resolvePlaceholders(f.name || '\u200b'),
                            value: resolvePlaceholders(f.value || '\u200b'),
                            inline: !!f.inline,
                        })));
                    }
                    if (Array.isArray(raw.links) && raw.links.length > 0) {
                        const validLinks = raw.links.filter((l: any) => l.title && l.url);
                        if (validLinks.length > 0) {
                            e.addFields({
                                name: '🔗 Links',
                                value: validLinks.map((l: any) => {
                                    const desc = l.description ? `\n  ${resolvePlaceholders(l.description)}` : '';
                                    return `• [${resolvePlaceholders(l.title)}](${l.url})${desc}`;
                                }).join('\n'),
                                inline: false,
                            });
                        }
                    }
                    if (Array.isArray(raw.linkCategories) && raw.linkCategories.length > 0) {
                        for (const cat of raw.linkCategories) {
                            if (!cat.category || !Array.isArray(cat.links)) continue;
                            const validLinks = cat.links.filter((l: any) => l.title && l.url);
                            if (validLinks.length === 0) continue;
                            e.addFields({
                                name: `🔗 ${resolvePlaceholders(cat.category)}`,
                                value: validLinks.map((l: any) => {
                                    const desc = l.description ? `\n  ${resolvePlaceholders(l.description)}` : '';
                                    return `• [${resolvePlaceholders(l.title)}](${l.url})${desc}`;
                                }).join('\n'),
                                inline: false,
                            });
                        }
                    }
                    embed = e;
                } catch { /* skip malformed embed */ }
            }

            try {
                const sendPayload: any = {};
                if (content) sendPayload.content = content;
                if (embed) sendPayload.embeds = [embed];

                // React to the message if reactionEmoji is set
                if (rule.reactionEmoji) {
                    try {
                        const resolved = this.resolveEmoji(rule.reactionEmoji, msg.guild!);
                        if (resolved) await msg.react(resolved);
                    } catch (reactErr: any) {
                        this.logger.warn(`AutoResponder: failed to react with "${rule.reactionEmoji}": ${reactErr?.message}`);
                    }
                }

                // Send text/embed response if present (only once per message, not when global cooldown active)
                if (!textResponseSent && !globalCooldownBlocked && (sendPayload.content || sendPayload.embeds)) {
                    await (msg.channel as TextChannel).send(sendPayload);
                    textResponseSent = true;
                } else if (!rule.reactionEmoji && !(sendPayload.content || sendPayload.embeds)) {
                    // No reaction and no response — skip this rule entirely
                    continue;
                }

                // Update per-rule (or per-category) cooldown
                this.cooldowns.set(cooldownKey, Date.now());
                // Update global user cooldown once per message (first fired rule)
                if (globalCooldownSeconds > 0 && !globalCooldownBlocked && !globalCooldownUpdated) {
                    this.userCooldowns.set(userKey, Date.now());
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
