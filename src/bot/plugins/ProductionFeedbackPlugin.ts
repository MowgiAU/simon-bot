import { Message, ThreadChannel, ChannelType, Attachment, TextChannel, PermissionFlagsBits, EmbedBuilder, Interaction, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } from 'discord.js';
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
    commands = ['feedback-init']; // Command to post the sticky
    events = ['messageCreate', 'threadCreate', 'interactionCreate'];
    dashboardSections = ['feedback-queue', 'feedback-settings'];
    defaultEnabled = true;

    configSchema = z.object({
        enabled: z.boolean().default(false),
        forumChannelId: z.string().optional(),
        currencyReward: z.number().default(1),
        threadCost: z.number().default(5),
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

            // B. Check Balance & Deduct Cost
            const cost = settings.threadCost;
            const userId = starterMsg.author.id;
            const guildId = thread.guildId;

            this.logger.info(`Processing feedback cost of ${cost} for user ${userId} in guild ${guildId}`);

            // Transaction: Check balance -> Deduct -> Allow
            await this.context.db.$transaction(async (tx: any) => {
                let account = await tx.economyAccount.findUnique({
                    where: { guildId_userId: { guildId, userId } }
                });

                // If account doesn't exist, create it (with 0 balance, so check will fail properly)
                if (!account) {
                    account = await tx.economyAccount.create({ 
                        data: { guildId, userId, balance: 0, totalEarned: 0 } 
                    });
                }

                if (account.balance < cost) {
                    throw new Error('Insufficient funds');
                }

                await tx.economyAccount.update({
                    where: { guildId_userId: { guildId, userId } },
                    data: { balance: { decrement: cost } }
                });

                // Record transaction
                await tx.economyTransaction.create({
                    data: {
                        guildId,
                        toUserId: null, // System (Burn)
                        fromUserId: userId,
                        amount: cost,
                        type: 'FEEDBACK_POST',
                        reason: `Created thread in ${thread.name}`
                    }
                });
            });

            this.logger.info(`Successfully deducted ${cost} coins from ${userId}`);
            
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
            
            // Send ephemeral confirmation in thread
            try {
                // We cannot send ephemeral messages to a thread easily without an interaction.
                // We'll send a normal message and delete it, or just leave it.
                const confirmMsg = await thread.send(`✅ **Feedback Thread Opened**\nConsumed ${settings.currencyEmoji || '🪙'} ${cost}.`);
                // setTimeout(() => confirmMsg.delete().catch(() => {}), 5000); 
            } catch (e) {
                this.logger.error('Failed to send confirmation message', e);
            }

        } catch (error: any) {
            if (error.message === 'Insufficient funds') {
                await thread.delete('Insufficient funds');
                try {
                    const starterMsg = await thread.fetchStarterMessage();
                    if (starterMsg) {
                        await starterMsg.author.send(`You need ${settings.threadCost} coins to post a thread. Valid feedback on other threads earns ${settings.currencyReward} coins.`);
                    }
                } catch {}
            } else {
                this.logger.error('Error handling new thread', error);
            }
        }
    }

    async onMessage(message: Message): Promise<void> {
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
                // Reward
                await this.rewardUser(message.author.id, message.guildId, settings.currencyReward);
                // React to indicate success
                await message.react('✅'); 
                // Maybe a DM? Or ephemeral reply? React is less spammy.
            } else if (result.state === 'UNSURE') {
                // Should we notify staff?
                await message.react('❓'); // Indicates under review
            }
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
        await this.context.db.economyAccount.upsert({
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
        await this.context.db.economyTransaction.create({
            data: {
                guildId,
                toUserId: userId,
                fromUserId: null, // System
                amount,
                type: 'FEEDBACK_REWARD',
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
    }

    private async handleAudioIntercept(message: Message) {
        if (!this.context || !message.guild) return;

        const settings = await this.context.db.feedbackSettings.findUnique({ where: { guildId: message.guildId } });
        const reviewChannelId = settings?.reviewChannelId;
        
        let storedUrl = '';
        let referenceUrl = '';
        let reviewMessage: Message | null = null;
        
        const attachment = message.attachments.first();
        
        // 1. Re-host to Review Channel
        if (reviewChannelId && attachment) {
             const reviewChannel = message.guild.channels.cache.get(reviewChannelId) as TextChannel;
             if (reviewChannel) {
                 try {
                     reviewMessage = await reviewChannel.send({
                         content: `**Pending Audio Review**\nUser: <@${message.author.id}>\nThread: <#${message.channel.id}>\nOriginal Content: "${message.content}"`,
                         files: [attachment] 
                     });
                     storedUrl = reviewMessage.attachments.first()?.url || '';
                 } catch (e) {
                     this.logger.error('Failed to re-host audio file', e);
                 }
             }
        }

        // 2. Delete Original
        try {
            if (message.deletable) await message.delete();
        } catch (e) {
            this.logger.error('Failed to delete message', e);
        }

        // 3. Comparison Audio
        try {
            if (message.channel.isThread()) {
                 const starter = await message.channel.fetchStarterMessage().catch(() => null);
                 if (starter) {
                     const startAudio = starter.attachments.find(a => a.contentType?.startsWith('audio/') || a.contentType?.startsWith('video/'));
                     if (startAudio) referenceUrl = startAudio.url;
                 }
            }
        } catch (e) {}

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
        if (!interaction.isButton() || !interaction.guildId || !this.context) return;
        
        const { customId, user } = interaction;
        if (!customId.startsWith('feedback_')) return;

        // Check Permissions
        const pluginSettings = await this.context.db.pluginSettings.findUnique({ 
            where: { guildId_pluginId: { guildId: interaction.guildId, pluginId: 'production-feedback' } }
        });
        
        const member = interaction.member as any; 
        const allowedRoles = pluginSettings?.allowedRoles || [];
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);
        const hasRole = allowedRoles.some((r: string) => member.roles.cache.has(r));

        if (!isAdmin && !hasRole) {
            await interaction.reply({ content: '❌ You do not have permission to review feedback.', ephemeral: true });
            return;
        }

        const [_, action, postId] = customId.split('_');
        await interaction.deferUpdate();

        const post = await this.context.db.feedbackPost.findUnique({ where: { id: postId } });
        if (!post) {
            await interaction.followUp({ content: 'Post not found', ephemeral: true });
            return;
        }

        // Check if already processed
        if (post.aiState === 'APPROVED' || post.aiState === 'REJECTED') {
             await interaction.followUp({ content: `Already ${post.aiState}`, ephemeral: true });
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

                // Reward
                const settings = await this.context.db.feedbackSettings.findUnique({ where: { guildId: interaction.guildId } });
                const reward = settings?.currencyReward || 1;
                await this.context.db.$transaction(async (tx: any) => {
                     await tx.economyAccount.upsert({
                        where: { guildId_userId: { guildId: post.guildId, userId: post.userId } },
                        update: { balance: { increment: reward }, totalEarned: { increment: reward } },
                        create: { guildId: post.guildId, userId: post.userId, balance: reward, totalEarned: reward }
                    });
                    await tx.economyTransaction.create({
                        data: {
                            guildId: post.guildId,
                            toUserId: post.userId,
                            amount: reward,
                            type: 'FEEDBACK_REWARD',
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
                 await interaction.followUp({ content: 'Approval failed internally.', ephemeral: true });
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
