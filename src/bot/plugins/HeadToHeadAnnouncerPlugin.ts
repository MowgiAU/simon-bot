import {
    Client,
    EmbedBuilder,
    TextChannel,
    PermissionResolvable,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const POLL_INTERVAL_MS = 30_000;
const EMBED_COLOR_VOTE   = 0xf97316; // orange — voting open
const EMBED_COLOR_WINNER = 0xfbbf24; // gold   — winner
const H2H_GUILD_ID = 'default-guild';

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

            await this.announceVotingOpen(channel);
            await this.announceWinners(channel);
        } catch (err: any) {
            this.logger.warn(`[H2HAnnouncer] processPending error: ${err.message}`);
        }
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
        const [challenger, opponent, genre] = await Promise.all([
            this.getProfile(match.challengerId),
            match.opponentId ? this.getProfile(match.opponentId) : null,
            match.genreId ? this.getGenreName(match.genreId) : null,
        ]);

        const arenaUrl = `${this.siteBase}/arena#vote`;
        const challengerName = challenger?.displayName || challenger?.username || `<@${match.challengerId}>`;
        const opponentName   = opponent?.displayName   || opponent?.username   || (match.opponentId ? `<@${match.opponentId}>` : 'TBD');

        const challengerLink = challenger ? `[${challengerName}](${this.siteBase}/profile/${challenger.username})` : challengerName;
        const opponentLink   = opponent   ? `[${opponentName}](${this.siteBase}/profile/${opponent.username})`   : opponentName;

        const deadline = match.votingEnd ? `<t:${Math.floor(new Date(match.votingEnd).getTime() / 1000)}:R>` : null;

        const desc = [
            `⚔️ **${challengerLink}** vs **${opponentLink}**`,
            genre ? `🎧 Genre: **${genre}**` : null,
            deadline ? `⏰ Voting closes ${deadline}` : null,
            '',
            `**[🗳️ Cast Your Vote on Fuji Studio](${arenaUrl})**`,
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
        const [winner, loser, genre] = await Promise.all([
            this.getProfile(match.winnerId),
            match.loserId ? this.getProfile(match.loserId) : null,
            match.genreId ? this.getGenreName(match.genreId) : null,
        ]);

        const arenaUrl = `${this.siteBase}/arena`;

        const winnerName = winner?.displayName || winner?.username || `<@${match.winnerId}>`;
        const loserName  = loser?.displayName  || loser?.username  || (match.loserId ? `<@${match.loserId}>` : null);

        const winnerLink = winner ? `[${winnerName}](${this.siteBase}/profile/${winner.username})` : winnerName;
        const loserLink  = loser  ? `[${loserName}](${this.siteBase}/profile/${loser.username})`  : loserName;

        // Elo delta for winner
        const winnerEloDelta = (match.challengerId === match.winnerId)
            ? (match.challengerEloAfter != null && match.challengerEloBefore != null ? match.challengerEloAfter - match.challengerEloBefore : null)
            : (match.opponentEloAfter  != null && match.opponentEloBefore  != null ? match.opponentEloAfter  - match.opponentEloBefore  : null);

        const eloText = winnerEloDelta != null ? ` (+${winnerEloDelta} Elo)` : '';

        const descParts = [
            `🏆 **${winnerLink}** wins!${eloText}`,
            loserLink ? `vs ${loserLink}` : null,
            genre ? `🎧 Genre: **${genre}**` : null,
            '',
            `**[🏟️ View on Fuji Studio Arena](${arenaUrl})**`,
        ].filter(Boolean).join('\n');

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR_WINNER)
            .setAuthor({ name: '🏆 1v1 Battle — Winner Decided!' })
            .setTitle(winnerName)
            .setURL(arenaUrl)
            .setDescription(descParts)
            .setFooter({ text: 'Fuji Studio Arena' })
            .setTimestamp();

        if (winner?.avatar) {
            const avatarUrl = `https://cdn.discordapp.com/avatars/${winner.userId}/${winner.avatar}.png`;
            embed.setThumbnail(avatarUrl);
        }

        await channel.send({ embeds: [embed] });
        this.logger.info(`[H2HAnnouncer] Posted winner announcement for match ${match.id} — winner: ${winnerName}`);
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
