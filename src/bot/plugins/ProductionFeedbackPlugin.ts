import { Message, ThreadChannel, ChannelType, Attachment, TextChannel, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';
import { FeedbackAIService } from '../services/FeedbackAIService';

export class ProductionFeedbackPlugin implements IPlugin {
    id = 'production-feedback';
    name = 'Production Feedback';
    description = 'AI-driven economy and moderation for music production feedback';
    version = '1.0.0';
    author = 'Simon Bot Team';

    requiredPermissions = [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.ManageWebhooks]; // Updated to use flags if possible, or string
    commands = ['feedback-init']; // Command to post the sticky
    events = ['messageCreate', 'threadCreate'];
    dashboardSections = ['feedback-queue', 'feedback-settings'];
    defaultEnabled = false;

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

            // Transaction: Check balance -> Deduct -> Allow
            await this.context.db.$transaction(async (tx: any) => {
                const account = await tx.economyAccount.findUnique({
                    where: { guildId_userId: { guildId, userId } }
                });

                if (!account || account.balance < cost) {
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

            // If success, maybe post a confirmation?
            /* await thread.send({
                embeds: [new EmbedBuilder().setDescription(`✅ **Thread Created**\nConsumed ${cost} coins. Good luck!`)]
            }); */

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
           if (starterId === message.id) isOpener = true;
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
    }

    private async handleAudioIntercept(message: Message) {
        // 1. Delete
        try {
            await message.delete();
        } catch (e) {
            this.logger.error('Failed to delete audio message', e);
            return;
        }

        // 2. Queue in DB
        if (!this.context || !message.guild) return;
        
        // We need to save the attachment info. 
        // Since we deleted the message, the attachment URL *might* expire or become invalid if Discord cleans it up immediately.
        // Usually, Discord keeps it for a bit, but safer to re-upload or rely on the proxy if we had one.
        // For now, we store the URL and hope it persists often enough, 
        // OR we just assume "Unsure" queue for files needs to ideally re-upload to a storage.
        // But user requirement says "file is sent to the dashboard". 
        // We'll store the URL. If it 404s, we might need a better solution (proxying).
        // *Correction*: Discord attachments on deleted messages are deleted.
        // We MUST Repost it to a log channel or download it.
        // "Using a Webhook (so it looks like the user posted it)".
        
        // Strategy: Repost to a private Review Channel immediately?
        // User said "The file is sent to the dashboard to review".
        // If we don't have a storage bucket, we can't "send to dashboard" without hosting it.
        // Workaround: Send it to a private immutable Discord channel (Review Channel) and use THAT url for the dashboard.
        
        const account = await this.context.db.feedbackSettings.findUnique({ where: { guildId: message.guildId } });
        const reviewChannelId = account?.reviewChannelId;
        
        let storedUrl = '';
        const attachment = message.attachments.first();
        
        if (reviewChannelId && attachment) {
             const reviewChannel = message.guild.channels.cache.get(reviewChannelId) as TextChannel;
             if (reviewChannel) {
                 const logMsg = await reviewChannel.send({
                     content: `Pending Audio Review from <@${message.author.id}> in <#${message.channel.id}>`,
                     files: [attachment] // Re-upload
                 });
                 storedUrl = logMsg.attachments.first()?.url || '';
             }
        }

        // 3. Create DB Entry
        await this.context.db.feedbackPost.create({
            data: {
                guildId: message.guildId!,
                channelId: (message.channel as ThreadChannel).parentId!,
                threadId: message.channel.id,
                userId: message.author.id,
                messageId: message.id, // ID of deleted message (reference only)
                content: message.content, // Original text
                hasAudio: true,
                audioUrl: storedUrl, // The persistent URL from logging
                aiState: 'PENDING', // Waiting for staff
                postType: 'FEEDBACK' // Implicitly
            }
        });

        // Notify user
        const response = await (message.channel as TextChannel).send(`<@${message.author.id}> your audio reply has been queued for moderation. It will appear once approved.`);
        setTimeout(() => response.delete().catch(() => {}), 10000);
    }
    
    // API-like method for the Dashboard to call "Approve"
    // This logic should likely be in the API route, but we can put helper here if we want.
    // We'll put the "execute webhook" logic in the API route or a centralized service? 
    // API route can import this plugin instance if we export it or register it?
    // Better: API route handles DB update, then triggers an event or we just handle it all in API route using standard Discord.js client.
    // We already have `client` in the API context usually.
}
