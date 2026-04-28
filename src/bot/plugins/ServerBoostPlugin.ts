import {
    TextChannel,
    EmbedBuilder,
    PermissionFlagsBits,
    Message,
    MessageType,
    GuildMember,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class ServerBoostPlugin implements IPlugin {
    readonly id = 'server-boost';
    readonly name = 'Server Boost';
    readonly version = '1.0.0';
    readonly description = 'Celebrates server boosts with configurable messages, embeds, reactions and role rewards.';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ManageRoles,
    ];

    readonly commands: string[] = [];
    readonly events = ['messageCreate', 'guildMemberUpdate'];
    readonly dashboardSections = ['server-boost'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({});

    private context!: IPluginContext;
    private logger = new Logger('ServerBoostPlugin');

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.logger.info('Server Boost Plugin initialized');
    }

    async shutdown(): Promise<void> {}

    // ─── messageCreate: catch Discord system boost messages (type 8) ─────────────
    async onMessage(message: Message): Promise<void> {
        if (message.type !== MessageType.GuildBoost) return;
        if (!message.guild) return;

        const guildId = message.guild.id;
        const settings = await this.getSettings(guildId);
        if (!settings?.enabled) return;

        // Add reaction to the boost notification if configured
        if (settings.reactionEmoji) {
            try {
                await message.react(settings.reactionEmoji);
            } catch { /* emoji may be invalid — silently ignore */ }
        }

        // Post announcement
        if (settings.announcementChannelId) {
            await this.sendAnnouncement(guildId, message.author.id, settings, message.guild.premiumSubscriptionCount ?? 0);
        }

        // Award role
        if (settings.rewardRoleId) {
            try {
                const member = message.member as GuildMember | null;
                if (member && !member.roles.cache.has(settings.rewardRoleId)) {
                    await member.roles.add(settings.rewardRoleId, 'Server Boost reward');
                }
            } catch (e) {
                this.logger.error(`Failed to add boost reward role: ${e}`);
            }
        }
    }

    // ─── guildMemberUpdate: remove reward role when boost ends ────────────────────
    async onGuildMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
        const lostBoost = oldMember.premiumSince !== null && newMember.premiumSince === null;
        if (!lostBoost) return;

        const guildId = newMember.guild.id;
        const settings = await this.getSettings(guildId);
        if (!settings?.enabled || !settings.rewardRoleId) return;

        try {
            if (newMember.roles.cache.has(settings.rewardRoleId)) {
                await newMember.roles.remove(settings.rewardRoleId, 'Boost expired');
            }
        } catch (e) {
            this.logger.error(`Failed to remove boost reward role: ${e}`);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private async getSettings(guildId: string) {
        try {
            return await this.context.db.serverBoostSettings.findUnique({ where: { guildId } });
        } catch { return null; }
    }

    private resolvePlaceholders(text: string, userId: string, boostCount: number): string {
        return text
            .replace(/\{mention\}/gi, `<@${userId}>`)
            .replace(/\{user\}/gi, `<@${userId}>`)
            .replace(/\{boostCount\}/gi, String(boostCount));
    }

    private async sendAnnouncement(
        guildId: string, userId: string,
        settings: any, boostCount: number
    ): Promise<void> {
        try {
            const channel = await this.context.client.channels.fetch(settings.announcementChannelId);
            if (!channel?.isTextBased()) return;

            const resolve = (t: string) => this.resolvePlaceholders(t, userId, boostCount);

            // Text content
            const content = settings.messageText ? resolve(settings.messageText) : undefined;

            // Optional embed
            let embed: EmbedBuilder | undefined;
            if (settings.embedJson) {
                try {
                    const raw = JSON.parse(settings.embedJson);
                    embed = new EmbedBuilder();
                    if (raw.title)       embed.setTitle(resolve(raw.title));
                    if (raw.description) embed.setDescription(resolve(raw.description));
                    if (raw.color)       embed.setColor(raw.color as any);
                    if (raw.thumbnailUrl) embed.setThumbnail(raw.thumbnailUrl);
                    if (raw.imageUrl)    embed.setImage(raw.imageUrl);
                    if (raw.authorName)  embed.setAuthor({ name: resolve(raw.authorName), iconURL: raw.authorIconUrl || undefined, url: raw.authorUrl || undefined });
                    if (raw.footerText)  embed.setFooter({ text: resolve(raw.footerText), iconURL: raw.footerIconUrl || undefined });
                    if (raw.timestamp)   embed.setTimestamp();
                    if (raw.url)         embed.setURL(raw.url);
                    if (Array.isArray(raw.fields)) {
                        for (const f of raw.fields) {
                            if (f.name && f.value) embed.addFields({ name: resolve(f.name), value: resolve(f.value), inline: !!f.inline });
                        }
                    }
                } catch { embed = undefined; }
            }

            const payload: any = {};
            if (content) payload.content = content;
            if (embed) payload.embeds = [embed];
            if (!payload.content && !payload.embeds) return;

            await (channel as TextChannel).send(payload);
        } catch (e) {
            this.logger.error(`Failed to send boost announcement: ${e}`);
        }
    }
}
