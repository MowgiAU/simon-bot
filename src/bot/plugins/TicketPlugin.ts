import { 
    Client, 
    ChatInputCommandInteraction, 
    GuildMember, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    TextChannel,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ChannelType,
    ButtonInteraction,
    CategoryChannel,
    Colors
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export class TicketPlugin implements IPlugin {
    readonly id = 'ticket';
    readonly name = 'Ticket System';
    readonly version = '1.0.0';
    readonly description = 'Simple ticket management system';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ViewChannel
    ];

    readonly commands = ['ticket'];
    readonly events = ['interactionCreate'];
    readonly dashboardSections = ['tickets'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
    });

    private client!: Client;
    private db!: PrismaClient;
    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.logger.info('Ticket Plugin initialized');
    }

    async registerCommands(): Promise<any[]> {
        const ticketCommand = new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('Manage the ticket system')
            .addSubcommand(sub => 
                sub.setName('setup')
                .setDescription('Configure ticket system')
                .addChannelOption(opt => opt.setName('category').setDescription('Category to create tickets in').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
                .addRoleOption(opt => opt.setName('role').setDescription('Staff role to manage tickets').setRequired(true))
            )
            .addSubcommand(sub =>
                sub.setName('panel')
                .setDescription('Send the ticket creation panel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send panel to'))
            )
            .addSubcommand(sub =>
                sub.setName('close')
                .setDescription('Close the current ticket')
            )
            .addSubcommand(sub => 
                sub.setName('add')
                .setDescription('Add a user to the ticket')
                .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true))
            )
            .addSubcommand(sub => 
                sub.setName('remove')
                .setDescription('Remove a user from the ticket')
                .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
            );

        return [ticketCommand];
    }

    async onInteractionCreate(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
        if (!interaction.guildId) return;

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName !== 'ticket') return;

            const subcommand = interaction.options.getSubcommand();
            
            if (subcommand === 'setup') {
                await this.handleSetup(interaction);
            } else if (subcommand === 'panel') {
                await this.handlePanel(interaction);
            } else if (subcommand === 'close') {
                await this.handleClose(interaction);
            } else if (subcommand === 'add') {
                await this.handleAddUser(interaction);
            } else if (subcommand === 'remove') {
                await this.handleRemoveUser(interaction);
            }
        } 
        else if (interaction.isButton()) {
            if (interaction.customId === 'create_ticket') {
                await this.handleCreateTicket(interaction);
            } else if (interaction.customId.startsWith('close_ticket_')) {
                // Determine if we confirm or just close. For now, just close logic.
                // Usually buttons inside the ticket might trigger close.
            }
        }
    }

    private async handleSetup(interaction: ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator permissions.', ephemeral: true });
            return;
        }

        const category = interaction.options.getChannel('category', true);
        const role = interaction.options.getRole('role', true);
        const guildId = interaction.guildId!;

        await this.db.ticketSettings.upsert({
            where: { guildId },
            create: {
                guildId,
                ticketCategoryId: category.id,
                staffRoleId: role.id
            },
            update: {
                ticketCategoryId: category.id,
                staffRoleId: role.id
            }
        });

        await interaction.reply({ content: `Ticket system configured!\nCategory: ${category.name}\nStaff Role: ${role.name}`, ephemeral: true });
    }

    private async handlePanel(interaction: ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need Administrator permissions.', ephemeral: true });
            return;
        }

        const channel = (interaction.options.getChannel('channel') as TextChannel) || interaction.channel;
        
        const embed = new EmbedBuilder()
            .setTitle('Support Tickets')
            .setDescription('Click the button below to open a support ticket.')
            .setColor(Colors.Blue);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Open Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Panel sent!', ephemeral: true });
    }

    private async handleCreateTicket(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guildId!;
        const userId = interaction.user.id;

        // Check for existing open ticket
        const existing = await this.db.ticket.findFirst({
            where: {
                guildId,
                ownerId: userId,
                status: 'open'
            }
        });

        if (existing) {
            await interaction.editReply({ content: `You already have an open ticket: <#${existing.channelId}>` });
            return;
        }

        // Get settings
        const settings = await this.db.ticketSettings.findUnique({ where: { guildId } });
        if (!settings || !settings.ticketCategoryId) {
            await interaction.editReply({ content: 'Ticket system not configured properly.' });
            return;
        }

        const guild = interaction.guild!;
        const category = await guild.channels.fetch(settings.ticketCategoryId) as CategoryChannel;
        
        if (!category) {
            await interaction.editReply({ content: 'Ticket category not found.' });
            return;
        }

        // Create Channel using modern V14 syntax
        const channel = await guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: userId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
                },
                {
                    id: settings.staffRoleId || userId, // Fallback if no staff role
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
                {
                    id: this.client.user!.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]
                }
            ],
        });

        // Save to DB
        await this.db.ticket.create({
            data: {
                guildId,
                channelId: channel.id,
                ownerId: userId,
                status: 'open'
            }
        });

        // Send welcome message
        const embed = new EmbedBuilder()
            .setTitle(`Ticket: ${interaction.user.username}`)
            .setDescription('Support will be with you shortly. To close this ticket, use `/ticket close`.')
            .setColor(Colors.Green);

        await channel.send({ 
            content: settings.staffRoleId ? `<@&${settings.staffRoleId}>` : undefined,
            embeds: [embed] 
        });

        await interaction.editReply({ content: `Ticket created: ${channel}` });
    }

    private async handleClose(interaction: ChatInputCommandInteraction) {
        const ticket = await this.db.ticket.findUnique({
            where: { channelId: interaction.channelId }
        });

        if (!ticket || ticket.status !== 'open') {
            await interaction.reply({ content: 'This is not an open ticket channel.', ephemeral: true });
            return;
        }

        await interaction.reply('Closing ticket in 5 seconds...');

        // Update DB
        await this.db.ticket.update({
            where: { id: ticket.id },
            data: { 
                status: 'closed',
                closedAt: new Date()
            }
        });

        setTimeout(async () => {
            const channel = interaction.channel;
            if (channel) {
                await channel.delete();
            }
        }, 5000);
    }

    private async handleAddUser(interaction: ChatInputCommandInteraction) {
        const ticket = await this.db.ticket.findUnique({
            where: { channelId: interaction.channelId }
        });

        if (!ticket || ticket.status !== 'open') {
            await interaction.reply({ content: 'This is not an open ticket channel.', ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user', true);
        const channel = interaction.channel as TextChannel;

        await channel.permissionOverwrites.create(user, {
            ViewChannel: true,
            SendMessages: true
        });

        await interaction.reply(`Added ${user} to the ticket.`);
    }

    private async handleRemoveUser(interaction: ChatInputCommandInteraction) {
        const ticket = await this.db.ticket.findUnique({
            where: { channelId: interaction.channelId }
        });

        if (!ticket || ticket.status !== 'open') {
            await interaction.reply({ content: 'This is not an open ticket channel.', ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user', true);
        const channel = interaction.channel as TextChannel;

        if (user.id === ticket.ownerId) {
             await interaction.reply({ content: 'Cannot remove the ticket owner.', ephemeral: true });
             return;
        }

        await channel.permissionOverwrites.delete(user);
        await interaction.reply(`Removed ${user} from the ticket.`);
    }

    async shutdown(): Promise<void> {
        // cleanup
    }
}
