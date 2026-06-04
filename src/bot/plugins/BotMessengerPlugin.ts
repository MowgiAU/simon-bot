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

    constructor(simonClient?: Client | null) {
        this.simonClient = simonClient ?? null;
    }

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.db = context.db;
        this.logger.info('Bot Messenger Plugin initialized');
    }

    async shutdown(): Promise<void> {}

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

        return [sendCommand, reactCommand];
    }

    async onInteractionCreate(interaction: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;
        if (!this.context) return;

        if (interaction.commandName === 'send') {
            await this.handleSend(interaction);
        } else if (interaction.commandName === 'react') {
            await this.handleReact(interaction);
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
            this.logger.info(`Reaction role: removed role ${mapping.roleId} from ${user.id} in ${guild.id}`);
        } catch (err: any) {
            this.logger.error(`Reaction role remove error: ${err.message}`);
        }
    }
}
