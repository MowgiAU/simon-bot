import {
    Client,
    Message,
    TextChannel,
    PermissionResolvable,
    EmbedBuilder,
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    ColorResolvable,
    MessageReaction,
    PartialMessageReaction,
    User,
    PartialUser,
    GuildMember,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class BotMessengerPlugin implements IPlugin {
    id = 'bot-messenger';
    name = 'Bot Messenger';
    description = 'Send messages, embeds, and reactions as the bot via slash commands or the dashboard. Includes reaction roles.';
    version = '1.1.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = [
        'SendMessages',
        'EmbedLinks',
        'AddReactions',
        'UseExternalEmojis',
        'ReadMessageHistory',
        'ManageRoles',
    ];

    commands = ['send', 'react'];
    events = ['interactionCreate', 'messageReactionAdd', 'messageReactionRemove'];
    dashboardSections = ['bot-messenger'];
    defaultEnabled = true;

    configSchema = z.object({});

    private simonClient: Client | null;
    private context: IPluginContext | null = null;
    private logger = new Logger('BotMessengerPlugin');
    private db: any;
    private expirySweepTimer: NodeJS.Timeout | null = null;

    // In-memory store for pending whispers: notification message ID → whisper data
    private pendingWhispers = new Map<string, {
        content: string;
        targetUserId: string;
        senderName: string;
    }>();

    constructor(simonClient?: Client | null) {
        this.simonClient = simonClient ?? null;
    }

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.db = context.db;
        this.logger.info('Bot Messenger Plugin initialized');

        // Self-destructing reaction roles: periodically strip expired mappings from
        // everyone they granted the role to, then delete the mapping. Polled every 30s
        // (not minutes) since durations as short as a few minutes are a supported use
        // case and a coarser interval means waiting up to ~2x the interval past expiry.
        this.expirySweepTimer = setInterval(() => this.processExpiredReactionRoles(), 30_000);
        setTimeout(() => this.processExpiredReactionRoles(), 10_000);
    }

    async shutdown(): Promise<void> {
        if (this.expirySweepTimer) clearInterval(this.expirySweepTimer);
    }

    async registerCommands(): Promise<any[]> {
        const sendCommand = new SlashCommandBuilder()
            .setName('send')
            .setDescription('Send a message as the bot')
            .setDefaultMemberPermissions(0x0000000000000020) // MANAGE_GUILD
            .addStringOption(opt =>
                opt.setName('message').setDescription('The message content to send').setRequired(true)
            )
            .addChannelOption(opt =>
                opt.setName('channel')
                    .setDescription('Channel to send in (default: current)')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
            .addStringOption(opt =>
                opt.setName('reply_to').setDescription('Message ID to reply to')
            )
            .addStringOption(opt =>
                opt.setName('bot')
                    .setDescription('Which bot to send as (default: main bot)')
                    .addChoices(
                        { name: 'Main Bot', value: 'main' },
                        { name: 'Simon Bot', value: 'simon' },
                    )
            );

        const reactCommand = new SlashCommandBuilder()
            .setName('react')
            .setDescription('React to a message as the bot')
            .setDefaultMemberPermissions(0x0000000000000020) // MANAGE_GUILD
            .addStringOption(opt =>
                opt.setName('message_id').setDescription('The message ID to react to').setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('emoji').setDescription('The emoji to react with (unicode or custom <:name:id>)').setRequired(true)
            )
            .addChannelOption(opt =>
                opt.setName('channel')
                    .setDescription('Channel the message is in (default: current)')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
            .addStringOption(opt =>
                opt.setName('bot')
                    .setDescription('Which bot to react as (default: main bot)')
                    .addChoices(
                        { name: 'Main Bot', value: 'main' },
                        { name: 'Simon Bot', value: 'simon' },
                    )
            );

        const whisperCommand = new SlashCommandBuilder()
            .setName('whisper')
            .setDescription('Send a private message to a user — only they can read it')
            .setDefaultMemberPermissions(0x0000000000000020) // MANAGE_GUILD
            .addUserOption(opt =>
                opt.setName('user').setDescription('The user to whisper to').setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('message').setDescription('The private message content').setRequired(true)
            );

        return [sendCommand, reactCommand, whisperCommand];
    }

    async onInteractionCreate(interaction: any): Promise<void> {
        if (!this.context) return;

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'send') {
                await this.handleSend(interaction);
            } else if (interaction.commandName === 'react') {
                await this.handleReact(interaction);
            } else if (interaction.commandName === 'whisper') {
                await this.handleWhisper(interaction);
            }
        } else if (interaction.isButton() && interaction.customId === 'whisper_view') {
            await this.handleWhisperView(interaction);
        }
    }

    private async handleSend(interaction: any): Promise<void> {
        const content = interaction.options.getString('message', true);
        const channelOption = interaction.options.getChannel('channel') || interaction.channel;
        const replyTo = interaction.options.getString('reply_to');
        const botChoice = interaction.options.getString('bot') ?? 'main';
        const useSimon = botChoice === 'simon' && !!this.simonClient;

        // Resolve channel through the appropriate client
        const channel = useSimon
            ? (this.simonClient!.channels.cache.get(channelOption?.id ?? channelOption?.id) as TextChannel | null ?? channelOption)
            : channelOption;

        if (!channel || !('send' in channel)) {
            await interaction.reply({ content: 'Invalid channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        try {
            const opts: any = { content };
            if (replyTo) {
                opts.reply = { messageReference: replyTo, failIfNotExists: false };
            }
            const sent = await (channel as TextChannel).send(opts);
            const botLabel = useSimon ? 'Simon Bot' : 'Main Bot';
            await interaction.reply({
                content: `Message sent as **${botLabel}** in <#${channel.id}> ([jump](${sent.url}))`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (err: any) {
            this.logger.error(`Failed to send message: ${err.message}`);
            await interaction.reply({ content: `Failed to send: ${err.message}`, flags: MessageFlags.Ephemeral });
        }
    }

    private async handleReact(interaction: any): Promise<void> {
        const messageId = interaction.options.getString('message_id', true);
        const emoji = interaction.options.getString('emoji', true);
        const channelOption = interaction.options.getChannel('channel') || interaction.channel;
        const botChoice = interaction.options.getString('bot') ?? 'main';
        const useSimon = botChoice === 'simon' && !!this.simonClient;

        const channel = useSimon
            ? (this.simonClient!.channels.cache.get(channelOption?.id) as TextChannel | null ?? channelOption)
            : channelOption;

        if (!channel || !('messages' in channel)) {
            await interaction.reply({ content: 'Invalid channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        try {
            const msg = await (channel as TextChannel).messages.fetch(messageId);
            await msg.react(emoji);
            const botLabel = useSimon ? 'Simon Bot' : 'Main Bot';
            await interaction.reply({
                content: `Reacted with ${emoji} as **${botLabel}** on [message](${msg.url})`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (err: any) {
            this.logger.error(`Failed to react: ${err.message}`);
            await interaction.reply({ content: `Failed to react: ${err.message}`, flags: MessageFlags.Ephemeral });
        }
    }

    private async handleWhisper(interaction: any): Promise<void> {
        const target  = interaction.options.getUser('user', true);
        const content = interaction.options.getString('message', true);
        const channel = interaction.channel as TextChannel;

        if (!channel || !('send' in channel)) {
            await interaction.reply({ content: 'Cannot send in this channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (target.bot) {
            await interaction.reply({ content: 'You cannot whisper to a bot.', flags: MessageFlags.Ephemeral });
            return;
        }

        // Check configured role permissions (falls back to Manage Guild if none set)
        if (this.db && interaction.guildId) {
            try {
                const settings = await this.db.whisperSettings.findUnique({ where: { guildId: interaction.guildId } });
                const allowedRoleIds: string[] = settings?.allowedRoleIds ?? [];
                if (allowedRoleIds.length > 0) {
                    const memberRoles: string[] = interaction.member?.roles?.cache?.map((r: any) => r.id) ?? [];
                    const hasRole = allowedRoleIds.some(id => memberRoles.includes(id));
                    if (!hasRole) {
                        await interaction.reply({ content: 'You don\'t have permission to use the whisper command.', flags: MessageFlags.Ephemeral });
                        return;
                    }
                }
            } catch { /* fall through to default permission check */ }
        }

        const senderName = interaction.member?.displayName || interaction.user.username;

        const button = new ButtonBuilder()
            .setCustomId('whisper_view')
            .setLabel('📨 View Private Message')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

        try {
            const notification = await channel.send({
                content: `📨 <@${target.id}> — you have a private message waiting.`,
                components: [row],
            });

            this.pendingWhispers.set(notification.id, {
                content,
                targetUserId: target.id,
                senderName,
            });

            // Log to database
            if (this.db && interaction.guildId) {
                this.db.whisperLog.create({
                    data: {
                        guildId:        interaction.guildId,
                        channelId:      channel.id,
                        channelName:    channel.name ?? 'unknown',
                        senderId:       interaction.user.id,
                        senderUsername: senderName,
                        targetId:       target.id,
                        targetUsername: target.username,
                        content,
                    },
                }).catch(() => {});
            }

            await interaction.reply({
                content: `Whisper sent to <@${target.id}>.`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (err: any) {
            this.logger.error(`Failed to send whisper: ${err.message}`);
            await interaction.reply({ content: `Failed to send whisper: ${err.message}`, flags: MessageFlags.Ephemeral });
        }
    }

    private async handleWhisperView(interaction: any): Promise<void> {
        const messageId = interaction.message?.id;
        const whisper = messageId ? this.pendingWhispers.get(messageId) : null;

        if (!whisper) {
            await interaction.reply({
                content: '📭 This message has already been read.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (interaction.user.id !== whisper.targetUserId) {
            await interaction.reply({
                content: '🔒 This message isn\'t for you.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // Deliver the whisper ephemerally then delete the notification
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('📨 Private Message')
                    .setDescription(whisper.content)
                    .setFooter({ text: `From: ${whisper.senderName}` })
                    .setTimestamp(),
            ],
            flags: MessageFlags.Ephemeral,
        });

        // Remove from store and delete the notification message
        this.pendingWhispers.delete(messageId);
        await interaction.message.delete().catch(() => {});
    }

    // ─── Reaction Roles ─────────────────────────────────────────────────────────

    private normalizeEmoji(reaction: MessageReaction | PartialMessageReaction): string {
        const e = reaction.emoji;
        // Custom emoji → "name:id", unicode → the unicode char
        return e.id ? `${e.name}:${e.id}` : e.name || '';
    }

    async onMessageReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
        if (user.bot) return;
        try {
            if (reaction.partial) await reaction.fetch();
            if (!reaction.message.guildId) return;

            const emoji = this.normalizeEmoji(reaction);
            const mapping = await this.db.reactionRole.findUnique({
                where: { messageId_emoji: { messageId: reaction.message.id, emoji } },
            });
            if (!mapping) return;

            const guild = reaction.message.guild || await this.context?.client.guilds.fetch(reaction.message.guildId);
            if (!guild) return;
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            await member.roles.add(mapping.roleId, 'Reaction role');
            await this.db.reactionRoleGrant.upsert({
                where: { reactionRoleId_userId: { reactionRoleId: mapping.id, userId: user.id } },
                create: { reactionRoleId: mapping.id, guildId: guild.id, userId: user.id, roleId: mapping.roleId },
                update: {},
            }).catch(() => {});
            this.logger.info(`Reaction role: added role ${mapping.roleId} to ${user.id} in ${guild.id}`);
        } catch (err: any) {
            this.logger.error(`Reaction role add error: ${err.message}`);
        }
    }

    async onMessageReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
        if (user.bot) return;
        try {
            if (reaction.partial) await reaction.fetch();
            if (!reaction.message.guildId) return;

            const emoji = this.normalizeEmoji(reaction);
            const mapping = await this.db.reactionRole.findUnique({
                where: { messageId_emoji: { messageId: reaction.message.id, emoji } },
            });
            if (!mapping) return;

            const guild = reaction.message.guild || await this.context?.client.guilds.fetch(reaction.message.guildId);
            if (!guild) return;
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            await member.roles.remove(mapping.roleId, 'Reaction role removed');
            await this.db.reactionRoleGrant.deleteMany({ where: { reactionRoleId: mapping.id, userId: user.id } }).catch(() => {});
            this.logger.info(`Reaction role: removed role ${mapping.roleId} from ${user.id} in ${guild.id}`);
        } catch (err: any) {
            this.logger.error(`Reaction role remove error: ${err.message}`);
        }
    }

    // Strips an expired reaction role from every member it granted, removes the bot's own
    // reaction from the message, then deletes the mapping (grants cascade-delete with it).
    private async processExpiredReactionRoles(): Promise<void> {
        try {
            const expired = await this.db.reactionRole.findMany({
                where: { expiresAt: { lte: new Date() } },
                include: { grants: true },
                take: 25,
            });
            for (const rr of expired) {
                try {
                    const guild = await this.context?.client.guilds.fetch(rr.guildId).catch(() => null);
                    if (guild) {
                        for (const grant of rr.grants) {
                            const member = await guild.members.fetch(grant.userId).catch(() => null);
                            if (member?.roles.cache.has(rr.roleId)) {
                                await member.roles.remove(rr.roleId, 'Reaction role expired')
                                    .catch((e: any) => this.logger.warn(`Failed removing expired reaction role from ${grant.userId}: ${e.message}`));
                            }
                        }
                        // Remove the bot's own reaction so the option visibly disappears from the message.
                        const channel = await guild.channels.fetch(rr.channelId).catch(() => null);
                        if (channel?.isTextBased()) {
                            const message = await channel.messages.fetch(rr.messageId).catch(() => null);
                            const botReaction = message?.reactions.cache.find(r => this.normalizeEmoji(r) === rr.emoji);
                            const botUserId = this.context?.client.user?.id;
                            if (botReaction && botUserId) await botReaction.users.remove(botUserId).catch(() => {});
                        }
                    }
                    await this.db.reactionRole.delete({ where: { id: rr.id } });
                    this.logger.info(`Reaction role ${rr.id} expired — stripped from ${rr.grants.length} member(s)`);
                } catch (err: any) {
                    this.logger.error(`Failed to process expired reaction role ${rr.id}: ${err.message}`);
                }
            }
        } catch (err: any) {
            this.logger.error(`Reaction role expiry sweep failed: ${err.message}`);
        }
    }
}
