import { 
    Client, 
    ChatInputCommandInteraction, 
    GuildMember, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    TextChannel,
    Colors
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export class ModerationPlugin implements IPlugin {
    readonly id = 'moderation';
    readonly name = 'Moderation System';
    readonly version = '1.0.0';
    readonly description = 'Comprehensive moderation tools with logging';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ManageMessages
    ];

    readonly commands = ['kick', 'ban', 'timeout', 'warn', 'purge', 'modlog'];
    readonly events = ['interactionCreate'];
    readonly dashboardSections = ['moderation'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
        logChannel: z.string().optional(),
    });

    private client!: Client;
    private db!: PrismaClient;
    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.logger.info('Moderation Plugin initialized');
        
        // Ensure settings exist for all guilds
        // We do this in a non-blocking way
        this.initializeSettings();
    }

    private async initializeSettings() {
        const guilds = this.client.guilds.cache;
        for (const [id] of guilds) {
            try {
                const exists = await this.db.moderationSettings.findUnique({ where: { guildId: id } });
                if (!exists) {
                    await this.db.moderationSettings.create({
                        data: { guildId: id }
                    });
                }
            } catch (e) {
                this.logger.error(`Failed to init mod settings for ${id}`, e);
            }
        }
    }

    async shutdown(): Promise<void> {}

    // Event Handler
    async onInteractionCreate(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        // Route commands
        switch (interaction.commandName) {
            case 'kick': await this.handleKick(interaction); break;
            case 'ban': await this.handleBan(interaction); break;
            case 'timeout': await this.handleTimeout(interaction); break;
            case 'purge': await this.handlePurge(interaction); break;
        }
    }

    // --- Commands ---

    private async handleKick(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getMember('user') as GuildMember;
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        if (!target) {
            return interaction.reply({ content: 'User not found.', ephemeral: true });
        }

        // Basic self-check permissions
        if (!target.kickable) {
            return interaction.reply({ content: 'I cannot kick this user (missing permissions or target has higher role).', ephemeral: true });
        }

        try {
            await target.kick(reason);
            
            // Log & Reply
            await this.logAction(interaction.guildId!, 'kick', interaction.user.id, target.id, { reason });
            
            await interaction.reply({ 
                content: `👢 **${target.user.tag}** was kicked. Reason: ${reason}`,
                ephemeral: false 
            });

        } catch (error) {
            this.logger.error('Kick failed', error);
            await interaction.reply({ content: 'Kick failed due to an error.', ephemeral: true });
        }
    }

    private async handleBan(interaction: ChatInputCommandInteraction) {
         const target = interaction.options.getMember('user') as GuildMember;
         const reason = interaction.options.getString('reason') || 'No reason provided';
         
         if (!target) return interaction.reply({ content: 'User not found', ephemeral: true });
         if (!target.bannable) return interaction.reply({ content: 'Cannot ban user.', ephemeral: true });

         try {
             await target.ban({ reason });
             await this.logAction(interaction.guildId!, 'ban', interaction.user.id, target.id, { reason });
             await interaction.reply({ content: `🔨 **${target.user.tag}** was banned. Reason: ${reason}` });
         } catch (e) {
             this.logger.error('Ban failed', e);
             await interaction.reply({ content: 'Ban failed.', ephemeral: true });
         }
    }

    private async handleTimeout(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getMember('user') as GuildMember;
        const durationMinutes = interaction.options.getInteger('duration') || 5;
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) return interaction.reply({ content: 'User not found', ephemeral: true });
        if (!target.moderatable) return interaction.reply({ content: 'Cannot timeout user.', ephemeral: true });

        try {
            await target.timeout(durationMinutes * 60 * 1000, reason);
            await this.logAction(interaction.guildId!, 'timeout', interaction.user.id, target.id, { reason, duration: `${durationMinutes}m` });
            await interaction.reply({ content: `⏳ **${target.user.tag}** timed out for ${durationMinutes} minutes.`, ephemeral: false });
        } catch (e) {
            this.logger.error('Timeout failed', e);
            await interaction.reply({ content: 'Timeout failed.', ephemeral: true });
        }
    }

    private async handlePurge(interaction: ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount');
        if (!amount || amount < 1 || amount > 100) {
            return interaction.reply({ content: 'Amount must be between 1 and 100.', ephemeral: true });
        }

        const channel = interaction.channel as TextChannel;
        if (!channel) return;

        try {
            const deleted = await channel.bulkDelete(amount, true);
            await this.logAction(interaction.guildId!, 'purge', interaction.user.id, channel.id, { amount: deleted.size, channel: channel.name });
            
            await interaction.reply({ content: `Deleted ${deleted.size} messages.`, ephemeral: true });
        } catch (e) {
            this.logger.error('Purge failed', e);
            await interaction.reply({ content: 'Failed to delete messages. Messages older than 14 days cannot be bulk deleted.', ephemeral: true });
        }
    }

    // --- Helpers ---

    private async logAction(guildId: string, action: string, executorId: string, targetId: string, details: any) {
        // 1. DB Log
        try {
            await this.db.actionLog.create({
                data: {
                    guildId,
                    pluginId: 'moderation',
                    action,
                    executorId,
                    targetId,
                    details,
                    searchableText: `${action} ${targetId}`
                }
            });

            // 2. Channel Log
            const settings = await this.db.moderationSettings.findUnique({ where: { guildId }});
            if (settings?.logChannelId) {
                const channel = this.client.channels.cache.get(settings.logChannelId) as TextChannel;
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle(`Moderation: ${action.toUpperCase()}`)
                        .setColor(Colors.Red)
                        .addFields(
                            { name: 'Executor', value: `<@${executorId}>`, inline: true },
                            { name: 'Target', value: `<@${targetId}>`, inline: true },
                            { name: 'Reason', value: details.reason || 'None' }
                        )
                        .setTimestamp();
                    
                    if (details.duration) embed.addFields({ name: 'Duration', value: details.duration, inline: true });
                    if (details.amount) embed.addFields({ name: 'Amount', value: String(details.amount), inline: true });

                    channel.send({ embeds: [embed] }).catch(() => {});
                }
            }
        } catch(e) {
            this.logger.error('Failed to log action', e);
        }
    }
}
