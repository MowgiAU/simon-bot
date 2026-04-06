import {
    Client,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    GuildMember,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export class BoosterColorPlugin implements IPlugin {
    readonly id = 'booster-color';
    readonly name = 'Booster Colour Roles';
    readonly version = '1.0.0';
    readonly description = 'Lets server boosters pick an exclusive name colour role. Automatically removes it when they stop boosting.';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [PermissionFlagsBits.ManageRoles];
    readonly commands = ['booster'];
    readonly events = ['interactionCreate', 'guildMemberUpdate'];
    readonly dashboardSections = ['booster-color'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({});

    private client!: Client;
    private db!: PrismaClient;
    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.logger.info('Booster Colour Plugin initialized');
    }

    async shutdown(): Promise<void> {}

    async onInteractionCreate(interaction: ChatInputCommandInteraction | AutocompleteInteraction): Promise<void> {
        if ((interaction as AutocompleteInteraction).isAutocomplete?.()) {
            if ((interaction as AutocompleteInteraction).commandName === 'booster') {
                await this.handleAutocomplete(interaction as AutocompleteInteraction);
            }
            return;
        }

        if (!(interaction as ChatInputCommandInteraction).isChatInputCommand?.()) return;
        const cmd = interaction as ChatInputCommandInteraction;
        if (cmd.commandName === 'booster') {
            await this.handleColor(cmd);
        }
    }

    async onGuildMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
        const guildId = newMember.guild.id;

        // Native boost removal
        const lostBoost = oldMember.premiumSince !== null && newMember.premiumSince === null;

        // Custom booster role removal (if configured)
        let lostBoosterRole = false;
        try {
            const settings = await (this.db as any).boosterColorSettings.findUnique({ where: { guildId } });
            if (settings?.boosterRoleId) {
                lostBoosterRole =
                    oldMember.roles.cache.has(settings.boosterRoleId) &&
                    !newMember.roles.cache.has(settings.boosterRoleId);
            }

            if ((lostBoost || lostBoosterRole) && settings && settings.colorRoleIds.length > 0) {
                const toRemove = settings.colorRoleIds.filter((id: string) => newMember.roles.cache.has(id));
                if (toRemove.length > 0) {
                    await newMember.roles.remove(toRemove, 'Server boost ended');
                    this.logger.info(`Removed colour roles from ${newMember.user.tag} in ${newMember.guild.name} (boost ended)`);
                }
            }
        } catch (e) {
            this.logger.error('Failed to remove colour roles on boost end', e);
        }
    }

    private async getSettings(guildId: string) {
        return (this.db as any).boosterColorSettings.findUnique({ where: { guildId } });
    }

    private async isBooster(member: GuildMember, guildId: string): Promise<boolean> {
        if (member.premiumSince) return true;
        const settings = await this.getSettings(guildId);
        return settings?.boosterRoleId ? member.roles.cache.has(settings.boosterRoleId) : false;
    }

    private async handleAutocomplete(interaction: AutocompleteInteraction) {
        const guildId = interaction.guildId!;
        try {
            const settings = await this.getSettings(guildId);
            if (!settings || settings.colorRoleIds.length === 0) {
                return interaction.respond([]);
            }

            const choices = settings.colorRoleIds
                .map((id: string) => {
                    const role = interaction.guild?.roles.cache.get(id);
                    return role ? { name: role.name, value: id } : null;
                })
                .filter(Boolean) as { name: string; value: string }[];

            // Add "Remove colour" option
            choices.unshift({ name: '🚫 Remove my colour', value: 'none' });

            await interaction.respond(choices.slice(0, 25));
        } catch {
            await interaction.respond([]);
        }
    }

    private async handleColor(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        const guildId = interaction.guildId!;

        if (!(await this.isBooster(member, guildId))) {
            return interaction.reply({
                content: '⚠️ This command is only available to **server boosters**.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const settings = await this.getSettings(guildId);
        if (!settings || settings.colorRoleIds.length === 0) {
            return interaction.reply({
                content: '❌ No colour roles have been configured for this server yet.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const roleId = interaction.options.getString('role', true);
        const toRemove = settings.colorRoleIds.filter((id: string) => member.roles.cache.has(id));

        // Remove colour
        if (roleId === 'none') {
            if (toRemove.length > 0) await member.roles.remove(toRemove, 'Colour role removed by user');
            return interaction.reply({ content: '✅ Your colour role has been removed.', flags: MessageFlags.Ephemeral });
        }

        // Validate role is in configured list
        if (!settings.colorRoleIds.includes(roleId)) {
            return interaction.reply({ content: '❌ That is not a valid colour role.', flags: MessageFlags.Ephemeral });
        }

        // Swap roles
        const roleToRemove = toRemove.filter((id: string) => id !== roleId);
        if (roleToRemove.length > 0) await member.roles.remove(roleToRemove, 'Switching colour role');
        if (!member.roles.cache.has(roleId)) await member.roles.add(roleId, 'Booster colour role');

        const role = interaction.guild!.roles.cache.get(roleId);
        return interaction.reply({
            content: `✅ Your colour has been set to **${role?.name ?? roleId}**.`,
            flags: MessageFlags.Ephemeral,
        });
    }
}
