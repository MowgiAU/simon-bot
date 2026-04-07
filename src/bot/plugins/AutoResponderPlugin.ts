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
    }

    // Called by the plugin manager dispatcher (bot/index.ts → p.onMessage)
    async onMessage(msg: Message): Promise<void> {
        // Ignore bots and DMs
        if (msg.author.bot || !msg.guild || !msg.content) return;
        if (!this.context) return;

        const { db } = this.context;
        const guildId = msg.guild.id;

        let rules: any[];
        try {
            rules = await db.autoResponderRule.findMany({
                where: { guildId, enabled: true },
            });
        } catch {
            return; // DB not ready
        }

        if (!rules.length) return;

        const channelId = msg.channel.id;

        for (const rule of rules) {
            // Channel filtering
            if (rule.allowedChannels) {
                try {
                    const allowed: string[] = JSON.parse(rule.allowedChannels);
                    if (allowed.length > 0 && !allowed.includes(channelId)) continue;
                } catch { /* ignore parse errors */ }
            }
            if (rule.ignoredChannels) {
                try {
                    const ignored: string[] = JSON.parse(rule.ignoredChannels);
                    if (ignored.includes(channelId)) continue;
                } catch { /* ignore parse errors */ }
            }

            // Cooldown check (in-memory for speed)
            if (rule.cooldownSeconds > 0) {
                const lastFired = this.cooldowns.get(rule.id) || 0;
                if (Date.now() - lastFired < rule.cooldownSeconds * 1000) continue;
            }

            // Pattern matching
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
                    case 'contains':
                        if (msg.content.toLowerCase().includes(rule.trigger.toLowerCase())) {
                            match = [msg.content];
                        }
                        break;
                    default:
                        continue;
                }
            } catch (err: any) {
                // Invalid regex - skip silently
                continue;
            }

            if (!match) continue;

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
                                value: validLinks.map((l: any) => `[${resolvePlaceholders(l.title)}](${l.url})`).join('\n'),
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

                // Send text/embed response if present
                if (sendPayload.content || sendPayload.embeds) {
                    await (msg.channel as TextChannel).send(sendPayload);
                } else if (!rule.reactionEmoji) {
                    // No reaction and no response — skip this rule entirely
                    continue;
                }

                // Update cooldown
                this.cooldowns.set(rule.id, Date.now());

                // Increment match count + update lastTriggeredAt (fire-and-forget)
                db.autoResponderRule.update({
                    where: { id: rule.id },
                    data: { matchCount: { increment: 1 }, lastTriggeredAt: new Date() },
                }).catch(() => {});
            } catch (err: any) {
                this.logger.warn(`AutoResponder: failed to send in ${channelId}: ${err?.message}`);
            }

            // Only fire the first matching rule per message
            break;
        }
    }
}
