import {
    Client,
    PermissionFlagsBits,
    EmbedBuilder,
    TextChannel,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    Colors,
    MessageFlags,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export class AcademyPlugin implements IPlugin {
    readonly id = 'academy';
    readonly name = 'Academy';
    readonly version = '1.0.0';
    readonly description = 'Interactive FL Studio learning with a simulated DAW environment';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [PermissionFlagsBits.SendMessages];
    readonly commands = ['academy'];
    readonly events = ['interactionCreate'];
    readonly dashboardSections = ['academy'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
        announcementChannelId: z.string().optional(),
        completionRoleId: z.string().optional(),
        reputationReward: z.number().default(10),
    });

    private client!: Client;
    private db!: PrismaClient;
    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.logger.info('Academy Plugin initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('Academy Plugin shutting down');
    }

    // --- Command Registration ---
    getSlashCommands(): SlashCommandBuilder[] {
        const cmd = new SlashCommandBuilder()
            .setName('academy')
            .setDescription('View your FL Studio Academy progress');

        cmd.addSubcommand(sub =>
            sub.setName('progress')
                .setDescription('View your lesson progress'));

        cmd.addSubcommand(sub =>
            sub.setName('leaderboard')
                .setDescription('See the top Academy learners'));

        return [cmd];
    }

    // --- Interaction Handler ---
    async onInteractionCreate(interaction: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'academy') return;

        const sub = interaction.options.getSubcommand();
        switch (sub) {
            case 'progress':
                return this.handleProgress(interaction);
            case 'leaderboard':
                return this.handleLeaderboard(interaction);
        }
    }

    private async handleProgress(interaction: ChatInputCommandInteraction): Promise<void> {
        const userId = interaction.user.id;

        const progress = await this.db.academyProgress.findMany({
            where: { userId },
            include: { lesson: { select: { title: true, category: true, difficulty: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 10,
        });

        const completed = progress.filter(p => p.completed).length;
        const totalScore = progress.reduce((sum, p) => sum + p.score, 0);

        const embed = new EmbedBuilder()
            .setTitle('Your Academy Progress')
            .setColor(Colors.Green)
            .setDescription(
                completed === 0
                    ? 'You haven\'t completed any lessons yet. Visit the Academy on the website to get started!'
                    : `You've completed **${completed}** lesson${completed === 1 ? '' : 's'} and earned **${totalScore}** points.`
            );

        if (progress.length > 0) {
            const lines = progress.slice(0, 10).map(p => {
                const status = p.completed ? '✅' : `Step ${p.currentStep}`;
                return `${status} **${p.lesson.title}** (${p.lesson.category})`;
            });
            embed.addFields({ name: 'Recent Lessons', value: lines.join('\n') });
        }

        embed.setFooter({ text: 'fujistud.io/academy' });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    private async handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
        // Aggregate top users by total score across all lessons
        const top = await this.db.academyProgress.groupBy({
            by: ['userId'],
            _sum: { score: true },
            _count: { id: true },
            where: { completed: true },
            orderBy: { _sum: { score: 'desc' } },
            take: 10,
        });

        if (top.length === 0) {
            await interaction.reply({ content: 'No one has completed any Academy lessons yet. Be the first!', flags: MessageFlags.Ephemeral });
            return;
        }

        const lines = await Promise.all(top.map(async (row, i) => {
            const place = i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : `#${i + 1}`;
            const score = row._sum.score ?? 0;
            const count = row._count.id;
            return `${place} <@${row.userId}> - ${score} pts (${count} lesson${count === 1 ? '' : 's'})`;
        }));

        const embed = new EmbedBuilder()
            .setTitle('Academy Leaderboard')
            .setColor(Colors.Gold)
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'fujistud.io/academy' });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
