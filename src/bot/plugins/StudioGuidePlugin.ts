import {
    Message, TextChannel, EmbedBuilder,
    ChatInputCommandInteraction, SlashCommandBuilder,
    PermissionsBitField, MessageFlags, type PermissionResolvable,
    Collection,
} from 'discord.js';
import { z } from 'zod';
import OpenAI from 'openai';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { OpenAIEmbeddings } from '@langchain/openai';
import type { IPlugin, IPluginContext } from '../types/plugin.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Constants ───────────────────────────────────────────────────────────────

const INDEX_PATH = path.resolve(__dirname, '../../../data/fl_studio_index');
const RETRIEVAL_K = 4;
const CONVERSATION_TTL_MS = 15 * 60 * 1000; // 15 min inactivity expires conversation
const MAX_HISTORY_MESSAGES = 20; // keep last 20 messages for context window
const DEFAULT_SYSTEM_PROMPT = `You are Fuji, an expert music producer and FL Studio specialist on a Discord server for music producers. You have deep knowledge of FL Studio workflows, mixing, mastering, sound design, music theory, and audio engineering.

BEHAVIOUR:
- You passively monitor a help channel and answer questions naturally, as if you're a knowledgeable member of the community.
- You can see images and screenshots that users share — describe what you see and give feedback.
- If a question is vague or unclear, ask a specific follow-up question to clarify before answering.
- Keep answers concise but thorough. Use formatting (bold, code blocks, bullet points) for readability.
- If someone shares audio and asks for feedback, acknowledge you received it and provide what guidance you can based on their description.
- You can reference the FL Studio manual context provided to give accurate, manual-backed answers.
- If you genuinely don't know something, say so honestly rather than guessing.
- Match the casual but professional tone of the community. No emojis overload.

IMPORTANT:
- Do NOT respond to messages that are clearly not questions or requests for help (e.g., "thanks", "ok", "lol", general chat).
- Do NOT respond if another user has already provided a good answer and the conversation seems resolved.
- If a user has opted out, do NOT respond to them.
- You are NOT a general chatbot. Only respond to music production, FL Studio, and music theory questions.`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    userId?: string;
    timestamp: number;
}

interface GuildPause {
    pausedBy: string;
    pausedAt: number;
    resumeAt: number; // timestamp when pause expires
}

interface HelperActivity {
    userId: string;
    timestamp: number;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export class StudioGuidePlugin implements IPlugin {
    readonly id = 'studio-guide';
    readonly name = 'Studio Guide';
    readonly description = 'AI assistant that monitors a help channel and answers FL Studio & music theory questions using the official manuals';
    readonly version = '1.0.0';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions: PermissionResolvable[] = [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.CreatePublicThreads,
        PermissionsBitField.Flags.ReadMessageHistory,
    ];
    readonly commands = ['guide'];
    readonly events = ['messageCreate', 'interactionCreate'];
    readonly dashboardSections = ['studio-guide'];
    readonly defaultEnabled = true;
    readonly configSchema = z.object({});

    private context!: IPluginContext;
    private logger: any;
    private db: any;
    private client: any;
    private openai: OpenAI | null = null;
    private vectorStore: FaissStore | null = null;

    // In-memory state
    private cooldowns = new Map<string, number>(); // userId → last answer timestamp
    private guildPauses = new Map<string, GuildPause>(); // guildId → pause info
    private helperActivity = new Map<string, HelperActivity[]>(); // guildId → recent helper messages
    private activeConversations = new Map<string, string>(); // `guildId:channelId:userId` → conversationId
    private processedMessageIds = new Set<string>();

    // ─── Lifecycle ───────────────────────────────────────────────────────

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.logger = context.logger;
        this.db = context.db;
        this.client = context.client;

        // Init OpenAI
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
            this.logger.info('[StudioGuide] OpenAI initialized');
        } else {
            this.logger.warn('[StudioGuide] OPENAI_API_KEY missing — AI features disabled');
        }

