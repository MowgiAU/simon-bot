import { Message, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';

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

        // Exempt roles bypass everything
        if (settings.exemptRoleIds.length > 0) {
            const member = message.member;
            if (member && member.roles.cache.some((r: any) => settings.exemptRoleIds.includes(r.id))) return;
        }

        const targetChannelId = message.channel.id;
        let shouldBlock = false;
        let blockReason = 'Forwarding is not allowed here.';
        let blockType = 'unknown';

        // 1. Target channel explicitly blocks ALL forwards (internal + external)
        if ((settings.blockedTargetChannelIds ?? []).includes(targetChannelId)) {
            shouldBlock = true;
            blockReason = 'Forwarding messages into this channel is not allowed.';
            blockType = 'blocked_target';
        }

        if (!shouldBlock) {
            for (const snapshot of snapshots.values()) {
                const sourceChannelId: string | undefined = snapshot.channelId;
                const sourceGuildId: string | undefined = snapshot.guildId;

                // 2. Source channel is on the blocked list
                if (sourceChannelId && (settings.blockedSourceChannelIds ?? []).includes(sourceChannelId)) {
                    shouldBlock = true;
                    blockReason = 'Forwarding content from that channel is not allowed.';
                    blockType = 'blocked_source';
                    break;
                }

                const isExternal = !sourceGuildId || sourceGuildId !== message.guild!.id;
                const isInternal = !isExternal;

                // 3. External forward — block unless target channel is exempt
                if (isExternal && !settings.exemptChannelIds.includes(targetChannelId)) {
                    shouldBlock = true;
                    blockReason = 'Forwarding messages from outside this server is not allowed here.';
                    blockType = 'external';
                    break;
                }

                // 4. Internal forward — block if the global toggle is on and target is not exempt
                if (isInternal && settings.blockInternalForwards && !settings.exemptChannelIds.includes(targetChannelId)) {
                    shouldBlock = true;
                    blockReason = 'Forwarding messages within this server is not allowed here.';
                    blockType = 'internal';
                    break;
                }
            }
        }

        if (!shouldBlock) return;

        this.logger.info(`AntiExternalForward: blocked ${blockType} forward from ${message.author.tag} in ${message.guild.name}`);

        if (settings.deleteMessage && message.deletable) {
            try { await message.delete(); } catch { /* ignore */ }
        }

        if (settings.warnUser) {
            try {
                const ch: any = message.channel;
                if (typeof ch.send === 'function') {
                    const warn = await ch.send({
                        content: `<@${message.author.id}>, ${blockReason}`,
                        allowedMentions: { users: [message.author.id] },
                    });
                    setTimeout(() => warn.delete().catch(() => {}), 5000);
                }
            } catch { /* ignore */ }
        }

        if (settings.logChannelId) {
            try {
                const logChannel = await message.guild.channels.fetch(settings.logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle('🛡️ Forward Blocked')
                        .addFields(
                            { name: 'User', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
                            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                            { name: 'Reason', value: blockReason },
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
