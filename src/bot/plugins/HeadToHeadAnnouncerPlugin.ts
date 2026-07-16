import {
    Client,
    EmbedBuilder,
    TextChannel,
    PermissionResolvable,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { sendPushToUsersIfEnabled } from '../../services/PushService.js';

const POLL_INTERVAL_MS  = 30_000;
const EMBED_COLOR_QUEUE  = 0x3b82f6; // blue  — looking for opponent
const EMBED_COLOR_VOTE   = 0xf97316; // orange — voting open
const EMBED_COLOR_WINNER = 0xfbbf24; // gold   — winner
const H2H_GUILD_ID = 'default-guild';
// Only announce queue after 2 minutes so instant matches don't get announced
const QUEUE_ANNOUNCE_DELAY_MS = 2 * 60 * 1000;

export class HeadToHeadAnnouncerPlugin implements IPlugin {
    readonly id = 'head-to-head-announcer';
    readonly name = 'Head-to-Head Announcer';
    readonly version = '1.0.0';
    readonly description = 'Posts Discord announcements when a 1v1 battle opens for voting and when a winner is decided.';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = true;

    readonly requiredPermissions: PermissionResolvable[] = [];
    readonly commands: string[] = [];
    readonly events: string[] = [];
    readonly dashboardSections: string[] = [];

    readonly configSchema = z.object({});

    private db!: PrismaClient;
    private client!: Client;
    private logger: any;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private siteBase = process.env.DASHBOARD_ORIGIN?.replace(/\/$/, '') || 'https://fujistud.io';

    async initialize(context: IPluginContext): Promise<void> {
        this.db = context.db;
        this.client = context.client;
        this.logger = context.logger;
        this.logger.info('Head-to-Head Announcer Plugin initialized');

        this.pollTimer = setInterval(() => this.processPending(), POLL_INTERVAL_MS);
        setTimeout(() => this.processPending(), 10_000);
    }

    async shutdown(): Promise<void> {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    // ─── Poll ──────────────────────────────────────────────────────────────────

    private async processPending(): Promise<void> {
        try {
            const settings = await (this.db as any).headToHeadSettings.findUnique({
                where: { guildId: H2H_GUILD_ID },
            });
            if (!settings?.enabled || !settings?.announcementChannelId) return;

            const channel = this.client.channels.cache.get(settings.announcementChannelId) as TextChannel | undefined;
            if (!channel?.isTextBased()) return;

            if (settings.announceQueueEnabled !== false) await this.announceQueueWaiting(channel);
            await this.announceVotingOpen(channel);
            await this.announceWinners(channel);
        } catch (err: any) {
            this.logger.warn(`[H2HAnnouncer] processPending error: ${err.message}`);
        }
    }

    // ─── Queue waiting ─────────────────────────────────────────────────────────

    private async announceQueueWaiting(channel: TextChannel): Promise<void> {
        const cutoff = new Date(Date.now() - QUEUE_ANNOUNCE_DELAY_MS);
        const matches = await (this.db as any).h2HMatch.findMany({
            where: { status: 'queued', opponentId: null, queueAnnouncedAt: null, createdAt: { lte: cutoff } },
            orderBy: { createdAt: 'asc' },
            take: 5,
        });

        for (const match of matches) {
            await (this.db as any).h2HMatch.update({
                where: { id: match.id },
                data: { queueAnnouncedAt: new Date() },
            });
            await this.postQueueAnnouncement(channel, match).catch((err: any) =>
                this.logger.warn(`[H2HAnnouncer] Failed to post queue announcement for match ${match.id}: ${err.message}`)
            );
            await this.pingWaitingOpponents(match).catch((err: any) =>
                this.logger.warn(`[H2HAnnouncer] Failed to push queue ping for match ${match.id}: ${err.message}`)
            );
        }
    }

    // Push-notify producers who have battled before that someone's waiting in the lobby.
    // Throttled to once per queued row (gated by queueAnnouncedAt above) + capped fan-out.
    private async pingWaitingOpponents(match: any): Promise<void> {
        const ratings = await (this.db as any).h2HRating.findMany({
            where: { genreId: null, matchesPlayed: { gt: 0 }, userId: { not: match.challengerId } },
            orderBy: { updatedAt: 'desc' },
            take: 40,
            select: { userId: true },
        });
        const userIds = ratings.map((r: any) => r.userId);
        if (!userIds.length) return;
        await sendPushToUsersIfEnabled(this.db as any, userIds, 'h2hUpdates', {
            title: "Someone's waiting in the Arena",
            body: 'A producer is looking for a 1v1 — jump in and battle.',
            url: '/preview/alt_f_arena',
            channelId: 'battles',
        });
    }

    private async postQueueAnnouncement(channel: TextChannel, match: any): Promise<void> {
        const genre = match.genreId ? await this.getGenreName(match.genreId) : null;
        const arenaUrl = `${this.siteBase}/arena`;

        const desc = [
            `⚔️ A producer is in the queue and looking for an opponent!`,
            genre ? `🎧 Genre: **${genre}**` : null,
            `Jump in the arena to accept the challenge.`,
            '',
            `**[🏟️ Join the Arena](${arenaUrl})**`,
        ].filter(Boolean).join('\n');

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR_QUEUE)
            .setAuthor({ name: '🔍 1v1 Arena — Looking for Opponent' })
            .setTitle('Someone wants to battle')
            .setURL(arenaUrl)
            .setDescription(desc)
            .setFooter({ text: 'Fuji Studio Arena' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        this.logger.info(`[H2HAnnouncer] Posted queue announcement for match ${match.id}`);
    }

    // ─── Voting open ───────────────────────────────────────────────────────────

    private async announceVotingOpen(channel: TextChannel): Promise<void> {
        const matches = await (this.db as any).h2HMatch.findMany({
            where: { status: 'voting', votingAnnouncedAt: null },
            orderBy: { votingStart: 'asc' },
            take: 10,
        });

        for (const match of matches) {
            // Mark immediately to prevent double-posting
            await (this.db as any).h2HMatch.update({
                where: { id: match.id },
                data: { votingAnnouncedAt: new Date() },
            });

            await this.postVotingAnnouncement(channel, match).catch((err: any) =>
                this.logger.warn(`[H2HAnnouncer] Failed to post voting announcement for match ${match.id}: ${err.message}`)
            );
        }
    }

    private async postVotingAnnouncement(channel: TextChannel, match: any): Promise<void> {
        const genre = match.genreId ? await this.getGenreName(match.genreId) : null;
        const arenaUrl = `${this.siteBase}/arena#vote`;
        const deadline = match.votingEnd ? `<t:${Math.floor(new Date(match.votingEnd).getTime() / 1000)}:R>` : null;

        const desc = [
            `⚔️ Two anonymous producers have gone head-to-head!`,
            genre ? `🎧 Genre: **${genre}**` : null,
            deadline ? `⏰ Voting closes ${deadline}` : null,
            '',
            `**[🗳️ Listen & Vote on Fuji Studio](${arenaUrl})**`,
        ].filter(Boolean).join('\n');

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR_VOTE)
            .setAuthor({ name: '🎤 1v1 Battle — Ready to Judge!' })
            .setTitle('Two tracks are ready for your vote')
            .setURL(arenaUrl)
            .setDescription(desc)
            .setFooter({ text: 'Fuji Studio Arena' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        this.logger.info(`[H2HAnnouncer] Posted voting announcement for match ${match.id}`);
    }

    // ─── Winner ────────────────────────────────────────────────────────────────

    private async announceWinners(channel: TextChannel): Promise<void> {
        const matches = await (this.db as any).h2HMatch.findMany({
            where: { status: 'completed', winnerId: { not: null }, winnerAnnouncedAt: null },
            orderBy: { updatedAt: 'asc' },
            take: 10,
        });

        for (const match of matches) {
            await (this.db as any).h2HMatch.update({
                where: { id: match.id },
                data: { winnerAnnouncedAt: new Date() },
            });

            await this.postWinnerAnnouncement(channel, match).catch((err: any) =>
                this.logger.warn(`[H2HAnnouncer] Failed to post winner announcement for match ${match.id}: ${err.message}`)
            );
        }
    }

    private async postWinnerAnnouncement(channel: TextChannel, match: any): Promise<void> {
        const genre = match.genreId ? await this.getGenreName(match.genreId) : null;
        const arenaUrl = `${this.siteBase}/arena`;

        const descParts = [
            `🏆 The votes are in — a winner has been decided!`,
            genre ? `🎧 Genre: **${genre}**` : null,
            '',
            `**[🏟️ See the Results on Fuji Studio](${arenaUrl})**`,
        ].filter(Boolean).join('\n');

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR_WINNER)
            .setAuthor({ name: '🏆 1v1 Battle — Winner Decided!' })
            .setTitle('A 1v1 battle has concluded')
            .setURL(arenaUrl)
            .setDescription(descParts)
            .setFooter({ text: 'Fuji Studio Arena' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        this.logger.info(`[H2HAnnouncer] Posted winner announcement for match ${match.id}`);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private async getProfile(userId: string): Promise<{ userId: string; username: string; displayName: string | null; avatar: string | null } | null> {
        try {
            return await (this.db as any).musicianProfile.findUnique({
                where: { userId },
                select: { userId: true, username: true, displayName: true, avatar: true },
            });
        } catch {
            return null;
        }
    }

    private async getGenreName(genreId: string): Promise<string | null> {
        try {
            const genre = await (this.db as any).genre.findUnique({ where: { id: genreId }, select: { name: true } });
            return genre?.name ?? null;
        } catch {
            return null;
        }
    }
}
