import { Message, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../core/IPlugin';

export class AntiExternalForwardPlugin implements IPlugin {
    readonly id = 'anti-external-forward';
    readonly name = 'Anti-External Forward';
    readonly description = 'Blocks users from forwarding messages from other servers while allowing internal forwards.';
    readonly version = '1.0.0';
    readonly author = 'Fuji Studio';
    readonly requiredPermissions = [PermissionsBitField.Flags.ManageMessages];
    readonly commands: string[] = [];
    readonly events = ['messageCreate'];
    readonly dashboardSections = ['Anti-External Forward'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
    });

    private context!: IPluginContext;
    private db: any;
    private logger: any;
    private client: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.db = context.db;
        this.logger = context.logger;
        this.client = context.client;

        this.client.on('messageCreate', (msg: Message) => this.handleMessageCreate(msg));
        this.logger.info('AntiExternalForwardPlugin initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('AntiExternalForwardPlugin shut down');
    }

    private async getSettings(guildId: string) {
        let settings = await this.db.antiExternalForwardSettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await this.db.antiExternalForwardSettings.create({ data: { guildId } });
        }
        return settings;
    }

    private async handleMessageCreate(message: Message): Promise<void> {
        if (message.author.bot || !message.guild || message.webhookId) return;

        const snapshots = (message as any).messageSnapshots;
        if (!snapshots || snapshots.size === 0) return;

        const settings = await this.getSettings(message.guild.id);
        if (!settings.enabled) return;

        // Check exempt channel
        if (settings.exemptChannelIds.includes(message.channel.id)) return;

        // Check exempt roles
        if (settings.exemptRoleIds.length > 0) {
            const member = message.member;
            if (member && member.roles.cache.some((r: any) => settings.exemptRoleIds.includes(r.id))) return;
        }

        const hasExternalContent = snapshots.some((snapshot: any) => {
            if (!snapshot.guildId) return true; // DM forward
            return snapshot.guildId !== message.guild!.id;
        });

        if (!hasExternalContent) return;

        this.logger.info(`AntiExternalForward: blocked external forward from ${message.author.tag} in ${message.guild.name}`);

        if (settings.deleteMessage && message.deletable) {
            try { await message.delete(); } catch { /* ignore */ }
        }

        if (settings.warnUser) {
            try {
                const warn = await message.channel.send({
                    content: `<@${message.author.id}>, forwarding messages from outside this server is not allowed here.`,
                });
                setTimeout(() => warn.delete().catch(() => {}), 5000);
            } catch { /* ignore */ }
        }

        if (settings.logChannelId) {
            try {
                const logChannel = await message.guild.channels.fetch(settings.logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle('🛡️ External Forward Blocked')
                        .addFields(
                            { name: 'User', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
                            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                            { name: 'Content', value: message.content || '*No additional text*' },
                        )
                        .setFooter({ text: `User ID: ${message.author.id}` })
                        .setTimestamp();
                    await (logChannel as any).send({ embeds: [embed] });
                }
            } catch (e: any) {
                this.logger.warn(`AntiExternalForward: failed to log: ${e.message}`);
            }
        }
    }
}
