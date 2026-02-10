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
    Colors,
    Collection,
    Message
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
                .setDescription('Configure ticket system category')
                .addChannelOption(opt => opt.setName('category').setDescription('Category to create tickets in').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
                .addRoleOption(opt => opt.setName('initial_role').setDescription('Initial staff role (optional)').setRequired(false))
            )
            .addSubcommand(sub =>
                sub.setName('staff-add')
                .setDescription('Add a staff role to tickets')
                .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
            )
            .addSubcommand(sub =>
                sub.setName('staff-remove')
                .setDescription('Remove a staff role from tickets')
                .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
            )
            .addSubcommand(sub =>
                sub.setName('panel')
                .setDescription('Send the ticket creation panel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send panel to'))
            )
            .addSubcommand(sub =>
                sub.setName('transcript-channel')
                .setDescription('Set the channel for ticket transcripts/logs')
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel for transcripts').setRequired(true))
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
            )
            .addSubcommand(sub => 
                sub.setName('priority')
                .setDescription('Set the priority of the ticket')
                .addStringOption(opt => 
                    opt.setName('level')
                    .setDescription('Priority level')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Low', value: 'low' },
                        { name: 'Medium', value: 'medium' },
                        { name: 'High', value: 'high' }
                    )
                )
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
            } else if (subcommand === 'staff-add') {
                await this.handleStaffAdd(interaction);
            } else if (subcommand === 'staff-remove') {
                await this.handleStaffRemove(interaction);
            } else if (subcommand === 'panel') {
                await this.handlePanel(interaction);
            } else if (subcommand === 'transcript-channel') {
                await this.handleTranscriptChannel(interaction);
            } else if (subcommand === 'close') {
                await this.handleClose(interaction);
            } else if (subcommand === 'add') {
                await this.handleAddUser(interaction);
            } else if (subcommand === 'remove') {
                await this.handleRemoveUser(interaction);
            } else if (subcommand === 'priority') {
                await this.handlePriority(interaction);
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
        const initialRole = interaction.options.getRole('initial_role');
        const guildId = interaction.guildId!;

        const initialRoleIds = initialRole ? [initialRole.id] : [];

        await this.db.ticketSettings.upsert({
            where: { guildId },
            create: {
                guildId,
                ticketCategoryId: category.id,
                staffRoleIds: initialRoleIds
            },
            update: {
                ticketCategoryId: category.id,
                ...(initialRole ? { staffRoleIds: initialRoleIds } : {})
            }
        });

        await interaction.reply({ content: `Ticket system configured!\nCategory: ${category.name}${initialRole ? `\nStaff Role: ${initialRole.name}` : ''}`, ephemeral: true });
    }

    private async handleStaffAdd(interaction: ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need Administrator permissions.', ephemeral: true });
        }
        if (!interaction.guildId) return;
        const role = interaction.options.getRole('role', true);

        const settings = await this.db.ticketSettings.findUnique({ where: { guildId: interaction.guildId } });
        if (!settings) {
            return interaction.reply({ content: 'Please run /ticket setup first.', ephemeral: true });
        }

        const currentRoles = settings.staffRoleIds || [];
        if (currentRoles.includes(role.id)) {
            return interaction.reply({ content: 'That role is already a staff role.', ephemeral: true });
        }

        await this.db.ticketSettings.update({
            where: { guildId: interaction.guildId },
            data: { staffRoleIds: { push: role.id } }
        });

        await interaction.reply({ content: `Added ${role.name} to ticket staff roles.`, ephemeral: true });
    }

    private async handleStaffRemove(interaction: ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need Administrator permissions.', ephemeral: true });
        }
        if (!interaction.guildId) return;
        const role = interaction.options.getRole('role', true);

        const settings = await this.db.ticketSettings.findUnique({ where: { guildId: interaction.guildId } });
        if (!settings) {
            return interaction.reply({ content: 'Please run /ticket setup first.', ephemeral: true });
        }

        const currentRoles = settings.staffRoleIds || [];
        const newRoles = currentRoles.filter(id => id !== role.id);

        await this.db.ticketSettings.update({
            where: { guildId: interaction.guildId },
            data: { staffRoleIds: newRoles }
        });

        await interaction.reply({ content: `Removed ${role.name} from ticket staff roles.`, ephemeral: true });
    }

    private async handleTranscriptChannel(interaction: ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need Administrator permissions.', ephemeral: true });
        }
        if (!interaction.guildId) return;

        const channel = interaction.options.getChannel('channel', true);

        await this.db.ticketSettings.upsert({
            where: { guildId: interaction.guildId },
            update: { transcriptChannelId: channel.id },
            create: {
                guildId: interaction.guildId,
                transcriptChannelId: channel.id
            }
        });

        await interaction.reply({ content: `Transcript logs will be sent to ${channel}.`, ephemeral: true });
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
        const overwrites: any[] = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: userId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
            },
            {
                id: this.client.user!.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]
            }
        ];

        // Add permissions for all staff roles
        if (settings.staffRoleIds && settings.staffRoleIds.length > 0) {
            settings.staffRoleIds.forEach(roleId => {
                overwrites.push({
                    id: roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                });
            });
        } 
        // Fallback or legacy support if needed, though we prioritize roleIds
        else if ((settings as any).staffRoleId) {
             overwrites.push({
                id: (settings as any).staffRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            });
        }

        const channel = await guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: overwrites,
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

        const rolePings = settings.staffRoleIds && settings.staffRoleIds.length > 0 
            ? settings.staffRoleIds.map(id => `<@&${id}>`).join(' ') 
            : ((settings as any).staffRoleId ? `<@&${(settings as any).staffRoleId}>` : undefined);

        await channel.send({ 
            content: rolePings,
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

        await interaction.reply('Closing ticket in 5 seconds... Saving logs...');

        // Transcript Logic
        const channel = interaction.channel as TextChannel;
        
        try {
            // Fetch messages for DB Archive
            let allMessages: any[] = [];
            let lastId: string | undefined;

            // Simple loop to get at least some history (e.g. last 500 messages)
            // For production, might want a full loop until no more messages
            for (let i = 0; i < 5; i++) {
                const options: any = { limit: 100 };
                if (lastId) options.before = lastId;
                
                const messages = (await channel.messages.fetch(options)) as unknown as Collection<string, Message>;
                if (messages.size === 0) break;
                
                allMessages.push(...messages.values());
                lastId = messages.last()?.id;
            }

            // Reverse to be chronological
            allMessages.reverse();

            // Save to DB
            const messageData = allMessages.map(m => ({
                ticketId: ticket.id,
                authorId: m.author.id,
                authorName: m.author.username,
                content: m.content || '',
                attachments: m.attachments.size > 0 ? JSON.stringify(m.attachments.map((a: any) => a.url)) : null,
                createdAt: m.createdAt
            }));

            if (messageData.length > 0) {
                 await this.db.ticketMessage.createMany({
                     data: messageData
                 });
            }

            // Also do the text file transcript for the channel
            const transcript = allMessages.map(m => {
                const time = m.createdAt.toISOString();
                const author = m.author.tag;
                const content = m.content;
                const attachments = m.attachments.map((a: any) => `[Attachment: ${a.url}]`).join(' ');
                return `[${time}] ${author}: ${content} ${attachments}`;
            }).join('\n');

            // Send to Transcript Channel if configured
            const settings = await this.db.ticketSettings.findUnique({ where: { guildId: interaction.guildId! } });
            
            if (settings?.transcriptChannelId) {
                const transcriptChannel = await interaction.guild?.channels.fetch(settings.transcriptChannelId) as TextChannel;
                if (transcriptChannel) {
                   const file = {
                        attachment: Buffer.from(transcript, 'utf-8'),
                        name: `transcript-${ticket.channelId}.txt`
                    };

                    await transcriptChannel.send({
                        content: `Transcript for Ticket #${ticket.id} (${ticket.priority.toUpperCase()})\nOwner: <@${ticket.ownerId}>\nClosed by: ${interaction.user}`,
                        files: [file]
                    });
                }
            }
        } catch (e) {
            this.logger.error(`Failed to generate/send transcript for ticket ${ticket.id}`, e);
        }

        // Update DB
        await this.db.ticket.update({
            where: { id: ticket.id },
            data: { 
                status: 'closed',
                closedAt: new Date()
            }
        });

        setTimeout(async () => {
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

    private async handlePriority(interaction: ChatInputCommandInteraction) {
        const ticket = await this.db.ticket.findUnique({
            where: { channelId: interaction.channelId }
        });

        if (!ticket || ticket.status !== 'open') {
            await interaction.reply({ content: 'This is not an open ticket channel.', ephemeral: true });
            return;
        }

        const level = interaction.options.getString('level', true);
        
        // Map level to emoji
        const emojis: Record<string, string> = {
            'low': '🟢',
            'medium': '🟡',
            'high': '🔴'
        };

        const emoji = emojis[level] || '🟢';

        // Update DB
        await this.db.ticket.update({
            where: { id: ticket.id },
            data: { priority: level }
        });

        // Rename channel
        // 1. Remove existing emoji prefix if any
        const channel = interaction.channel as TextChannel;
        let newName = channel.name;
        
        // Regex to remove existing circle emojis at start
        newName = newName.replace(/^[🟢🟡🔴]-?/, '');

        // 2. Prepend new emoji
        newName = `${emoji}-${newName}`;

        try {
            await channel.setName(newName);
            await interaction.reply({ 
                content: `Priority set to **${level.toUpperCase()}** ${emoji}` 
            });
        } catch (error) {
            await interaction.reply({ 
                content: `Priority updated to **${level.toUpperCase()}** ${emoji}, but failed to rename channel (rate limit?).`,
                ephemeral: true 
            });
        }
    }

    async shutdown(): Promise<void> {
        // cleanup
    }
}
