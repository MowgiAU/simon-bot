import {
    SlashCommandBuilder,
    PermissionResolvable,
    PermissionFlagsBits,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

const ACTIONS: Record<string, { emoji: string; past: string }> = {
    ban:     { emoji: '🔨', past: 'banned' },
    timeout: { emoji: '⏰', past: 'timed out' },
    warn:    { emoji: '⚠️', past: 'warned' },
    kick:    { emoji: '👢', past: 'kicked' },
};

/**
 * Pause — a joke moderation command.
 * Sends a fake moderation message (ban/kick/timeout/warn) without
 * actually doing anything. Access restricted to configured roles.
 */
export class PausePlugin implements IPlugin {
    id = 'pause';
    name = 'Pause Command';
    description = 'Joke moderation command — sends fake ban/kick/timeout/warn messages.';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = ['SendMessages'];
    commands: string[] = ['pause'];
    events: string[] = ['interactionCreate'];
    dashboardSections = ['pause'];
    readonly defaultEnabled = true;

    configSchema = z.object({});

    private context: IPluginContext | null = null;
    private readonly logger = new Logger('PausePlugin');

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.logger.info('Pause Plugin initialized');
    }

    async shutdown(): Promise<void> {}

    async registerCommands() {
        const pause = new SlashCommandBuilder()
            .setName('pause')
            .setDescription('Fake-moderate a member (joke — no real action is taken)');

        for (const [action] of Object.entries(ACTIONS)) {
            pause.addSubcommand(sub =>
                sub.setName(action)
                    .setDescription(`Fake-${action} a member`)
                    .addUserOption(o =>
                        o.setName('user').setDescription('The member to fake-moderate').setRequired(true))
                    .addStringOption(o =>
                        o.setName('reason').setDescription('Reason').setRequired(false))
            );
        }

        return [pause];
    }

    async onInteractionCreate(interaction: any): Promise<void> {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'pause') return;
        if (!this.context) return;

        const { db } = this.context;
        const guildId = interaction.guildId;
        if (!guildId) return;

        // Role check
        const settings = await db.pauseSettings.findUnique({ where: { guildId } }).catch(() => null);
        const allowedRoleIds: string[] = settings?.allowedRoleIds ?? [];

        const member = interaction.member;
        const isAdmin = !!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
        const memberRoleIds: string[] = Array.isArray(member?.roles)
            ? (member.roles as string[])
            : [...((member?.roles as any)?.cache?.keys() ?? [])];

        const hasAccess = isAdmin || (allowedRoleIds.length > 0 && allowedRoleIds.some((id: string) => memberRoleIds.includes(id)));

        if (!hasAccess) {
            await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const action = ACTIONS[sub];

        if (!action || !target) return;

        await interaction.reply({
            content: `${action.emoji} **${target.username}** has been **${action.past}**.\n**Reason:** ${reason}`,
        });
    }
}
