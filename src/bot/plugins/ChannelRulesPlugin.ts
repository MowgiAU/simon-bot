import { 
    Message, 
    TextChannel, 
    PermissionResolvable, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    Attachment,
    ComponentType,
    ChannelType
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class ChannelRulesPlugin implements IPlugin {
    id = 'channel-rules';
    name = 'Channel Rules & Gatekeeper';
    description = 'Advanced traffic control and content moderation for channels.';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = [
        'ManageMessages', 
        'ManageWebhooks', 
        'SendMessages', 
        'EmbedLinks', 
        'ReadMessageHistory'
    ];
    
    commands = ['rules']; // Maybe a debug command?
    events = ['messageCreate', 'interactionCreate'];
    dashboardSections = ['channel-rules'];
    defaultEnabled = true;

    configSchema = z.object({});

    private context: IPluginContext | null = null;
    private logger = new Logger('ChannelRulesPlugin');
    private processedMessageIds = new Set<string>();

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.logger.info('Channel Rules Plugin initialized');
    }

    async shutdown(): Promise<void> {}

    async onInteractionCreate(interaction: any): Promise<void> {
        if (!interaction.isButton()) return;
        const parts = interaction.customId.split('_');
        // Format: CR_ACTION_RuleID_UserID_MessageID
        // prefix=CR, action=APPROVE/REJECT
        
        if (parts[0] !== 'CR') return; 

        const action = parts[1];
        // We need to rejoin if IDs contain underscores, but Snowflake IDs don't.
        // However, Rule IDs might be UUIDs. 
        // Let's assume standard format: CR_APPROVE_ruleId_userId_messageId
        
        // Safest parsing if we know IDs don't have underscores. 
        // If RuleID is UUID, it uses hyphens, so safe.
        const ruleId = parts[2];
        const userId = parts[3];
        const messageId = parts[4]; 

        if (action === 'APPROVE') {
            await this.handleApproval(interaction, ruleId, userId, messageId);
        } else if (action === 'REJECT') {
            await this.handleRejection(interaction, ruleId, userId, messageId);
        }
    }

    async onMessageCreate(message: Message): Promise<void> {
        if (!this.context || message.author.bot || !message.guild) return;

        // Debug Log for duplicate detection
        this.logger.info(`[PID:${process.pid}] onMessageCreate for ${message.id} by ${message.author.tag}`);

        // Idempotency check
        if (this.processedMessageIds.has(message.id)) {
            this.logger.info(`[PID:${process.pid}] Ignored duplicate message ${message.id}`);
            return;
        }
        this.processedMessageIds.add(message.id);
        setTimeout(() => this.processedMessageIds.delete(message.id), 10000);
        
        // Optimization: Quick check if this channel has rules before fetching everything
        // We can cache this efficiently later, for now we rely on DB + Prisma caching
        const settings = await this.context.db.channelRuleSettings.findUnique({
            where: { guildId: message.guild.id },
            include: { 
                rules: {
                    where: { 
                        targetChannelId: message.channelId,
                        enabled: true 
                    }
                } 
            }
        });

        if (!settings || settings.rules.length === 0) return;

        // Sort rules by some priority? For now, DB order (creation or implicit)
        // Usually Blocking rules > Formatting rules
        
        // Check Exempt Roles (Global or per rule? Schema has per-rule exemptRoles)
        // But maybe we want a global "Mod" bypass? 
        // For now, let's implement per-rule logic as requested.
        
        const member = message.member;
        if (!member) return;

        // Iterate Rules
        for (const rule of settings.rules) {
            // 1. Check Exemptions
            if (rule.exemptRoles.some((roleId: string) => member.roles.cache.has(roleId))) {
               continue; 
            }

            // 2. Check Requirements (Targeting)
            if (rule.requiredRoles.length > 0) {
                const hasRequired = rule.requiredRoles.some((roleId: string) => member.roles.cache.has(roleId));
                if (!hasRequired) continue; // Rule doesn't apply to this user
            }

            // 3. Evaluate Rule
            const isViolation = this.evaluateRule(rule, message);
            if (isViolation) {
                await this.executeAction(rule, message, settings.approvalChannelId);
                return; // Stop after first violation to prevent double actions
            }
        }
    }

    private evaluateRule(rule: any, message: Message): boolean {
        const config = rule.config as any;

        switch (rule.type) {
            case 'BLOCK_FILE_TYPES': {
                if (message.attachments.size === 0) return false;
                const blockedExts = (config.extensions || []).map((e: string) => e.toLowerCase());
                return message.attachments.some(att => {
                    const ext = '.' + att.name.split('.').pop()?.toLowerCase();
                    return blockedExts.includes(ext);
                });
            }

            case 'BLOCK_ALL_FILES': {
                return message.attachments.size > 0;
            }

            case 'MUST_CONTAIN_ATTACHMENT': {
                // If message has NO attachments, it's a violation
                return message.attachments.size === 0;
            }

            case 'MIN_LENGTH': {
                return message.content.length < (config.length || 0);
            }

            case 'MAX_LENGTH': {
                return message.content.length > (config.length || 2000);
            }

            case 'MAX_NEWLINES': {
                const newlines = (message.content.match(/\n/g) || []).length;
                return newlines > (config.max || 10);
            }

            case 'REGEX_MATCH': {
                try {
                    const regex = new RegExp(config.pattern, config.flags || 'i');
                    return regex.test(message.content);
                } catch (e) {
                    this.logger.error(`Invalid regex in rule ${rule.id}`, e);
                    return false;
                }
            }
            
            case 'CAPS_LIMIT': {
                 if (message.content.length < 5) return false; // Ignore short messages
                 const upper = message.content.replace(/[^A-Z]/g, '').length;
                 const ratio = upper / message.content.length;
                 return ratio > (config.threshold || 0.7);
            }
            
            case 'BLOCK_DOMAINS': {
                // Simplified domain check
                const domains = (config.domains || []).map((d: string) => d.toLowerCase());
                if (domains.length === 0) return false;
                return domains.some((domain: string) => message.content.toLowerCase().includes(domain));
            }

            default:
                return false;
        }
    }

    private async executeAction(rule: any, message: Message, approvalChannelId: string | null) {
        if (!this.context) return; // Typescript check
        
        try {
            if (rule.action === 'REQUIRE_APPROVAL') {
                if (!approvalChannelId) {
                    this.logger.warn(`Rule ${rule.id} triggered Intercept but no approval channel configured.`);
                    // Fallback to block if no approval channel
                    if (message.deletable) {
                         try { await message.delete(); } catch (e) {}
                    }
                    return;
                }
                
                // Send to queue FIRST (to preserve attachments), then delete
                await this.sendToApprovalQueue(rule, message, approvalChannelId);
                
                if (message.deletable) {
                    try {
                        await message.delete();
                    } catch (e: any) {
                        // Ignore "Unknown Message" error (already deleted by duplicate process?)
                        if (e.code !== 10008) { 
                            this.logger.warn(`Failed to delete message ${message.id}: ${e.message}`);
                        }
                    }
                }

                // Notify user potentially?
                try {
                    await message.channel.send({ 
                        content: `🔒 Your message in ${message.channel} has been intercepted for review.` 
                    }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
                } catch (e) {
                    // Ignore send errors
                }

            } else {
                // Just BLOCK
                 if (message.deletable) {
                     try { await message.delete(); } catch(e) {}
                 }
                 
                 await this.logAction(message, rule, 'Auto-Deleted');
                 
                 const reply = await message.channel.send({ 
                     content: `❌ **Message Blocked**\nYour message violated the rule: **${rule.name}**`
                 });
                 setTimeout(() => reply.delete().catch(() => {}), 5000);
            }

        } catch (e) {
            this.logger.error('Failed to execute rule action', e);
        }
    }

    private async sendToApprovalQueue(rule: any, message: Message, approvalChannelId: string) {
        const channel = message.guild?.channels.cache.get(approvalChannelId) as TextChannel;
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Review Request')
            .setColor('#FFA500') // Orange
            .addFields(
                { name: 'Author', value: `${message.author} (${message.author.tag})`, inline: true },
                { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
                { name: 'Rule Triggered', value: rule.name },
                { name: 'Content', value: message.content.substring(0, 1024) || '*[No Text Content]*' }
            )
            .setTimestamp();

        // Forward Attachments
        // We attach them to the approval message so they are hosted by Discord in the admin channel.
        // This acts as our "buffer".
        const files = message.attachments.map(a => ({ attachment: a.url, name: a.name }));

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`CR_APPROVE_${rule.id}_${message.author.id}_${message.id}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`CR_REJECT_${rule.id}_${message.author.id}_${message.id}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
            );
        
        // Send and get the forwarded message with new valid attachment URLs
        const sentMessage = await channel.send({ embeds: [embed], components: [row], files });
        
        // Store the NEW URLs which are safe in the admin channel
        const safeAttachmentUrls = sentMessage.attachments.map(a => a.url);

        // Key must include message ID to allow multiple pending messages from same user
        this.pendingMessages.set(`${rule.id}_${message.author.id}_${message.id}`, {
            content: message.content,
            channelId: message.channelId,
            username: message.author.username,
            avatarURL: message.author.displayAvatarURL(),
            attachmentUrls: safeAttachmentUrls // Use the hosted copies
        });
    }

    // In-memory buffer for pending approvals (cleared on restart - acceptable for MVP)
    private pendingMessages = new Map<string, any>();

    private async handleApproval(interaction: any, ruleId: string, userId: string, messageId: string) {
        const key = `${ruleId}_${userId}_${messageId}`;
        const data = this.pendingMessages.get(key);

        if (!data) {
            return interaction.reply({ content: '❌ Data for this message expired, was lost, or is already processing.', ephemeral: true });
        }
        
        // Remove immediately to prevent race conditions (double clicks)
        this.pendingMessages.delete(key);

        const targetChannel = interaction.guild?.channels.cache.get(data.channelId) as TextChannel;
        if (!targetChannel) {
             // Try to restore data if channel missing? Unlikely to happen.
             return interaction.reply({ content: 'Target channel not found.', ephemeral: true });
        }
        
        // Defer reply since webhook might take a moment
        await interaction.deferUpdate();

        // Spoofing Logic
        try {
            const webhooks = await targetChannel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.owner?.id === this.client?.user?.id);
            
            if (!webhook) {
                if (webhooks.size >= 10) {
                    // Try to reuse one or fail
                     webhook = webhooks.first(); // Fallback
                } else {
                    webhook = await targetChannel.createWebhook({
                        name: 'Simon Bot Proxy',
                        avatar: this.client?.user?.displayAvatarURL()
                    });
                }
            }

            // Repost
            await webhook?.send({
                content: data.content,
                username: data.username,
                avatarURL: data.avatarURL,
                files: data.attachmentUrls.map((url: string) => ({ attachment: url })) 
            });

            await interaction.editReply({ 
                content: `✅ **Approved** by ${interaction.user}`, 
                components: [], 
                embeds: [] 
            });
            
            // Log
            await this.context?.logAction({
                guildId: interaction.guildId!,
                actionType: 'message_approved',
                executorId: interaction.user.id,
                targetId: userId,
                details: { ruleId, channelId: data.channelId }
            });

        } catch (e) {
            this.logger.error('Approval execution failed', e);
            // Restore data on failure so they can try again?
            this.pendingMessages.set(key, data);
            await interaction.editReply({ content: 'Failed to repost message. Please try again.' });
        }
    }

    private async handleRejection(interaction: any, ruleId: string, userId: string, messageId: string) {
        // Just clear data and update UI
        this.pendingMessages.delete(`${ruleId}_${userId}_${messageId}`);
        
        await interaction.update({ 
            content: `🚫 **Rejected** by ${interaction.user}`, 
            components: [], 
            embeds: [] 
        });

        await this.context?.logAction({
            guildId: interaction.guildId!,
            actionType: 'message_rejected',
            executorId: interaction.user.id,
            targetId: userId,
            details: { ruleId }
        });
    }

    private async logAction(message: Message, rule: any, action: string) {
        if (!this.context) return;
        
        await this.context.logAction({
            guildId: message.guildId!,
            actionType: 'rule_triggered',
            executorId: message.author.id,
            targetId: message.channelId,
            details: {
                ruleName: rule.name,
                ruleType: rule.type,
                resolution: action,
                contentSummary: message.content.substring(0, 50) + '...'
            }
        });
    }
    
    // Helper accessors for strict TS
    private get client() { return this.context?.client; }
}
