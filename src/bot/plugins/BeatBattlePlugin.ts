import {
    Client,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    TextChannel,
    MessageFlags,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export class BeatBattlePlugin implements IPlugin {
    readonly id = 'beat-battle';
    readonly name = 'Beat Battle';
    readonly version = '2.0.0';
    readonly description = 'Host beat battles on the website with Discord announcements, voting, sponsors, and archives.';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = true;

    readonly requiredPermissions = [];
    readonly commands = ['battle'];
    readonly events = ['interactionCreate'];
    readonly dashboardSections = ['beat-battle'];

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
        announcementChannelId: z.string().optional(),
    });

    private db!: PrismaClient;
    private client!: Client;
    private logger: any;
    private logAction!: (data: any) => Promise<void>;

    private async getGuildSettings(guildId: string) {
        return this.db.beatBattleSettings.findUnique({ where: { guildId } });
    }
    private lifecycleInterval: ReturnType<typeof setInterval> | null = null;

    async initialize(context: IPluginContext): Promise<void> {
        this.db = context.db;
        this.client = context.client;
        this.logger = context.logger;
        this.logAction = context.logAction;
        this.logger.info('Beat Battle Plugin initialized');

        // Start lifecycle check every 60 seconds
        this.lifecycleInterval = setInterval(() => this.checkLifecycles(), 60_000);
    }

    async shutdown(): Promise<void> {
        if (this.lifecycleInterval) clearInterval(this.lifecycleInterval);
        this.logger.info('Beat Battle Plugin shutting down');
    }

    // ----- Slash Command Registration -----

    async registerCommands() {
        const battleCommand = new SlashCommandBuilder()
            .setName('battle')
            .setDescription('Beat Battle commands')
            .addSubcommand(sub =>
                sub.setName('info').setDescription('View current beat battle info')
            )
            .addSubcommand(sub =>
                sub.setName('leaderboard').setDescription('View the leaderboard')
            );

        return [battleCommand];
    }

    async onInteractionCreate(interaction: any): Promise<void> {
        if (interaction.isChatInputCommand?.() && interaction.commandName === 'battle') {
            const sub = interaction.options.getSubcommand();
            if (sub === 'info') await this.handleInfo(interaction);
            else if (sub === 'leaderboard') await this.handleLeaderboard(interaction);
        }
    }

    // ----- /battle info -----

    private async handleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
        const battle = await this.db.beatBattle.findFirst({
            where: {
                guildId: interaction.guildId!,
                status: { in: ['active', 'voting', 'upcoming'] },
                deletedAt: null,
            },
            include: { sponsor: true, _count: { select: { entries: { where: { deletedAt: null } } } } },
            orderBy: { createdAt: 'desc' },
        });

        if (!battle) {
            await interaction.reply({ content: 'No active beat battle right now. Stay tuned!', flags: MessageFlags.Ephemeral });
            return;
        }

        const apiUrl = process.env.API_URL || 'https://fujistud.io';
        const statusLabel: Record<string, string> = { upcoming: '?? Upcoming', active: '?? Submissions Open', voting: '??? Voting Open', completed: '?? Completed' };

        const embed = new EmbedBuilder()
            .setTitle(`?? ${battle.title}`)
            .setDescription(battle.description || 'No description provided.')
            .setColor(0x2B8C71)
            .addFields(
                { name: 'Status', value: statusLabel[battle.status] || battle.status, inline: true },
                { name: 'Entries', value: `${battle._count.entries}`, inline: true },
                { name: '?? Website', value: `[View Battle](${apiUrl}/battles/${battle.id})` },
            )
            .setFooter({ text: 'Fuji Studio Beat Battle' })
            .setTimestamp();

        if (battle.submissionEnd) {
            embed.addFields({ name: 'Submissions Close', value: `<t:${Math.floor(battle.submissionEnd.getTime() / 1000)}:R>`, inline: true });
        }
        if (battle.votingEnd) {
            embed.addFields({ name: 'Voting Ends', value: `<t:${Math.floor(battle.votingEnd.getTime() / 1000)}:R>`, inline: true });
        }
        if (battle.rules) {
            embed.addFields({ name: '?? Rules', value: battle.rules });
        }
        if (battle.sponsor) {
            let sponsorText = `**${battle.sponsor.name}**`;
            if (battle.sponsor.websiteUrl) sponsorText += ` � [Website](${battle.sponsor.websiteUrl})`;
            embed.addFields({ name: '?? Sponsored by', value: sponsorText });
            if (battle.sponsor.logoUrl) embed.setThumbnail(battle.sponsor.logoUrl);
        }

        await interaction.reply({ embeds: [embed] });
    }

    // ----- /battle leaderboard -----

    private async handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
        const battle = await this.db.beatBattle.findFirst({
            where: {
                guildId: interaction.guildId!,
                status: { in: ['active', 'voting', 'completed'] },
                deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!battle) {
            await interaction.reply({ content: 'No entries to show yet.', flags: MessageFlags.Ephemeral });
            return;
        }

        const ranked = await this.computeRankedEntries(battle.id, 10);
        if (ranked.length === 0) {
            await interaction.reply({ content: 'No entries to show yet.', flags: MessageFlags.Ephemeral });
            return;
        }

        const lines = ranked.map((e, i) => {
            const medal = i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : `${i + 1}.`;
            return `${medal} **${e.trackTitle}** by <@${e.userId}> — **${e.points}** ${e.points === 1 ? 'pt' : 'pts'}`;
        });

        const embed = new EmbedBuilder()
            .setTitle(`${battle.title} - Leaderboard`)
            .setDescription(lines.join('\n'))
            .setColor(0x2B8C71)
            .setFooter({ text: 'Fuji Studio Beat Battle' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    /**
     * Compute battle entries ranked by total points awarded via ranked voting.
     * Rank 1 = 3 pts, rank 2 = 2 pts, rank 3 = 1 pt.
     * Tiebreakers: more 1st-place votes → more 2nd-place votes → earliest submission.
     */
    private async computeRankedEntries(battleId: string, take = 10): Promise<{
        id: string;
        userId: string;
        trackTitle: string;
        points: number;
        firstVotes: number;
        secondVotes: number;
        thirdVotes: number;
        createdAt: Date;
    }[]> {
        const entries = await this.db.battleEntry.findMany({
            where: { battleId, deletedAt: null },
            select: {
                id: true, userId: true, createdAt: true, trackTitle: true,
                track: { select: { title: true } },
                votes: { select: { rank: true } },
            },
            take: 500, // hard cap — prevents unbounded memory load for large battles
        });
        const scored = entries.map(e => {
            let first = 0, second = 0, third = 0;
            for (const v of e.votes) {
                if (v.rank === 1) first++;
                else if (v.rank === 2) second++;
                else if (v.rank === 3) third++;
            }
            return {
                id: e.id,
                userId: e.userId,
                trackTitle: e.track?.title || e.trackTitle || 'Untitled',
                points: first * 3 + second * 2 + third * 1,
                firstVotes: first,
                secondVotes: second,
                thirdVotes: third,
                createdAt: e.createdAt,
            };
        });
        scored.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.firstVotes !== a.firstVotes) return b.firstVotes - a.firstVotes;
            if (b.secondVotes !== a.secondVotes) return b.secondVotes - a.secondVotes;
            return a.createdAt.getTime() - b.createdAt.getTime();
        });
        return scored.slice(0, take);
    }

    // ----- Lifecycle Checks (Auto-transition) -----

    private async checkLifecycles(): Promise<void> {
        const now = new Date();
        try {
            // Pending manual announcements (set via dashboard button)
            const pendingAnn = await this.db.beatBattle.findMany({
                where: { pendingAnnouncement: true, deletedAt: null },
                include: { sponsor: { include: { links: true } } },
            });
            for (const battle of pendingAnn) {
                await this.postByStatus(battle);
                await this.db.beatBattle.update({ where: { id: battle.id }, data: { pendingAnnouncement: false } });
            }

            // Upcoming -> Active (submission period started)
            const toActivate = await this.db.beatBattle.findMany({
                where: { status: 'upcoming', submissionStart: { lte: now }, deletedAt: null },
                include: { sponsor: { include: { links: true } } },
            });
            for (const battle of toActivate) {
                await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'active' } });
                await this.postAnnouncement(battle);
                this.logger.info(`Beat Battle: Activated "${battle.title}"`);
            }

            // Active -> Voting (submission period ended)
            const toVoting = await this.db.beatBattle.findMany({
                where: { status: 'active', submissionEnd: { lte: now }, deletedAt: null },
            });
            for (const battle of toVoting) {
                await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'voting' } });
                await this.postVotingAnnouncement(battle);
                this.logger.info(`Beat Battle: Transitioned "${battle.title}" to voting`);
            }

            // Voting -> Completed (voting period ended)
            const toComplete = await this.db.beatBattle.findMany({
                where: { status: 'voting', votingEnd: { lte: now }, deletedAt: null },
            });
            for (const battle of toComplete) {
                const winners = await this.computeRankedEntries(battle.id, 3);
                const winner = winners[0];
                await this.db.beatBattle.update({
                    where: { id: battle.id },
                    data: { status: 'completed', winnerEntryId: winner?.id || null },
                });
                await this.postWinnerAnnouncement(battle, winners);
                await this.awardPrizes(battle, winners);
                this.logger.info(`Beat Battle: Completed "${battle.title}"`);
            }
        } catch (err) {
            this.logger.error('Beat Battle lifecycle check failed', err);
        }
    }

    // ----- Economy Prize Distribution -----

    private async awardPrizes(battle: { guildId: string; title: string; prizePoolEnabled: boolean; prizeFirst: number; prizeSecond: number; prizeThird: number }, topEntries: { userId: string }[]): Promise<void> {
        try {
            if (!battle.prizePoolEnabled) return;

            const prizes = [battle.prizeFirst, battle.prizeSecond, battle.prizeThird];
            const labels = ['1st place', '2nd place', '3rd place'];

            for (let i = 0; i < Math.min(topEntries.length, 3); i++) {
                const amount = prizes[i];
                if (!amount || amount <= 0) continue;

                const entry = topEntries[i];
                await this.db.economyAccount.upsert({
                    where: { guildId_userId: { guildId: battle.guildId, userId: entry.userId } },
                    update: {
                        balance: { increment: amount },
                        totalEarned: { increment: amount },
                    },
                    create: {
                        guildId: battle.guildId,
                        userId: entry.userId,
                        balance: amount,
                        totalEarned: amount,
                    },
                });

                await this.db.economyTransaction.create({
                    data: {
                        guildId: battle.guildId,
                        amount,
                        type: 'BATTLE_PRIZE',
                        reason: `${labels[i]} prize for "${battle.title}"`,
                        toUserId: entry.userId,
                    },
                });
                this.logger.info(`Beat Battle: Awarded ${amount} coins to ${entry.userId} (${labels[i]}) for "${battle.title}"`);
            }
        } catch (err) {
            this.logger.error('Beat Battle: Failed to award prizes', err);
        }
    }

    // ----- Announcement Helpers -----

    private async postByStatus(battle: any): Promise<void> {
        if (battle.status === 'upcoming' || battle.status === 'active') {
            await this.postAnnouncement(battle);
        } else if (battle.status === 'voting') {
            await this.postVotingAnnouncement(battle);
        } else if (battle.status === 'completed') {
            const winners = await this.computeRankedEntries(battle.id, 3);
            await this.postWinnerAnnouncement(battle, winners);
        }
    }

    async postAnnouncement(battle: any): Promise<string | null> {
        const settings = await this.getGuildSettings(battle.guildId);
        const annChannelId = battle.announcementChannelId || settings?.announcementChannelId;
        if (!annChannelId) return null;

        const apiUrl = process.env.API_URL || 'https://fujistud.io';

        try {
            const channel = await this.client.channels.fetch(annChannelId) as TextChannel | null;
            if (!channel) return null;

            const embed = new EmbedBuilder()
                .setTitle(`?? New Beat Battle: ${battle.title}`)
                .setDescription(battle.description || 'A new beat battle has been announced!')
                .setColor(0x2B8C71)
                .addFields({ name: '?? Submit & Vote', value: `[Enter on Fuji Studio](${apiUrl}/battles/${battle.id})` })
                .setFooter({ text: 'Fuji Studio Beat Battle' })
                .setTimestamp();

            if (battle.submissionStart) {
                embed.addFields({ name: '??? Submissions Open', value: `<t:${Math.floor(new Date(battle.submissionStart).getTime() / 1000)}:F>`, inline: true });
            }
            if (battle.submissionEnd) {
                embed.addFields({ name: '?? Submissions Close', value: `<t:${Math.floor(new Date(battle.submissionEnd).getTime() / 1000)}:F>`, inline: true });
            }
            if (battle.rules) {
                embed.addFields({ name: '?? Rules', value: battle.rules });
            }
            if (battle.sponsor) {
                let sponsorText = `**${battle.sponsor.name}**`;
                if (battle.sponsor.websiteUrl) sponsorText += ` � [Visit Website](${battle.sponsor.websiteUrl})`;
                embed.addFields({ name: '?? Sponsored by', value: sponsorText });
                if (battle.sponsor.logoUrl) embed.setThumbnail(battle.sponsor.logoUrl);
            }

            const msg = await channel.send({ embeds: [embed] });
            return msg.id;
        } catch (err) {
            this.logger.error('Beat Battle: Failed to post announcement', err);
            return null;
        }
    }

    private async postVotingAnnouncement(battle: any): Promise<void> {
        const settings = await this.getGuildSettings(battle.guildId);
        const annChannelId = battle.announcementChannelId || settings?.announcementChannelId;
        if (!annChannelId) return;

        const apiUrl = process.env.API_URL || 'https://fujistud.io';

        try {
            const channel = await this.client.channels.fetch(annChannelId) as TextChannel | null;
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle(`??? ${battle.title} � Voting is Now Open!`)
                .setDescription('Submissions are closed. Head to the website to listen and vote for your favourite beat!')
                .setColor(0xFFA500)
                .addFields({ name: '?? Vote Now', value: `[Vote on Fuji Studio](${apiUrl}/battles/${battle.id})` })
                .setTimestamp();
            if (battle.votingEnd) {
                embed.addFields({ name: 'Voting Ends', value: `<t:${Math.floor(battle.votingEnd.getTime() / 1000)}:R>` });
            }
            await channel.send({ embeds: [embed] });
        } catch (err) {
            this.logger.error('Beat Battle: Failed to post voting announcement', err);
        }
    }

    private async postWinnerAnnouncement(battle: any, winners: { id: string; userId: string; trackTitle: string; points: number }[]): Promise<void> {
        const settings = await this.getGuildSettings(battle.guildId);
        const annChannelId = battle.announcementChannelId || settings?.announcementChannelId;
        if (!annChannelId || !winners || winners.length === 0) return;

        const apiUrl = process.env.API_URL || 'https://fujistud.io';

        try {
            const channel = await this.client.channels.fetch(annChannelId) as TextChannel | null;
            if (!channel) return;

            const medals = ['🥇', '🥈', '🥉'];
            const podiumLines = winners.slice(0, 3).map((w, i) => {
                return `${medals[i] || '•'} <@${w.userId}> — **"${w.trackTitle}"** • **${w.points}** ${w.points === 1 ? 'pt' : 'pts'}`;
            });
            const winnerMentions = winners.slice(0, 3).map(w => `<@${w.userId}>`).join(' ');

            const embed = new EmbedBuilder()
                .setTitle(`${battle.title} — Winners!`)
                .setDescription(`Congratulations ${winnerMentions}!\n\n${podiumLines.join('\n')}`)
                .setColor(0xFFD700)
                .addFields({ name: 'Listen', value: `[Play on Fuji Studio](${apiUrl}/battles/${battle.id})` })
                .setFooter({ text: 'Fuji Studio Beat Battle' })
                .setTimestamp();
            // Tag all top-3 producers in the message body so they get a notification.
            await channel.send({ content: winnerMentions, embeds: [embed], allowedMentions: { users: winners.slice(0, 3).map(w => w.userId) } });
        } catch (err) {
            this.logger.error('Beat Battle: Failed to post winner spotlight', err);
        }
    }
}