        // Load FAISS vector store
        await this.loadVectorStore();
    }

    async shutdown(): Promise<void> {
        this.vectorStore = null;
        this.cooldowns.clear();
        this.guildPauses.clear();
        this.helperActivity.clear();
        this.activeConversations.clear();
    }

    // ─── Vector Store ────────────────────────────────────────────────────

    private async loadVectorStore(): Promise<void> {
        try {
            if (!fs.existsSync(path.join(INDEX_PATH, 'faiss.index'))) {
                this.logger.warn(`[StudioGuide] No faiss.index found at ${INDEX_PATH}. Place faiss.index + docstore.json there.`);
                return;
            }
            const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
            this.vectorStore = await FaissStore.load(INDEX_PATH, embeddings);
            this.logger.info('[StudioGuide] Knowledge base loaded successfully.');
        } catch (err) {
            this.logger.error('[StudioGuide] Failed to load knowledge base:', err);
        }
    }

    // ─── Settings ────────────────────────────────────────────────────────

    private async getSettings(guildId: string) {
        let settings = await this.db.studioGuideSettings.findUnique({ where: { guildId } });
        if (!settings) {
            await this.db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
            settings = await this.db.studioGuideSettings.create({ data: { guildId } });
        }
        return settings;
    }

    // ─── Commands ────────────────────────────────────────────────────────

    registerCommands() {
        return [
            new SlashCommandBuilder()
                .setName('guide')
                .setDescription('Studio Guide controls')
                .addSubcommand(sub =>
                    sub.setName('pause')
                        .setDescription('Pause the AI assistant for a period')
                        .addIntegerOption(opt =>
                            opt.setName('minutes')
                                .setDescription('Minutes to pause (default: 30)')
                                .setMinValue(1)
                                .setMaxValue(480)
                                .setRequired(false)))
                .addSubcommand(sub =>
                    sub.setName('resume')
                        .setDescription('Resume the AI assistant immediately'))
                .addSubcommand(sub =>
                    sub.setName('optout')
                        .setDescription('Ask the bot not to answer your questions')
                        .addBooleanOption(opt =>
                            opt.setName('permanent')
                                .setDescription('Permanently opt out (default: temporary)')
                                .setRequired(false))
                        .addIntegerOption(opt =>
                            opt.setName('minutes')
                                .setDescription('Minutes to opt out (ignored if permanent, default: 60)')
                                .setMinValue(1)
                                .setMaxValue(480)
                                .setRequired(false)))
                .addSubcommand(sub =>
                    sub.setName('optin')
                        .setDescription('Allow the bot to answer your questions again'))
                .addSubcommand(sub =>
                    sub.setName('ask')
                        .setDescription('Directly ask the AI a question')
                        .addStringOption(opt =>
                            opt.setName('question')
                                .setDescription('Your question')
                                .setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('status')
                        .setDescription('Show current Studio Guide status'))
                .toJSON(),
        ];
    }

    async onInteractionCreate(interaction: any): Promise<boolean> {
        if (!interaction.isChatInputCommand()) return false;
        if (interaction.commandName !== 'guide') return false;

        const guildId = interaction.guildId;
        if (!guildId) return false;

        const sub = interaction.options.getSubcommand();
        switch (sub) {
            case 'pause': return this.cmdPause(interaction, guildId);
            case 'resume': return this.cmdResume(interaction, guildId);
            case 'optout': return this.cmdOptOut(interaction, guildId);
            case 'optin': return this.cmdOptIn(interaction, guildId);
            case 'ask': return this.cmdAsk(interaction, guildId);
            case 'status': return this.cmdStatus(interaction, guildId);
            default: return false;
        }
    }

    // ── /guide pause ──
    private async cmdPause(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        const settings = await this.getSettings(guildId);

        // Check if user has a pause role
        const member = interaction.member as any;
        const memberRoles = member?.roles?.cache as Collection<string, any> | undefined;
        const hasPauseRole = settings.pauseRoles.length === 0 ||
            settings.pauseRoles.some((r: string) => memberRoles?.has(r)) ||
            member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);

        if (!hasPauseRole) {
            await interaction.reply({ content: '⚠️ You don\'t have permission to pause the Studio Guide.', flags: MessageFlags.Ephemeral });
            return true;
        }

        const minutes = interaction.options.getInteger('minutes') ?? 30;
        const resumeAt = Date.now() + (minutes * 60_000);

        this.guildPauses.set(guildId, {
            pausedBy: interaction.user.id,
            pausedAt: Date.now(),
            resumeAt,
        });

        await this.context.logAction({
            guildId,
            actionType: 'STUDIO_GUIDE_PAUSED',
            executorId: interaction.user.id,
            details: { minutes },
        });

        await interaction.reply(`⏸️ Studio Guide paused for **${minutes} minutes**. Staff can answer questions without interruption.`);
        return true;
    }

    // ── /guide resume ──
    private async cmdResume(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        const settings = await this.getSettings(guildId);
        const member = interaction.member as any;
        const memberRoles = member?.roles?.cache as Collection<string, any> | undefined;
        const hasPauseRole = settings.pauseRoles.length === 0 ||
            settings.pauseRoles.some((r: string) => memberRoles?.has(r)) ||
            member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);

        if (!hasPauseRole) {
            await interaction.reply({ content: '⚠️ You don\'t have permission to resume the Studio Guide.', flags: MessageFlags.Ephemeral });
            return true;
        }

        this.guildPauses.delete(guildId);

        await this.context.logAction({
            guildId,
            actionType: 'STUDIO_GUIDE_RESUMED',
            executorId: interaction.user.id,
        });

        await interaction.reply('▶️ Studio Guide resumed.');
        return true;
    }

    // ── /guide optout ──
    private async cmdOptOut(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        const permanent = interaction.options.getBoolean('permanent') ?? false;
        const minutes = interaction.options.getInteger('minutes') ?? 60;

        try {
            await this.db.studioGuideOptOut.upsert({
                where: { guildId_userId: { guildId, userId: interaction.user.id } },
                update: {
                    permanent,
                    expiresAt: permanent ? null : new Date(Date.now() + (minutes * 60_000)),
                },
                create: {
                    guildId,
                    userId: interaction.user.id,
                    permanent,
                    expiresAt: permanent ? null : new Date(Date.now() + (minutes * 60_000)),
                },
            });
        } catch (err) {
            this.logger.error('[StudioGuide] Failed to save opt-out:', err);
        }

        await this.context.logAction({
            guildId,
            actionType: 'STUDIO_GUIDE_USER_OPTOUT',
            executorId: interaction.user.id,
            details: { minutes: permanent ? 'permanent' : minutes, permanent },
        });

        const msg = permanent
            ? `🙈 Got it! I'll **permanently** stop answering your questions. Use \`/guide optin\` to re-enable anytime.`
            : `🙈 Got it! I won't answer your questions for **${minutes} minutes**. Use \`/guide optin\` to re-enable anytime.`;
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
        return true;
    }

    // ── /guide optin ──
    private async cmdOptIn(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        try {
            await this.db.studioGuideOptOut.deleteMany({
                where: { guildId, userId: interaction.user.id },
            });
        } catch (err) {
            this.logger.error('[StudioGuide] Failed to delete opt-out:', err);
        }

        await interaction.reply({ content: '👋 Welcome back! I\'ll answer your questions again.', flags: MessageFlags.Ephemeral });
        return true;
    }

    // ── /guide ask ──
    private async cmdAsk(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        if (!this.openai) {
            await interaction.reply({ content: '⚠️ AI is not configured. Contact an administrator.', flags: MessageFlags.Ephemeral });
            return true;
        }

        await interaction.deferReply();
        const question = interaction.options.getString('question', true);

        const answer = await this.generateResponse(guildId, question, [], null);

        await this.context.logAction({
            guildId,
            actionType: 'STUDIO_GUIDE_DIRECT_ASK',
            executorId: interaction.user.id,
            details: { question, answerLength: answer.length },
        });

        // Send in thread to keep channel tidy
        const baseMsg = await interaction.editReply(`📖 **"${question.substring(0, 100)}"** — answer in the thread below.`);

        try {
            const thread = await baseMsg.startThread({
                name: `Guide: ${question.substring(0, 80)}`,
                autoArchiveDuration: 60,
            });

            for (const chunk of this.splitMessage(answer)) {
                await thread.send(chunk);
            }
        } catch {
            // Fallback: reply directly
            for (const chunk of this.splitMessage(answer)) {
                await interaction.followUp(chunk);
            }
        }

        return true;
    }

    // ── /guide status ──
    private async cmdStatus(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        const settings = await this.getSettings(guildId);
        const pause = this.guildPauses.get(guildId);
        const isPaused = pause && pause.resumeAt > Date.now();

        const embed = new EmbedBuilder()
            .setTitle('📖 Studio Guide Status')
            .setColor(settings.enabled ? (isPaused ? 0xFFA500 : 0x2B8C71) : 0xFF4444)
            .addFields(
                { name: 'Enabled', value: settings.enabled ? '✅ Yes' : '❌ No', inline: true },
                { name: 'Status', value: isPaused ? `⏸️ Paused (${Math.ceil((pause!.resumeAt - Date.now()) / 60_000)}min left)` : '▶️ Active', inline: true },
                { name: 'Channel', value: settings.channelId ? `<#${settings.channelId}>` : 'Not set', inline: true },
                { name: 'Model', value: settings.model, inline: true },
                { name: 'Cooldown', value: `${settings.cooldownSeconds}s`, inline: true },
                { name: 'Knowledge Base', value: this.vectorStore ? '✅ Loaded' : '❌ Not loaded', inline: true },
            );

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return true;
    }

    // ─── Message Monitoring ──────────────────────────────────────────────

    async onMessageCreate(message: Message): Promise<void> {
        // Basic guards
        if (!message.guild || message.author.bot || !this.openai) return;

        // Idempotency
        if (this.processedMessageIds.has(message.id)) return;
        this.processedMessageIds.add(message.id);
        setTimeout(() => this.processedMessageIds.delete(message.id), 10_000);

        const guildId = message.guild.id;
        const settings = await this.getSettings(guildId);

        // Plugin enabled check
        if (!settings.enabled) return;

        // Channel check — only monitor the configured channel
        if (!settings.channelId || message.channelId !== settings.channelId) return;

        // Pause check
        const pause = this.guildPauses.get(guildId);
        if (pause && pause.resumeAt > Date.now()) return;
        if (pause && pause.resumeAt <= Date.now()) this.guildPauses.delete(guildId);

        // Track helper activity (suppression roles) — do this BEFORE opt-out or any skip,
        // so helper messages are always tracked even if the helper is opted out.
        const member = message.member;
        if (member && settings.suppressionRoles.length > 0) {
            const isHelper = settings.suppressionRoles.some((r: string) => member.roles.cache.has(r));
            if (isHelper) {
                const activities = this.helperActivity.get(guildId) || [];
                activities.push({ userId: message.author.id, timestamp: Date.now() });
                // Prune old entries
                const cutoff = Date.now() - ((settings.suppressionMinutes ?? 10) * 60_000);
                this.helperActivity.set(guildId, activities.filter(a => a.timestamp > cutoff));
                return; // Helpers don't need the bot to respond to them
            }
        }

        // Check active helper suppression — if a helper posted recently, stay silent
        if (settings.suppressionRoles.length > 0) {
            const activities = this.helperActivity.get(guildId) || [];
            const cutoff = Date.now() - ((settings.suppressionMinutes ?? 10) * 60_000);
            const recentHelper = activities.some(a => a.timestamp > cutoff);
            if (recentHelper) return;
        }

        // User opt-out check (DB-backed)
        try {
            const optOut = await this.db.studioGuideOptOut.findUnique({
                where: { guildId_userId: { guildId, userId: message.author.id } },
            });
            if (optOut) {
                if (optOut.permanent) return;
                if (optOut.expiresAt && new Date(optOut.expiresAt).getTime() > Date.now()) return;
                // Expired — clean up
                if (optOut.expiresAt && new Date(optOut.expiresAt).getTime() <= Date.now()) {
                    await this.db.studioGuideOptOut.delete({ where: { id: optOut.id } });
                }
            }
        } catch (err) {
            this.logger.error('[StudioGuide] Failed to check opt-out:', err);
        }

        // User cooldown check
        const lastAnswer = this.cooldowns.get(message.author.id) ?? 0;
        if (Date.now() - lastAnswer < (settings.cooldownSeconds * 1000)) return;

        // Skip GIF / sticker / meme-only messages — nothing to answer
        const hasStickers = message.stickers.size > 0;
        const hasGifAttachment = message.attachments.some(a => (a.contentType ?? '').startsWith('image/gif'));
        const hasGifEmbed = message.embeds.some(e =>
            /tenor\.com|giphy\.com/i.test(e.url ?? '') || /tenor\.com|giphy\.com/i.test(e.thumbnail?.url ?? ''),
        );
        if ((hasStickers || hasGifAttachment || hasGifEmbed) && message.content.trim().length < 10) return;

        // Build message content with attachments
        const { textContent, imageUrls, hasAudio, hasVideo } = this.extractMessageContent(message);

        // Skip audio/video-only messages — we can't process media
        if ((hasAudio || hasVideo) && textContent.replace(/\[(?:Audio|Video) attachment:.*?\]/g, '').trim().length < 10) return;

        // Skip very short messages that are unlikely to be questions
        if (textContent.length < 5 && imageUrls.length === 0) return;

        // Check if message is a reply to another user (not the bot) — probably a conversation, skip
        if (message.reference?.messageId) {
            try {
                const referenced = await message.channel.messages.fetch(message.reference.messageId);
                if (referenced && !referenced.author.bot) return; // Replying to a human — leave it alone
            } catch { /* couldn't fetch referenced message, proceed */ }
        }

        // Classify whether this message needs a response
        const shouldRespond = await this.classifyMessage(textContent, imageUrls.length > 0, hasAudio, hasVideo);
        if (!shouldRespond) return;

        // Get or create conversation context
        const conversationKey = `${guildId}:${message.channelId}:${message.author.id}`;
        const conversation = await this.getOrCreateConversation(guildId, message.channelId, message.author.id, settings.id);

        // Build message history
        const history = this.getConversationHistory(conversation);

        // Show typing indicator
        try { await (message.channel as TextChannel).sendTyping(); } catch { /* ignore */ }

        // Fetch custom knowledge entries for this guild
        const knowledge = await this.db.studioGuideKnowledge.findMany({
            where: { guildId, enabled: true },
            orderBy: { createdAt: 'asc' },
        });

        // Generate response
        const answer = await this.generateResponse(
            guildId,
            textContent,
            imageUrls,
            history,
            settings.systemPrompt || undefined,
            settings.model,
            hasAudio,
            hasVideo,
            knowledge,
        );

        if (!answer || answer.trim().length === 0) return;

        const footer = '\n\n-# Not helpful? Use `/guide optout` to stop replies.';
        const THREAD_THRESHOLD = 500; // chars — thread if response is substantial

        // Send response
        try {
            if (answer.length > THREAD_THRESHOLD) {
                // Long answer: notify in channel then dump full response in a thread
                const notify = await message.reply({
                    content: `📖 I've got a detailed answer for you — check the thread below.${footer}`,
                    allowedMentions: { repliedUser: true },
                });
                try {
                    const thread = await notify.startThread({
                        name: `${message.author.displayName}: ${textContent.substring(0, 60).trim()}`,
                        autoArchiveDuration: 60,
                    });
                    for (const chunk of this.splitMessage(answer)) {
                        await thread.send(chunk);
                    }
                } catch {
                    // Thread creation failed (e.g. no permission) — fall back to channel
                    for (const chunk of this.splitMessage(answer)) {
                        await (message.channel as TextChannel).send(chunk);
                    }
                }
            } else {
                // Short answer: reply directly with footer
                await message.reply({
                    content: answer + footer,
                    allowedMentions: { repliedUser: true },
                });
            }

            // Update conversation history
            await this.appendToConversation(conversation.id, [
                { role: 'user', content: textContent, userId: message.author.id, timestamp: Date.now() },
                { role: 'assistant', content: answer, timestamp: Date.now() },
            ]);

            // Set cooldown
            this.cooldowns.set(message.author.id, Date.now());

            // Audit log
            await this.context.logAction({
                guildId,
                actionType: 'STUDIO_GUIDE_AUTO_RESPONSE',
                executorId: this.client.user?.id,
                targetId: message.author.id,
                details: {
                    question: textContent.substring(0, 200),
                    answerLength: answer.length,
                    conversationId: conversation.id,
                    hadImages: imageUrls.length > 0,
                    hadAudio: hasAudio,
                    hadVideo: hasVideo,
                },
            });
        } catch (err) {
            this.logger.error('[StudioGuide] Failed to send response:', err);
        }
    }

    // ─── Message Classification ──────────────────────────────────────────

    private async classifyMessage(text: string, hasImages: boolean, hasAudio: boolean, hasVideo: boolean): Promise<boolean> {
        if (!this.openai) return false;

        const lowerText = text.toLowerCase().trim();

        // ── Reject obvious non-questions ──
        const rejectPatterns = [
            /^(thanks|thank you|ty|thx|cheers|np|no problem|ok(ay)?|lol|lmao|haha|yep|nah|bet|true|facts|dope|nice|cool|fire|w |rip|gg|gn|gm|bruh|fr|omg|smh|damn|wow)[.!?\s]*$/i,
            /^(i (agree|disagree|think so|know|see|got it)|makes sense|exactly|same|mood|real|this\^?)[.!?\s]*$/i,
        ];
        if (rejectPatterns.some(r => r.test(lowerText))) return false;

        // ── Reject answers/statements that help others (not questions) ──
        const answerPatterns = [
            /^(you (should|need to|can|could|might|have to)|try |use |go to |open |click |press |just |make sure)/i,
            /^(it('s| is) (because|probably|likely|just|a ))/i,
            /^(that('s| is) (because|probably|normal|just|how))/i,
        ];
        if (answerPatterns.some(r => r.test(lowerText)) && !lowerText.includes('?')) return false;

        // ── High-confidence question indicators ──
        const strongQuestionPatterns = [
            /\?/,                                          // Has a question mark
            /^(how|what|why|where|when|which|who|whose)\b/i, // Starts with question word
            /\b(how do|how to|what is|what's|why does|why is|why can't|why won't)\b/i,
            /\b(can i|can you|should i|could someone|does anyone|anyone know)\b/i,
            /\b(help me|i need help|i'm stuck|stuck on)\b/i,
            /\b(doesn't work|not working|broken|error|bug|crash|issue with)\b/i,
            /\b(any tips|any advice|recommend|suggestion)\b/i,
        ];

        const hasStrongQuestion = strongQuestionPatterns.some(r => r.test(lowerText));

        // Image with meaningful text likely wants feedback
        if (hasImages && text.length > 10) return true;

        // Short non-question — skip
        if (text.length < 15 && !hasStrongQuestion) return false;

        // If we have a strong question pattern, use AI to check topic relevance
        // If we don't, use AI to check if it's a question AND on-topic
        try {
            const prompt = hasStrongQuestion
                ? `You classify Discord messages in a music production help channel. Reply ONLY "YES" or "NO".\n\nReply "YES" ONLY if the message is about one of these topics:\n- FL Studio (DAW), its features, plugins, workflow\n- Audio production, mixing, mastering, sound design\n- Music production techniques\n- Music theory (chords, scales, harmony, rhythm)\n- VST plugins, synthesizers, samplers, effects\n- Audio hardware (interfaces, monitors, headphones, MIDI controllers)\n\nReply "NO" if the message is about:\n- General chat, memes, off-topic conversation\n- Non-music topics (gaming, coding, food, sports, politics, etc.)\n- Song/beat/track promotion or sharing without a question\n\nMessage: "${text.substring(0, 300)}"`
                : `You classify Discord messages in a music production help channel. Reply ONLY "YES" or "NO".\n\nReply "YES" ONLY if the message is:\n1. Asking a question or requesting help, AND\n2. About one of these topics: FL Studio, audio production, mixing, mastering, sound design, music production, music theory, VST plugins, audio hardware\n\nReply "NO" for general chat, statements, off-topic questions, thank-you messages, or already-answered conversations.\n\nMessage: "${text.substring(0, 300)}"`;

            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: prompt },
                ],
                model: 'gpt-4o-mini',
                temperature: 0,
                max_tokens: 5,
            });

            const result = completion.choices[0].message.content?.trim().toUpperCase();
            return result === 'YES';
        } catch {
            // Fallback: only respond if strong question pattern matched
            return hasStrongQuestion;
        }
    }

    // ─── Content Extraction ──────────────────────────────────────────────

    private extractMessageContent(message: Message): {
        textContent: string;
        imageUrls: string[];
        hasAudio: boolean;
        hasVideo: boolean;
    } {
        let textContent = message.content;
        const imageUrls: string[] = [];
        let hasAudio = false;
        let hasVideo = false;

        for (const [, attachment] of message.attachments) {
            const ct = attachment.contentType ?? '';
            if (ct.startsWith('image/')) {
                imageUrls.push(attachment.url);
            } else if (ct.startsWith('audio/') || attachment.name?.match(/\.(mp3|wav|flac|ogg|m4a|aif|aiff)$/i)) {
                hasAudio = true;
                textContent += `\n[Audio attachment: ${attachment.name}]`;
            } else if (ct.startsWith('video/') || attachment.name?.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
                hasVideo = true;
                textContent += `\n[Video attachment: ${attachment.name}]`;
            }
        }

        // Also check embeds for images
        for (const embed of message.embeds) {
            if (embed.image?.url) imageUrls.push(embed.image.url);
            if (embed.thumbnail?.url) imageUrls.push(embed.thumbnail.url);
        }

        return { textContent, imageUrls, hasAudio, hasVideo };
    }

    // ─── AI Response Generation ──────────────────────────────────────────

    private async generateResponse(
        guildId: string,
        question: string,
        imageUrls: string[],
        history: ConversationMessage[] | null,
        customSystemPrompt?: string,
        model: string = 'gpt-4o-mini',
        hasAudio: boolean = false,
        hasVideo: boolean = false,
        knowledge: Array<{ title: string; content: string; category: string }> = [],
    ): Promise<string> {
        if (!this.openai) return '';

        try {
            // RAG: retrieve relevant manual context
            let ragContext = '';
            if (this.vectorStore) {
                const results = await (this.vectorStore as any).similaritySearch(question, RETRIEVAL_K);
                ragContext = results.map((r: any) => r.pageContent).join('\n---\n');
            }

            // Build system prompt
            let systemPrompt = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
            if (knowledge.length > 0) {
                const knowledgeBlock = knowledge
                    .map(k => `[${k.category.toUpperCase()}] ${k.title}:\n${k.content}`)
                    .join('\n\n');
                systemPrompt += `\n\nCUSTOM KNOWLEDGE BASE (treat these as authoritative facts — prioritise these over general knowledge):\n${knowledgeBlock}`;
            }
            if (ragContext) {
                systemPrompt += `\n\nREFERENCE MATERIAL FROM THE FL STUDIO MANUAL & MUSIC THEORY GUIDE:\n${ragContext}`;
            }
            if (hasAudio) {
                systemPrompt += '\n\nNote: The user has attached an audio file. You cannot listen to audio, but you can ask them to describe what they\'re hearing or what they\'re trying to achieve, and give guidance based on that.';
            }
            if (hasVideo) {
                systemPrompt += '\n\nNote: The user has attached a video. You cannot watch videos, but you can ask them to describe what they\'re showing and provide guidance based on their description.';
            }

            // Build messages array
            const messages: any[] = [
                { role: 'system', content: systemPrompt },
            ];

            // Add conversation history
            if (history && history.length > 0) {
                for (const msg of history.slice(-MAX_HISTORY_MESSAGES)) {
                    messages.push({
                        role: msg.role,
                        content: typeof msg.content === 'string' ? msg.content : msg.content,
                    });
                }
            }

            // Build current user message (with vision if images present)
            if (imageUrls.length > 0) {
                const content: any[] = [{ type: 'text', text: question }];
                for (const url of imageUrls.slice(0, 4)) { // max 4 images
                    content.push({
                        type: 'image_url',
                        image_url: { url, detail: 'low' },
                    });
                }
                messages.push({ role: 'user', content });
            } else {
                messages.push({ role: 'user', content: question });
            }

            const completion = await this.openai.chat.completions.create({
                messages,
                model: imageUrls.length > 0 ? 'gpt-4o-mini' : model, // vision requires 4o models
                temperature: 0.3,
                max_tokens: 1500,
            });

            return completion.choices[0].message.content ?? '';
        } catch (err: any) {
            this.logger.error('[StudioGuide] AI generation error:', err);
            return '❌ I had trouble processing that. Please try again in a moment.';
        }
    }

    // ─── Conversation Management ─────────────────────────────────────────

    private async getOrCreateConversation(guildId: string, channelId: string, userId: string, settingsId: string) {
        // Check for existing active conversation
        const existing = await this.db.studioGuideConversation.findFirst({
            where: {
                guildId,
                channelId,
                userId,
                active: true,
                updatedAt: { gte: new Date(Date.now() - CONVERSATION_TTL_MS) },
            },
            orderBy: { updatedAt: 'desc' },
        });

        if (existing) return existing;

        // Mark old conversations as inactive
        await this.db.studioGuideConversation.updateMany({
            where: { guildId, channelId, userId, active: true },
            data: { active: false },
        });

        // Create new
        return this.db.studioGuideConversation.create({
            data: {
                guildId,
                channelId,
                userId,
                settingsId,
                messages: [],
                active: true,
            },
        });
    }

    private getConversationHistory(conversation: any): ConversationMessage[] {
        const messages = conversation.messages as ConversationMessage[] ?? [];
        return messages.slice(-MAX_HISTORY_MESSAGES);
    }

    private async appendToConversation(conversationId: string, newMessages: ConversationMessage[]): Promise<void> {
        const conversation = await this.db.studioGuideConversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation) return;

        const existing = (conversation.messages as ConversationMessage[]) ?? [];
        const updated = [...existing, ...newMessages].slice(-MAX_HISTORY_MESSAGES);

        await this.db.studioGuideConversation.update({
            where: { id: conversationId },
            data: {
                messages: updated as any,
                active: true,
            },
        });
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private splitMessage(text: string, limit = 1900): string[] {
        const chunks: string[] = [];
        let remaining = text;
        while (remaining.length > 0) {
            if (remaining.length <= limit) { chunks.push(remaining); break; }
            let split = remaining.lastIndexOf('\n', limit);
            if (split === -1) split = remaining.lastIndexOf(' ', limit);
            if (split === -1) split = limit;
            chunks.push(remaining.substring(0, split).trim());
            remaining = remaining.substring(split).trim();
        }
        return chunks;
    }
}
