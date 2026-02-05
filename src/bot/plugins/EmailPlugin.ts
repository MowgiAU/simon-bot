import { 
    EmbedBuilder, 
    TextChannel, 
    PermissionFlagsBits 
} from 'discord.js';
import { IPlugin, IPluginContext, ILogger } from '../types/plugin';
import { z } from 'zod';
import { EmailService } from '../../services/EmailService';

export class EmailPlugin implements IPlugin {
    id = 'email-client';
    name = 'Email Client';
    description = 'Notifications for incoming emails';
    version = '1.0.0';
    author = 'Fuji Studio';
    
    requiredPermissions = [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
    ];
    commands = [];
    dashboardSections = ['email-client'];
    defaultEnabled = true;
    configSchema = z.object({});

    events = [];

    private logger!: ILogger;
    private client: any;
    private emailService: EmailService;
    private interval: NodeJS.Timeout | null = null;

    constructor() {
        this.emailService = new EmailService();
    }

    async initialize(context: IPluginContext): Promise<void> {
        this.logger = context.logger;
        this.client = context.client;

        this.logger.info('Email Client initialized');
        this.startPolling();
    }

    async shutdown(): Promise<void> {
        if (this.interval) clearInterval(this.interval);
    }

    private startPolling() {
        this.interval = setInterval(() => this.checkEmails(), 15000);
    }

    private async checkEmails() {
        try {
            const settings = await this.emailService.getSettings();
            if (!settings.channelId) return;

            const emails = await this.emailService.getUnnotified();
            if (emails.length === 0) return;

            const channel = await this.client.channels.fetch(settings.channelId) as TextChannel;
            if (!channel) return;

            for (const email of emails) {
                // Strip HTML for notification preview
                const preview = email.body.replace(/<[^>]*>?/gm, '').substring(0, 200);

                const embed = new EmbedBuilder()
                    .setTitle(`📧 ${email.subject}`)
                    .setColor(0x0099ff)
                    .setAuthor({ name: email.from })
                    .addFields(
                        { name: 'From', value: `${email.fromEmail}`, inline: true },
                        { name: 'To', value: `${email.toEmail}`, inline: true }
                    )
                    .setDescription(preview + (preview.length >= 200 ? '...' : ''))
                    .setTimestamp(new Date(email.date))
                    .setFooter({ text: 'Check dashboard to reply' });

                const content = settings.roleId ? `<@&${settings.roleId}>` : undefined;
                
                await channel.send({ content, embeds: [embed] });
                
                // Mark notified
                await this.emailService.updateEmail(email.threadId, { notified: true });
            }

        } catch (e) {
            this.logger.error('Email Poller Error', e);
        }
    }
}
