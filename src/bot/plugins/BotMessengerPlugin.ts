import {
    Message,
    TextChannel,
    PermissionResolvable,
    EmbedBuilder,
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    ColorResolvable,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class BotMessengerPlugin implements IPlugin {
    id = 'bot-messenger';
    name = 'Bot Messenger';
    description = 'Send messages, embeds, and reactions as the bot via slash commands or the dashboard.';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = [
        'SendMessages',
        'EmbedLinks',
        'AddReactions',
        'UseExternalEmojis',
        'ReadMessageHistory',
    ];

    commands = ['send', 'react'];
    events = ['interactionCreate'];
    dashboardSections = ['bot-messenger'];
    defaultEnabled = true;

    configSchema = z.object({});

    private context: IPluginContext | null = null;
    private logger = new Logger('BotMessengerPlugin');

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
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
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const replyTo = interaction.options.getString('reply_to');

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
            await interaction.reply({
                content: `Message sent in <#${channel.id}> ([jump](${sent.url}))`,
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
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        if (!channel || !('messages' in channel)) {
            await interaction.reply({ content: 'Invalid channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        try {
            const msg = await (channel as TextChannel).messages.fetch(messageId);
            await msg.react(emoji);
            await interaction.reply({
                content: `Reacted with ${emoji} on [message](${msg.url})`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (err: any) {
            this.logger.error(`Failed to react: ${err.message}`);
            await interaction.reply({ content: `Failed to react: ${err.message}`, flags: MessageFlags.Ephemeral });
        }
    }
}
