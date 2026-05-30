import { Message, ThreadChannel, ChannelType, Attachment, TextChannel, PermissionFlagsBits, EmbedBuilder, Interaction, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, MessageFlags, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { FeedbackAIService } from '../services/FeedbackAIService';

export class ProductionFeedbackPlugin implements IPlugin {
    id = 'production-feedback';
    name = 'Production Feedback';
    description = 'AI-driven economy and moderation for music production feedback';
    version = '1.0.0';
    author = 'Simon Bot Team';

    requiredPermissions = [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.ManageWebhooks]; // Updated to use flags if possible, or string
    commands = ['feedback-init', 'feedback', 'admin-feedback'];
    events = ['messageCreate', 'threadCreate', 'interactionCreate'];
    dashboardSections = ['feedback-queue', 'feedback-settings'];
    defaultEnabled = true;

    configSchema = z.object({
        enabled: z.boolean().default(false),
        forumChannelId: z.string().optional(),
        feedbackPointsReward: z.number().default(1),
        feedbackPointsCost: z.number().default(5),
    });

    private context: IPluginContext | null = null;
    private logger: Logger;
    private ai: FeedbackAIService | null = null;

    constructor() {
        this.logger = new Logger('ProductionFeedbackPlugin');
    }

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        if (process.env.OPENAI_API_KEY) {
            this.ai = new FeedbackAIService(process.env.OPENAI_API_KEY);
            this.logger.info('AI Service initialized');
        } else {
            this.logger.warn('OPENAI_API_KEY missing. AI features will fail safe.');
        }
    }

    async shutdown(): Promise<void> {
    }

    async registerCommands(): Promise<SlashCommandBuilder[]> {
        const feedbackCmd = new SlashCommandBuilder()
            .setName('feedback')
            .setDescription('Feedback points commands')
            .addSubcommand(sub =>
                sub.setName('points')
                    .setDescription('Check your feedback points (or another user\'s)')
                    .addUserOption(opt =>
                        opt.setName('user')
                            .setDescription('User to check (defaults to you)')
                            .setRequired(false)
                    )
            ) as SlashCommandBuilder;

        const adminFeedbackCmd = new SlashCommandBuilder()
            .setName('admin-feedback')
            .setDescription('Manage user feedback points (admin only)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand(sub =>
                sub.setName('set')
                    .setDescription('Set a user\'s feedback point balance')
                    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                    .addIntegerOption(opt => opt.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0))
            )
            .addSubcommand(sub =>
                sub.setName('give')
                    .setDescription('Give feedback points to a user')
                    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                    .addIntegerOption(opt => opt.setName('amount').setDescription('Points to give').setRequired(true).setMinValue(1))
            ) as SlashCommandBuilder;

        return [feedbackCmd, adminFeedbackCmd];
    }

    private async handlePointsCheck(interaction: ChatInputCommandInteraction): Promise<void> {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const guildId = interaction.guildId!;

        const fp = await this.context!.db.feedbackPoints.findUnique({
            where: { guildId_userId: { guildId, userId: target.id } }
        });

        const balance = fp?.balance ?? 0;
        const totalEarned = fp?.totalEarned ?? 0;
        const isSelf = target.id === interaction.user.id;

        const embed = new EmbedBuilder()
            .setTitle(`${isSelf ? 'Your' : `${target.username}'s`} Feedback Points`)
            .setColor(0x2B8C71)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: 'Balance', value: `**${balance}** pts`, inline: true },
                { name: 'Total Earned', value: `**${totalEarned}** pts`, inline: true }
            )
            .setFooter({ text: 'Fuji Studio Feedback System' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: isSelf ? undefined : MessageFlags.Ephemeral });
    }

    private async handleAdminSet(interaction: ChatInputCommandInteraction): Promise<void> {
        // Belt-and-suspenders: verify admin even though setDefaultMemberPermissions enforces it at Discord level
        const member = interaction.member as any;
        if (!member?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Administrator permission required.', flags: MessageFlags.Ephemeral });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const rawAmount = interaction.options.getInteger('amount', true);
        const amount = Math.trunc(rawAmount); // guard against any float edge cases
        const guildId = interaction.guildId!;

        await this.context!.db.feedbackPoints.upsert({
            where: { guildId_userId: { guildId, userId: target.id } },
            update: { balance: amount },
            create: { guildId, userId: target.id, balance: amount, totalEarned: amount },
        });
        await this.context!.db.feedbackPointsTransaction.create({
            data: {
                guildId,
                userId: target.id,
                amount,
                type: 'BONUS',
                reason: `Admin set balance to ${amount} (by ${interaction.user.tag})`,
            },
        });

        await interaction.reply({
            content: `✅ Set <@${target.id}>'s feedback points to **${amount}**.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    private async handleAdminGive(interaction: ChatInputCommandInteraction): Promise<void> {
        const member = interaction.member as any;
        if (!member?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Administrator permission required.', flags: MessageFlags.Ephemeral });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const rawAmount = interaction.options.getInteger('amount', true);
        const amount = Math.trunc(rawAmount);
        const guildId = interaction.guildId!;

        const updated = await this.context!.db.feedbackPoints.upsert({
            where: { guildId_userId: { guildId, userId: target.id } },
            update: { balance: { increment: amount }, totalEarned: { increment: amount } },
            create: { guildId, userId: target.id, balance: amount, totalEarned: amount },
        });
        await this.context!.db.feedbackPointsTransaction.create({
            data: {
                guildId,
                userId: target.id,
                amount,
                type: 'BONUS',
                reason: `Admin gave ${amount} points (by ${interaction.user.tag})`,
            },
        });

        await interaction.reply({
            content: `✅ Gave **${amount}** feedback points to <@${target.id}>. New balance: **${updated.balance}**.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    async onThreadCreate(thread: ThreadChannel, newlyCreated: boolean): Promise<void> {
        if (!this.context || !newlyCreated) return;
        
        // 1. Get Settings
        const settings = await this.getSettings(thread.guildId);
        
        if (!settings || !settings.enabled) return;

        // Debug logging to help troubleshoot
        if (settings.forumChannelId !== thread.parentId) {
            this.logger.debug(`Thread created in parent ${thread.parentId}, but feedback is configured for ${settings.forumChannelId}. Ignoring.`);
            return;
        }

        try {
            // 2. Initial Post Check (Audio + Cost)
            // Wait a moment for the starter message to be available
            let starterMsg = await thread.fetchStarterMessage().catch(() => null);
            
            // Retry strategy for slow Discord API API availability
            if (!starterMsg) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                starterMsg = await thread.fetchStarterMessage().catch(() => null);
            }

            if (!starterMsg) {
                // Determine if we can fetch it via messages.fetch
                const messages = await thread.messages.fetch({ limit: 1 }).catch(() => null);
                starterMsg = messages?.first() || null;
            }
            
            if (!starterMsg) {
                this.logger.warn(`Could not fetch starter message for thread ${thread.id}. Skipping feedback cost logic.`);
                return;
            }

            // A. Check Audio
            const hasAudio = starterMsg.attachments.some(a => a.contentType?.startsWith('audio/') || a.contentType?.startsWith('video/')); 
            // Video often contains audio (screen recs of DAW).
            
            if (!hasAudio) {
                await thread.delete('No audio attachment provided');
                // DM User?
                try {
                    await starterMsg.author.send('Your thread was deleted because it did not contain an audio/video attachment. Please upload your track to receive feedback.');
                } catch {}
                return;
            }

            // B. Check Feedback Points & Deduct Cost
            const cost = settings.feedbackPointsCost;
            const userId = starterMsg.author.id;
            const guildId = thread.guildId;

            this.logger.info(`Processing feedback points cost of ${cost} for user ${userId} in guild ${guildId}`);

            // Transaction: Check balance -> Deduct -> Allow
            await this.context.db.$transaction(async (tx: any) => {
                let account = await tx.feedbackPoints.findUnique({
                    where: { guildId_userId: { guildId, userId } }
                });

                // If account doesn't exist, create it (with 0 balance, so check will fail properly)
                if (!account) {
                    account = await tx.feedbackPoints.create({ 
                        data: { guildId, userId, balance: 0, totalEarned: 0 } 
                    });
                }

                if (account.balance < cost) {
                    throw new Error('Insufficient feedback points');
                }

                await tx.feedbackPoints.update({
                    where: { guildId_userId: { guildId, userId } },
                    data: { balance: { decrement: cost } }
                });

                // Record transaction
                await tx.feedbackPointsTransaction.create({
                    data: {
                        guildId,
                        userId,
                        amount: -cost,
                        type: 'SPENT_POST',
                        reason: `Created thread in ${thread.name}`,
                        threadId: thread.id
                    }
                });
            });

            this.logger.info(`Successfully deducted ${cost} coins from ${userId}`);

            // Refresh nickname to reflect new feedback points balance
            const economyPlugin = this.context.plugins.get('economy') as any;
            if (economyPlugin?.refreshNickname) economyPlugin.refreshNickname(guildId, userId).catch(() => {});

            // Log to Audit Log
            if (this.context) {
                await this.context.logAction({
                    guildId,
                    actionType: 'FEEDBACK_THREAD_CREATED',
                    executorId: userId,
                    details: {
                        threadId: thread.id,
                        cost,
                        threadName: thread.name
                    }
                });
            }

            const newBalance = await this.context.db.feedbackPoints.findUnique({
                where: { guildId_userId: { guildId, userId } },
                select: { balance: true }
            }).then(r => r?.balance ?? 0);

            // Send confirmation in thread + DM the user
            try {
                const confirmMsg = await thread.send(`✅ **Feedback Thread Opened** — ${cost} feedback points deducted.`);
                setTimeout(() => confirmMsg.delete().catch(() => {}), 8000);
            } catch (e) {
                this.logger.error('Failed to send thread confirmation', e);
            }
            try {
                const starterUser = starterMsg.author;
                await starterUser.send(`✅ Your feedback thread **${thread.name}** was opened. ${cost} feedback points were deducted from your balance. You have **${newBalance}** point${newBalance === 1 ? '' : 's'} remaining.`);
            } catch {} // DMs may be closed

        } catch (error: any) {
            if (error.message === 'Insufficient feedback points') {
                await thread.delete('Insufficient feedback points');
                try {
                    const starterMsg = await thread.fetchStarterMessage();
                    if (starterMsg) {
                        await starterMsg.author.send(`You need ${settings.feedbackPointsCost} feedback points to post a thread. Valid feedback on other threads earns ${settings.feedbackPointsReward} points.`);
                    }
                } catch {}
            } else {
                this.logger.error('Error handling new thread', error);
            }
        }
    }

    async onMessageCreate(message: Message): Promise<void> {
        if (!this.context || message.author.bot || !message.guild) return;

        // 1. Context Check
        const channel = message.channel;
        if (!channel.isThread()) return; // Must be in a thread
        
        const settings = await this.getSettings(message.guildId!);
        if (!settings || !settings.enabled || settings.forumChannelId !== channel.parentId) return;

        // 2. Audio Interception (Replies)
        // If it's the thread starter, we handled it in onThreadCreate... EXCEPT onThreadCreate assumes message exists.
        // onMessage fires for the starter message too. We must distinguish.
        // Actually, for Forum channels, the starter message triggers onMessage too?
        // We can check `channel.id === message.id` (usually starter message ID == Thread ID in older logic, but in forums it matches?)
        // Safer: `message.id === channel.id` check is old behaviour. 
        // Best: Check if message is the starter message.
        
        const isStarter = message.id === channel.id; // Often true in forums, but let's check `message.type`.
        // Actually simplest is: If we just handled this thread in `onThreadCreate`, we don't want to double dip.
        // But `onMessage` is easier for the "Intercept Audio" logic on REPLIES.
        
        // Let's assume onThreadCreate handles the OP creation logic (cost, initial audio req).
        // Here we handle REPLIES.
        
        // Wait, if onMessage allows us to catch the starter message, we might conflict.
        // If `message.createdTimestamp` is close to `channel.createdTimestamp`?
        // Or check `message.id === channel.starterMessageId` (requires fetch).
        
        let isOpener = false;
        try {
           // Basic check: is this the first message?
           const starterId = (channel as any).starterMessageId;
           // If starterId exists and matches, it's opener.
           // If message.id == channel.id, it's opener.
           if (starterId === message.id || message.id === channel.id) isOpener = true;
           
           // If we still don't know (rare race condition), we can fallback to checking creation time closeness 
           // but that is risky.
           // Safe fallback: if this plugin JUST processed this thread in onThreadCreate, we might be seeing the same message event.
           // For now, the ID check is the standard way.
        } catch {}

        if (isOpener) return; // Handled by onThreadCreate

        // OP self-feedback block: thread owners can't earn rewards on their own posts
        if (channel.ownerId === message.author.id) return;

        // --- Audio Interception Logic ---
        const hasAudio = message.attachments.some(a => a.contentType?.startsWith('audio/') || a.contentType?.startsWith('video/'));
        if (hasAudio) {
            // Delete and Queue
            await this.handleAudioIntercept(message);
            return;
        }

        // --- AI Feedback Logic ---
        // Earn Points: "Users can only earn points once per thread"
        if (await this.hasEarnedInThread(message.author.id, channel.id)) {
            // No reward, but still allowed to post text
            return;
        }

        // Quick content pre-filter: skip obvious non-feedback before calling AI
        const stripped = message.content
            .replace(/https?:\/\/\S+/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/[^\w\s]/gu, ' ')
            .trim();
        const wordCount = stripped.split(/\s+/).filter(Boolean).length;
        if (wordCount < 3) return; // Too short to be meaningful feedback

        if (this.ai) {
            const result = await this.ai.analyzeFeedback(message.content);
            
            // Save FeedbackPost to DB
            await this.context.db.feedbackPost.create({
                data: {
                    guildId: message.guildId,
                    channelId: channel.parentId!, // Forum ID
                    threadId: channel.id,
                    userId: message.author.id,
                    messageId: message.id,
                    content: message.content,
                    aiScore: result.score,
                    aiState: result.state,
                    aiReason: result.reason,
                    postType: result.type
                }
            });

            if (result.state === 'APPROVED' && message.guildId) {
                // Reward with feedback points
                await this.rewardUser(message.author.id, message.guildId, settings.feedbackPointsReward);
                // React to indicate success
                await message.react('✅'); 
            }
            // UNSURE: queued silently for staff review — no reaction
            // DENIED: no action
        }
    }

    // --- Helpers ---

    private async getSettings(guildId: string) {
        return await this.context?.db.feedbackSettings.findUnique({
            where: { guildId }
        });
    }

    private async hasEarnedInThread(userId: string, threadId: string): Promise<boolean> {
        if (!this.context) return false;
        const count = await this.context.db.feedbackPost.count({
            where: {
                userId,
                threadId,
                aiState: 'APPROVED'
            }
        });
        return count > 0;
    }

    private async rewardUser(userId: string, guildId: string, amount: number) {
        if (!this.context) return;
        await this.context.db.feedbackPoints.upsert({
            where: { guildId_userId: { guildId, userId } },
            update: { 
                balance: { increment: amount },
                totalEarned: { increment: amount }
            },
            create: {
                guildId,
                userId,
                balance: amount,
                totalEarned: amount
            }
        });
        // Log tx
        await this.context.db.feedbackPointsTransaction.create({
            data: {
                guildId,
                userId,
                amount,
                type: 'EARNED_FEEDBACK',
                reason: 'High quality feedback'
            }
        });

        // Audit Log
        if (this.context) {
            await this.context.logAction({
                guildId,
                actionType: 'FEEDBACK_REWARD_GIVEN',
                targetId: userId,
                details: { amount }
            });
        }

        // Refresh nickname to reflect new balance
        const economyPlugin = this.context.plugins.get('economy') as any;
        if (economyPlugin?.refreshNickname) economyPlugin.refreshNickname(guildId, userId).catch(() => {});
    }

    private async handleAudioIntercept(message: Message) {
        if (!this.context || !message.guild) return;

        const settings = await this.context.db.feedbackSettings.findUnique({ where: { guildId: message.guildId } });
        const reviewChannelId = settings?.reviewChannelId;
        
        let storedUrl = '';
        let referenceUrl = '';
        let reviewMessage: Message | null = null;
        
        const attachment = message.attachments.first();

        // 1. Fetch the original track from the starter message
        let originalAttachment: Attachment | null = null;
        try {
            if (message.channel.isThread()) {
                const starter = await message.channel.fetchStarterMessage().catch(() => null);
                if (starter) {
                    originalAttachment = starter.attachments.find(a => a.contentType?.startsWith('audio/') || a.contentType?.startsWith('video/')) ?? null;
                    if (originalAttachment) referenceUrl = originalAttachment.url;
                }
            }
        } catch (e) {}

        // 2. Re-host to Review Channel (include both original track + new feedback file)
        if (reviewChannelId && attachment) {
             const reviewChannel = message.guild.channels.cache.get(reviewChannelId) as TextChannel;
             if (reviewChannel) {
                 try {
                     const files: any[] = [];
                     if (originalAttachment) files.push({ attachment: originalAttachment.url, name: `ORIGINAL_${originalAttachment.name}` });
                     files.push({ attachment: attachment.url, name: `FEEDBACK_${attachment.name}` });

                     reviewMessage = await reviewChannel.send({
                         content: `**Pending Audio Review**\nUser: <@${message.author.id}>\nThread: <#${message.channel.id}>\nOriginal Content: "${message.content}"`,
                         files
                     });
                     // storedUrl = the feedback file (last attachment)
                     const attachments = [...reviewMessage.attachments.values()];
                     storedUrl = attachments[attachments.length - 1]?.url || '';
                 } catch (e) {
                     this.logger.error('Failed to re-host audio file', e);
                 }
             }
        }

        // 3. Delete Original
        try {
            if (message.deletable) await message.delete();
        } catch (e) {
            this.logger.error('Failed to delete message', e);
        }

        // 4. Create DB Entry
        const post = await this.context.db.feedbackPost.create({
            data: {
                guildId: message.guildId,
                channelId: (message.channel as ThreadChannel).parentId!,
                threadId: message.channel.id,
                userId: message.author.id,
                messageId: message.id, 
                content: message.content, 
                hasAudio: true,
                audioUrl: storedUrl, 
                referenceUrl: referenceUrl, 
                aiState: 'PENDING', 
                postType: 'FEEDBACK' 
            }
        });

        // 5. Add Buttons to Review Message
        if (reviewMessage) {
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`feedback_approve_${post.id}`)
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`feedback_deny_${post.id}`)
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger)
                );
            
            await reviewMessage.edit({ components: [row] });
        }

        // Notify user
        const response = await (message.channel as TextChannel).send(`<@${message.author.id}> your audio reply has been queued for moderation. It will appear once approved.`);
        setTimeout(() => response.delete().catch(() => {}), 10000);
    }

    async onInteractionCreate(interaction: Interaction) {
        if (!interaction.guildId || !this.context) return;

        // Slash commands
        if (interaction.isChatInputCommand()) {
            const cmd = interaction.commandName;
            if (cmd === 'feedback') {
                const sub = interaction.options.getSubcommand();
                if (sub === 'points') await this.handlePointsCheck(interaction);
            } else if (cmd === 'admin-feedback') {
                const sub = interaction.options.getSubcommand();
                if (sub === 'set') await this.handleAdminSet(interaction);
                else if (sub === 'give') await this.handleAdminGive(interaction);
            }
            return;
        }

        // Button interactions (existing approval/denial logic)
        if (!interaction.isButton()) return;
        const { customId, user } = interaction;
        if (!customId.startsWith('feedback_')) return;

        // Check Permissions
        const feedbackSettings = await this.getSettings(interaction.guildId);
        
        const member = interaction.member as any; 
        const allowedRoles = feedbackSettings?.approverRoleIds || [];
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);
        const hasRole = allowedRoles.some((r: string) => member.roles.cache.has(r));

        if (!isAdmin && !hasRole) {
            await interaction.reply({ content: '❌ You do not have permission to review feedback.', flags: MessageFlags.Ephemeral });
            return;
        }

        const [_, action, postId] = customId.split('_');
        await interaction.deferUpdate();

        const post = await this.context.db.feedbackPost.findUnique({ where: { id: postId } });
        if (!post) {
            await interaction.followUp({ content: 'Post not found', flags: MessageFlags.Ephemeral });
            return;
        }

        // Check if already processed
        if (post.aiState === 'APPROVED' || post.aiState === 'REJECTED') {
             await interaction.followUp({ content: `Already ${post.aiState}`, flags: MessageFlags.Ephemeral });
             return;
        }

        if (action === 'approve') {
             try {
                // Determine Avatar
                const authorUser = await this.context.client.users.fetch(post.userId).catch(() => null);
                const avatarUrl = authorUser?.displayAvatarURL({ extension: 'png' }) || '';
                
                const channel = interaction.guild!.channels.cache.get(post.channelId); // Forum
                
                // Repost Logic
                if (channel && channel.type === ChannelType.GuildForum) {
                    const webhooks = await channel.fetchWebhooks();
                    let webhook = webhooks.find(w => w.name === 'Simon-Masquerade');
                    if (!webhook) {
                         webhook = await channel.createWebhook({ name: 'Simon-Masquerade' });
                    }

                    // Prepare Multipart for reliable audio player
                    let payload: any = {
                        content: post.content || '',
                        username: authorUser?.username || 'Producer',
                        avatarURL: avatarUrl,
                        threadId: post.threadId,
                        allowedMentions: { parse: [] }
                    };

                    if (post.audioUrl) {
                        try {
                            const audioStream = await axios.get(post.audioUrl, { responseType: 'stream' });
                            const filename = post.audioUrl.split('/').pop()?.split('?')[0] || 'audio.mp3';
                            const formData = new FormData();
                            // Note: DiscordJS webhook.send supports 'files' array with buffers/streams directly
                            // We don't need 'form-data' package here if using djs
                            payload.files = [{ attachment: audioStream.data, name: filename }];
                        } catch (e) {
                             payload.content += `\n\n${post.audioUrl}`;
                        }
                    }

                    await webhook.send(payload);
                } else {
                    const thread = interaction.guild!.channels.cache.get(post.threadId);
                    if (thread && thread.isThread()) {
                        await thread.send({
                            content: `**Feedback from <@${post.userId}>**:\n${post.content}\n${post.audioUrl}`
                        });
                    }
                }

                // Reward with feedback points
                const settings = await this.context.db.feedbackSettings.findUnique({ where: { guildId: interaction.guildId } });
                const reward = settings?.feedbackPointsReward || 1;
                await this.context.db.$transaction(async (tx: any) => {
                     await tx.feedbackPoints.upsert({
                        where: { guildId_userId: { guildId: post.guildId, userId: post.userId } },
                        update: { balance: { increment: reward }, totalEarned: { increment: reward } },
                        create: { guildId: post.guildId, userId: post.userId, balance: reward, totalEarned: reward }
                    });
                    await tx.feedbackPointsTransaction.create({
                        data: {
                            guildId: post.guildId,
                            userId: post.userId,
                            amount: reward,
                            type: 'EARNED_FEEDBACK',
                            reason: 'Feedback Approved by Admin (Button)'
                        }
                    });
                });

                // Update DB state
                await this.context.db.feedbackPost.update({
                    where: { id: postId },
                    data: { aiState: 'APPROVED' }
                });

                // Update Review Message
                await interaction.editReply({
                    content: `✅ **Approved by <@${user.id}>**\nUser: <@${post.userId}>\nThread: <#${post.threadId}>`,
                    components: [] 
                });

             } catch (e) {
                 this.logger.error('Approval failed', e);
                 await interaction.followUp({ content: 'Approval failed internally.', flags: MessageFlags.Ephemeral });
             }

        } else if (action === 'deny') {
            await this.context.db.feedbackPost.update({
                where: { id: postId },
                data: { aiState: 'REJECTED' }
            });

             await interaction.editReply({
                content: `🚫 **Denied by <@${user.id}>**\nUser: <@${post.userId}>\nReason: Manual Rejection`,
                components: []
            });
        }
    }
}
