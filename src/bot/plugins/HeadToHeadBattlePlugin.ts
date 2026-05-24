import {
    Client,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

/**
 * 1v1 Head-to-Head Producer Battle Plugin
 *
 * Provides a Discord-side surface for the website-driven head-to-head
 * matchmaking system. The full lifecycle (matchmaking, ready-up, sample
 * distribution, voting, Elo updates, forfeits) is run by the API ticker
 * in src/api/index.ts under the runHeadToHeadLifecycle() function so it
 * shares process state with HTTP handlers.
 */
export class HeadToHeadBattlePlugin implements IPlugin {
    readonly id = 'head-to-head';
    readonly name = 'Head-to-Head Battles';
    readonly version = '1.0.0';
    readonly description = '1v1 producer battles with genre matchmaking, sample packs, peer voting and Elo ranking.';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = true;

    readonly requiredPermissions = [];
    readonly commands = ['h2h'];
    readonly events = ['interactionCreate'];
    readonly dashboardSections = ['head-to-head'];

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
        announcementChannelId: z.string().optional(),
    });

    private db!: PrismaClient;
    private client!: Client;
    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.db = context.db;
        this.client = context.client;
        this.logger = context.logger;
        this.logger.info('Head-to-Head Battle Plugin initialized');
    }

    async shutdown(): Promise<void> {
        this.logger?.info('Head-to-Head Battle Plugin shutting down');
    }

    async registerCommands() {
        const cmd = new SlashCommandBuilder()
            .setName('h2h')
            .setDescription('Head-to-Head 1v1 producer battles')
            .addSubcommand(s => s.setName('info').setDescription('How head-to-head battles work'))
            .addSubcommand(s => s.setName('leaderboard').setDescription('View the global head-to-head leaderboard'))
            .addSubcommand(s => s.setName('me').setDescription('View your head-to-head stats and current match'));
        return [cmd];
    }

    async onInteractionCreate(interaction: any): Promise<void> {
        if (!interaction.isChatInputCommand?.()) return;
        if (interaction.commandName !== 'h2h') return;

        const sub = interaction.options.getSubcommand();
        try {
            if (sub === 'info') return this.handleInfo(interaction);
            if (sub === 'leaderboard') return this.handleLeaderboard(interaction);
            if (sub === 'me') return this.handleMe(interaction);
        } catch (err) {
            this.logger?.error('Head-to-Head command failed', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }

    private getApiUrl(): string {
        return process.env.API_URL || 'https://fujistud.io';
    }

    private async handleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
        const apiUrl = this.getApiUrl();
        const embed = new EmbedBuilder()
            .setColor(0xF97316)
            .setTitle('1v1 Head-to-Head Battles')
            .setDescription([
                'Queue up for a real-time 1v1 producer battle:',
                '',
                '**1.** Pick a production length and join the global queue.',
                '**2.** Get matched with the next available producer.',
                '**3.** Both players hit *Ready Up* — the timer starts.',
                '**4.** Curated samples are auto-distributed from the pool.',
                '**5.** Submit your track before the deadline.',
                '**6.** Other active competitors vote on your match (peer-reviewed).',
                '**7.** Win/loss updates your Elo and the genre + global leaderboard.',
                '',
                `**[Open the Arena →](${apiUrl}/h2h)**`,
            ].join('\n'))
            .setFooter({ text: 'Fuji Studio • Head-to-Head' });
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    private async handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
        const top = await this.db.h2HRating.findMany({
            where: { genreId: null },
            orderBy: { elo: 'desc' },
            take: 10,
        });
        if (!top.length) {
            await interaction.reply({ content: 'No matches have been played yet — be the first!', flags: MessageFlags.Ephemeral });
            return;
        }
        const lines = top.map((r, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
            return `${medal} <@${r.userId}> — **${r.elo}** Elo · ${r.wins}W ${r.losses}L`;
        });
        const embed = new EmbedBuilder()
            .setColor(0xF97316)
            .setTitle('Head-to-Head Global Leaderboard')
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Top ${top.length} producers • ${this.getApiUrl()}/h2h` });
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    private async handleMe(interaction: ChatInputCommandInteraction): Promise<void> {
        const userId = interaction.user.id;
        const [globalRating, activeMatch, recentMatches] = await Promise.all([
            this.db.h2HRating.findFirst({ where: { userId, genreId: null } }),
            this.db.h2HMatch.findFirst({
                where: {
                    OR: [{ challengerId: userId }, { opponentId: userId }],
                    status: { in: ['queued', 'ready_check', 'producing', 'voting'] },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.db.h2HMatch.findMany({
                where: {
                    OR: [{ challengerId: userId }, { opponentId: userId }],
                    status: { in: ['completed', 'forfeited'] },
                },
                orderBy: { updatedAt: 'desc' },
                take: 5,
            }),
        ]);

        const elo = globalRating?.elo ?? 1200;
        const wins = globalRating?.wins ?? 0;
        const losses = globalRating?.losses ?? 0;

        const lines: string[] = [
            `**Elo:** ${elo}`,
            `**Record:** ${wins}W · ${losses}L`,
        ];
        if (activeMatch) {
            const phase = activeMatch.status.toUpperCase().replace('_', ' ');
            lines.push('', `**Active match:** \`${phase}\` ([open](${this.getApiUrl()}/h2h/match/${activeMatch.id}))`);
        } else {
            lines.push('', `*No active match.* [Join the queue →](${this.getApiUrl()}/h2h)`);
        }
        if (recentMatches.length) {
            lines.push('', '**Recent matches:**');
            for (const m of recentMatches) {
                const won = m.winnerId === userId;
                const result = m.status === 'forfeited' ? (won ? 'Forfeit Win' : 'Forfeit Loss') : (won ? 'Win' : 'Loss');
                lines.push(`• ${result}`);
            }
        }
        const embed = new EmbedBuilder()
            .setColor(0xF97316)
            .setTitle(`${interaction.user.username} • Head-to-Head`)
            .setDescription(lines.join('\n'));
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
