import { Client, Message, PermissionResolvable } from 'discord.js';
import { IPlugin, IPluginContext, IPluginRegistry } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { extractFromDiscordJsMessage, saveCapturedMessage } from '../../services/ChannelScraperService';

/**
 * Channel Scraper — captures every message posted in one configured channel for later export.
 *
 * This is the real-time half of the feature. Backfilling existing history is done directly by
 * the API process via raw Discord REST calls (see src/api/index.ts) rather than by this plugin
 * — the bot and API run as separate processes with no shared memory, and backfill needs no
 * bot-internal state, so there's no reason to route it through here. Both paths write through
 * the same shared ChannelScraperService so their save logic can't drift apart.
 *
 * Opt-in per guild (defaultEnabled = false) and further opt-in per channel (channelId must be
 * explicitly set) — this collects member-authored content, which is a deliberately higher bar
 * than this codebase's other plugins.
 */
export class ChannelScraperPlugin implements IPlugin {
    readonly id = 'channel-scraper';
    readonly name = 'Channel Scraper';
    readonly version = '1.0.0';
    readonly description = 'Captures messages in one configured channel for later export';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = false;

    readonly requiredPermissions: PermissionResolvable[] = [];

    readonly commands: string[] = [];
    readonly events = ['messageCreate'];
    readonly dashboardSections = ['channel-scraper'];

    readonly configSchema = z.object({
        enabled: z.boolean().default(false),
    });

    private client!: Client;
    private db!: PrismaClient;
    private logger: any;
    private plugins!: IPluginRegistry;
    private logAction!: IPluginContext['logAction'];

    // Per-guild configured channel, refreshed on a short TTL so a dashboard change takes
    // effect quickly without a DB round-trip on every single message.
    private settingsCache: Map<string, { channelId: string | null; loadedAt: number }> = new Map();
    private readonly SETTINGS_CACHE_TTL = 30 * 1000;

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.plugins = context.plugins;
        this.logAction = context.logAction;
        this.logger.info('[ChannelScraper] Plugin initialized');
    }

    async shutdown(): Promise<void> {
        this.settingsCache.clear();
    }

    private async getConfiguredChannelId(guildId: string): Promise<string | null> {
        const cached = this.settingsCache.get(guildId);
        if (cached && Date.now() - cached.loadedAt < this.SETTINGS_CACHE_TTL) return cached.channelId;

        const settings = await this.db.channelScraperSettings.findUnique({ where: { guildId } });
        const channelId = settings?.channelId || null;
        this.settingsCache.set(guildId, { channelId, loadedAt: Date.now() });
        return channelId;
    }

    async onMessageCreate(message: Message): Promise<void> {
        if (!message.guild || message.author.bot) return;

        const channelId = await this.getConfiguredChannelId(message.guild.id);
        if (!channelId || message.channel.id !== channelId) return;

        try {
            await saveCapturedMessage(this.db, extractFromDiscordJsMessage(message));
        } catch (err: any) {
            this.logger.error('[ChannelScraper] Failed to save message', err);
        }
    }
}
