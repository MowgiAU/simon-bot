import { Message, TextChannel, ChannelType, PermissionFlagsBits, Webhook } from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class EchoPlugin implements IPlugin {
    id = 'echo';
    name = 'Message Echo';
    description = 'Randomly picks a recent message and re-posts it in the same channel after a delay';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions = [PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];
    commands = [];
    events = ['messageCreate'];
    dashboardSections = ['echo'];
    defaultEnabled = true;

    configSchema = z.object({
        enabled: z.boolean().default(false),
    });

    private context: IPluginContext | null = null;
    private logger: Logger;

    constructor() {
        this.logger = new Logger('EchoPlugin');
    }

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
    }

    async shutdown(): Promise<void> {}

    async onMessageCreate(message: Message): Promise<void> {
        if (!this.context || message.author.bot || !message.guild) return;
        if (message.channel.type !== ChannelType.GuildText) return;
        if (!message.content.trim()) return;

        const settings = await this.getSettings(message.guildId!);
        if (!settings?.enabled) return;

        // Channel filter — if channelIds is set, only those channels
        if (settings.channelIds.length > 0 && !settings.channelIds.includes(message.channelId)) return;

        // Blacklist / whitelist user filter
        if (settings.blacklistUserIds.includes(message.author.id)) return;
        if (settings.whitelistUserIds.length > 0 && !settings.whitelistUserIds.includes(message.author.id)) return;

        // Trigger chance roll
        const roll = Math.random() * 100;
        if (roll >= settings.triggerChance) return;

        // Pick a random recent message from the same channel (excluding bots)
        const channel = message.channel as TextChannel;
        let candidates: Message[];
        try {
            const fetched = await channel.messages.fetch({ limit: Math.min(settings.lookbackMessages, 100) });
            candidates = [...fetched.values()].filter(m =>
                !m.author.bot &&
                m.content.trim().length > 0 &&
                m.id !== message.id &&
                !settings.blacklistUserIds.includes(m.author.id) &&
                (settings.whitelistUserIds.length === 0 || settings.whitelistUserIds.includes(m.author.id))
            );
        } catch {
            return;
        }

        if (candidates.length === 0) return;

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        // Delay
        const delayMs = (settings.minDelaySeconds + Math.random() * (settings.maxDelaySeconds - settings.minDelaySeconds)) * 1000;

        setTimeout(async () => {
            try {
                // Re-read settings at fire time so changes during the delay window take effect
                const liveSettings = await this.getSettings(message.guildId!);
                if (!liveSettings?.enabled) return;
                if (liveSettings.impersonateUser) {
                    await this.sendViaWebhook(channel, target);
                } else {
                    await channel.send(target.content);
                }
                this.logger.info(`Echoed message from ${target.author.username} in #${channel.name}`);
            } catch (e) {
                this.logger.error('Failed to send echo', e);
            }
        }, delayMs);
    }

    private async sendViaWebhook(channel: TextChannel, source: Message): Promise<void> {
        const webhooks = await channel.fetchWebhooks();
        let webhook: Webhook | undefined = webhooks.find(w => w.name === 'Fuji-Echo');
        if (!webhook) {
            webhook = await channel.createWebhook({ name: 'Fuji-Echo' });
        }

        const member = channel.guild.members.cache.get(source.author.id);
        const displayName = member?.nickname || source.author.displayName || source.author.username;
        const avatarUrl = source.author.displayAvatarURL({ extension: 'png' });

        await webhook.send({
            content: source.content,
            username: displayName,
            avatarURL: avatarUrl,
            allowedMentions: { parse: [] }, // suppress accidental pings
        });
    }

    private async getSettings(guildId: string) {
        return this.context?.db.echoSettings.findUnique({ where: { guildId } });
    }
}
