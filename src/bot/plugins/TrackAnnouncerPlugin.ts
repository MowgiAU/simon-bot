import {
    Client,
    EmbedBuilder,
    TextChannel,
    PermissionResolvable,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const EMBED_COLOR = 0x2b8c71; // Fuji Studio green

export class TrackAnnouncerPlugin implements IPlugin {
    readonly id = 'track-announcer';
    readonly name = 'Track Announcer';
    readonly version = '1.0.0';
    readonly description = 'Posts a rich Discord embed when a new track is uploaded to the Fuji Studio platform.';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = true;

    readonly requiredPermissions: PermissionResolvable[] = [];
    readonly commands: string[] = [];
    readonly events: string[] = [];
    readonly dashboardSections = ['track-announcer'];

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
        channelId: z.string().optional(),
    });

    private db!: PrismaClient;
    private client!: Client;
    private logger: any;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private siteBase = process.env.DASHBOARD_ORIGIN?.replace(/\/$/, '') || 'https://fujistud.io';

    async initialize(context: IPluginContext): Promise<void> {
        this.db = context.db;
        this.client = context.client;
        this.logger = context.logger;
        this.logger.info('Track Announcer Plugin initialized');

        // Poll for pending announcements written by the API process
        this.pollTimer = setInterval(() => this.processPending(), POLL_INTERVAL_MS);
        // Also run shortly after boot so the first announcement isn't delayed
        setTimeout(() => this.processPending(), 10_000);
    }

    async shutdown(): Promise<void> {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    // ─── Poll & dispatch ───────────────────────────────────────────────────────

    private async processPending(): Promise<void> {
        try {
            const pending = await this.db.trackAnnouncement.findMany({
                where: { postedAt: null },
                orderBy: { createdAt: 'asc' },
                take: 20,
            });

            for (const ann of pending) {
                // Mark as posted immediately to avoid double-posting on slow runs
                await this.db.trackAnnouncement.update({
                    where: { id: ann.id },
                    data: { postedAt: new Date() },
                });

                await this.postAnnouncement(ann).catch(err =>
                    this.logger.warn(`[TrackAnnouncer] Failed to post announcement ${ann.id}: ${err.message}`)
                );
            }
        } catch (err: any) {
            this.logger.warn(`[TrackAnnouncer] processPending error: ${err.message}`);
        }
    }

    private async postAnnouncement(ann: {
        guildId: string;
        trackId: string;
        trackTitle: string;
        artistName: string;
        profileUsername: string;
        trackSlug: string | null;
        coverUrl: string | null;
        genres: string[];
    }): Promise<void> {
        // Look up the per-guild config
        const settings = await this.db.trackAnnouncerSettings.findUnique({
            where: { guildId: ann.guildId },
        });

        if (!settings?.enabled || !settings?.channelId) return;

        const channel = this.client.channels.cache.get(settings.channelId) as TextChannel | undefined;
        if (!channel || !channel.isTextBased()) {
            this.logger.warn(`[TrackAnnouncer] Channel ${settings.channelId} not found or not text-based for guild ${ann.guildId}`);
            return;
        }

        // Build track URL — prefer slug, fall back to trackId
        const trackPath = ann.trackSlug
            ? `/music/${ann.profileUsername}/${ann.trackSlug}`
            : `/music/${ann.profileUsername}/${ann.trackId}`;
        const trackUrl = `${this.siteBase}${trackPath}`;
        const artistUrl = `${this.siteBase}/profile/${ann.profileUsername}`;

        // Resolve cover URL — may be relative or CDN absolute
        let thumbnailUrl: string | null = null;
        if (ann.coverUrl) {
            thumbnailUrl = ann.coverUrl.startsWith('http')
                ? ann.coverUrl
                : `${this.siteBase}${ann.coverUrl}`;
        }

        const genreText = ann.genres.length > 0 ? ann.genres.join(' · ') : null;

        // Build a rich description
        const descParts: string[] = [];
        descParts.push(`🎵 **[${ann.artistName}](${artistUrl})** just dropped a new track!`);
        if (genreText) descParts.push(`🎧 ${genreText}`);
        descParts.push(`\n**[▶ Listen Now on Fuji Studio](${trackUrl})**`);

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setAuthor({
                name: '🔔 New Track Drop',
            })
            .setTitle(ann.trackTitle)
            .setURL(trackUrl)
            .setDescription(descParts.join('\n'))
            .setFooter({ text: `Fuji Studio • ${ann.artistName}` })
            .setTimestamp();

        if (thumbnailUrl) {
            embed.setImage(thumbnailUrl);
        }

        await channel.send({ embeds: [embed] });
        this.logger.info(`[TrackAnnouncer] Posted track "${ann.trackTitle}" by ${ann.artistName} to channel ${settings.channelId}`);
    }
}
