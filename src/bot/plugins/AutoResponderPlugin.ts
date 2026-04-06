import {
    Message,
    TextChannel,
    PermissionResolvable,
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

    requiredPermissions: PermissionResolvable[] = ['SendMessages', 'ViewChannel'];
    commands: string[] = [];
    events: string[] = ['messageCreate'];
    dashboardSections = ['auto-responder'];
    readonly defaultEnabled = true;

    configSchema = z.object({});

    private context: IPluginContext | null = null;
    private logger = new Logger('AutoResponderPlugin');
    // Per-rule cooldown tracker (ruleId -> last triggered timestamp)
    private cooldowns = new Map<string, number>();

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        context.client.on('messageCreate', (msg) => this.onMessage(msg));
        this.logger.info('Auto Responder Plugin initialized');
    }

    async shutdown(): Promise<void> {
        this.cooldowns.clear();
    }

    private async onMessage(msg: Message): Promise<void> {
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
                    case 'regex':
                        match = msg.content.match(new RegExp(rule.trigger, 'i'));
                        break;
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

            // Build response with placeholders
            let response = rule.response;
            response = response
                .replace(/\{user\}/gi, `<@${msg.author.id}>`)
                .replace(/\{username\}/gi, msg.author.username)
                .replace(/\{displayname\}/gi, msg.member?.displayName || msg.author.username)
                .replace(/\{channel\}/gi, `<#${msg.channel.id}>`)
                .replace(/\{server\}/gi, msg.guild.name);

            // Replace regex capture groups {match1}, {match2}, ...
            if (match && match.length > 1) {
                for (let i = 1; i < match.length && i <= 9; i++) {
                    response = response.replace(new RegExp(`\\{match${i}\\}`, 'gi'), match[i] || '');
                }
            }

            try {
                await (msg.channel as TextChannel).send(response);

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
