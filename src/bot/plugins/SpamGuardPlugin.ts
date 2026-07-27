import {
    Client,
    Message,
    GuildMember,
    TextChannel,
    EmbedBuilder,
    Colors,
    PermissionFlagsBits,
    PermissionResolvable,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ButtonInteraction,
} from 'discord.js';
import { IPlugin, IPluginContext, IPluginRegistry } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import sharp from 'sharp';
import { R2Storage } from '../../services/R2Storage';

// ─── Perceptual Hash ─────────────────────────────────────────────────────────
// Difference hash (dHash) — 8x8 grid, 64 bits, stored as 16 hex chars.
// Two images with the same visual content will produce a near-identical hash
// even when re-uploaded with a new URL.

async function computeDHash(imageBuffer: Buffer): Promise<string> {
    // Resize to 9x8 grayscale, compute difference hash
    const raw = await sharp(imageBuffer)
        .resize(9, 8, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();

    let bits = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const left = raw[row * 9 + col];
            const right = raw[row * 9 + col + 1];
            bits += left < right ? '1' : '0';
        }
    }

    // Convert 64-bit string to 16-char hex
    let hex = '';
    for (let i = 0; i < 64; i += 4) {
        hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
}

function hammingDistance(a: string, b: string): number {
    if (a.length !== b.length) return Infinity;
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
        const bitsA = parseInt(a[i], 16).toString(2).padStart(4, '0');
        const bitsB = parseInt(b[i], 16).toString(2).padStart(4, '0');
        for (let j = 0; j < 4; j++) {
            if (bitsA[j] !== bitsB[j]) dist++;
        }
    }
    return dist;
}

// Threshold: <= 10 bits different = same image (tolerates minor compression artifacts)
const HASH_MATCH_THRESHOLD = 10;

// How long a repeat offender's alert thread stays "active" — a new trigger from the same
// user within this window replies into the existing thread instead of posting a fresh alert.
const ALERT_THREAD_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ─── In-memory rate tracking ─────────────────────────────────────────────────

interface UserActivity {
    attachmentTimes: number[];   // timestamps of attachment messages
    channelIds: Map<string, number>; // channelId -> last timestamp
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export class SpamGuardPlugin implements IPlugin {
    readonly id = 'spam-guard';
    readonly name = 'Spam Guard';
    readonly version = '1.0.0';
    readonly description = 'Stops hijacked-account spam: behavioral tripwire + perceptual image hash blocklist';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = true;

    readonly requiredPermissions: PermissionResolvable[] = [
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ManageMessages,
    ];

    readonly commands: string[] = [];
    readonly events = ['messageCreate', 'interactionCreate'];
    readonly dashboardSections = ['spam-guard'];

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
    });

    private client!: Client;
    private db!: PrismaClient;
    private logger: any;
    private plugins!: IPluginRegistry;
    private logAction!: IPluginContext['logAction'];

    // Per-guild, per-user activity tracker (cleared every hour to prevent memory leak)
    private activity: Map<string, Map<string, UserActivity>> = new Map();
    private cleanupInterval?: NodeJS.Timeout;

    // Per "guildId:userId" active alert thread, so repeat triggers consolidate into one
    // thread instead of spamming the alert channel with a new message every time.
    private activeAlertThreads: Map<string, { alertMessageId: string; threadId: string; channelId: string; lastAt: number }> = new Map();

    // Per-guild hash cache to avoid DB round-trip on every message
    private hashCache: Map<string, { hashes: string[]; loadedAt: number }> = new Map();
    private readonly HASH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // Per-guild phrase blocklist cache
    private phraseCache: Map<string, {
        phrases: { phrase: string; isRegex: boolean; caseSensitive: boolean; compiled?: RegExp }[];
        loadedAt: number;
    }> = new Map();
    private readonly PHRASE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.plugins = context.plugins;
        this.logAction = context.logAction;

        // Clean stale activity entries hourly
        this.cleanupInterval = setInterval(() => {
            const cutoff = Date.now() - 60 * 60 * 1000;
            for (const [guildId, users] of this.activity) {
                for (const [userId, activity] of users) {
                    activity.attachmentTimes = activity.attachmentTimes.filter(t => t > cutoff);
                    for (const [cId, ts] of activity.channelIds) {
                        if (ts < cutoff) activity.channelIds.delete(cId);
                    }
                    if (activity.attachmentTimes.length === 0 && activity.channelIds.size === 0) {
                        users.delete(userId);
                    }
                }
                if (users.size === 0) this.activity.delete(guildId);
            }
            for (const [key, entry] of this.activeAlertThreads) {
                if (Date.now() - entry.lastAt > ALERT_THREAD_TTL_MS) this.activeAlertThreads.delete(key);
            }
        }, 60 * 60 * 1000);

        this.logger.info('[SpamGuard] Plugin initialized');
    }

    async shutdown(): Promise<void> {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    }

    async onMessageCreate(message: Message): Promise<void> {
        if (!message.guild || message.author.bot) return;

        const guildId = message.guild.id;

        // Load settings
        const settings = await this.getSettings(guildId);
        if (!settings?.enabled) return;

        // Check exempt roles
        const member = message.member;
        if (!member) return;
        if (settings.exemptRoles.some((r: string) => member.roles.cache.has(r))) return;
        // Always exempt admins
        if (member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const now = Date.now();

        // ── Layer 0: Blocked phrase / full-message check ──────────────────────
        // Runs on every message (not just attachment messages) so admins can
        // block raw text spam like "Server nuked by team X .gg/x".
        if (message.content && message.content.trim().length > 0) {
            const matched = await this.checkBlockedPhrases(message, member, settings);
            if (matched) return;
        }

        // ── Layer 1: Behavioral tripwire ──────────────────────────────────────
        if (message.attachments.size > 0) {
            const triggered = await this.checkBehavior(message, member, settings, now);
            if (triggered) return; // already handled
        }

        // ── Layer 2: Perceptual hash check ────────────────────────────────────
        if (message.attachments.size > 0) {
            await this.checkImageHashes(message, member, settings);
        }
    }

    // ─── Button Interaction Handler ───────────────────────────────────────────

    private async disableAlertButtons(interaction: any, resolvedLabel: string): Promise<void> {
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('SPAMGUARD_RESOLVED_KICK').setLabel(resolvedLabel).setStyle(ButtonStyle.Secondary).setDisabled(true),
        );
        await interaction.message.edit({ components: [disabledRow] }).catch(() => {});
    }

    async onInteractionCreate(interaction: ButtonInteraction | any): Promise<void> {
        if (!interaction.isButton()) return;

        if (interaction.customId.startsWith('SPAMGUARD_KICK_')) {
            await this.handleKickButton(interaction);
        } else if (interaction.customId.startsWith('SPAMGUARD_UNDO_')) {
            await this.handleUndoButton(interaction);
        }
    }

    private async handleKickButton(interaction: any): Promise<void> {
        const parts = interaction.customId.split('_'); // ['SPAMGUARD', 'KICK', userId, guildId]
        const userId = parts[2];
        const guildId = parts[3];

        if (!userId || !guildId) return;

        await interaction.deferReply({ ephemeral: true });

        const REASON = 'Compromised Account - Spam Detected';

        try {
            const moderationPlugin = this.plugins.get('moderation') as any;
            if (moderationPlugin?.kickAndLog) {
                await moderationPlugin.kickAndLog(guildId, userId, interaction.user.id, REASON);
            } else {
                // Fallback: kick directly without full modlog if ModerationPlugin unavailable
                const guild = this.client.guilds.cache.get(guildId);
                const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
                if (member?.kickable) {
                    await member.kick(`[SpamGuard] ${REASON}`);
                }
            }

            await this.disableAlertButtons(interaction, `Kicked by ${interaction.user.username}`);
            await interaction.editReply({ content: `✅ <@${userId}> has been kicked. Reason: **${REASON}**\nA moderation case has been opened.`, allowedMentions: { users: [userId] } });
        } catch (err) {
            this.logger.error('[SpamGuard] Failed to kick via button', err);
            await interaction.editReply({ content: '❌ Failed to kick the user. They may have already left, or the bot lacks permission.' });
        }
    }

    // "Not Spam — Undo": reverses whatever action was taken (removes timeout / unbans —
    // a kick can't be undone since the member already left) and, if the trigger was a
    // known-hash match, removes that hash from the blocklist since it's now proven to
    // false-positive on legitimate content.
    private async handleUndoButton(interaction: any): Promise<void> {
        const incidentId = interaction.customId.replace('SPAMGUARD_UNDO_', '');
        if (!incidentId || incidentId === 'none') {
            await interaction.reply({ content: '❌ This alert has no linked incident to undo.', flags: 64 });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const incident = await this.db.spamGuardIncident.findUnique({ where: { id: incidentId } });
            if (!incident) {
                await interaction.editReply({ content: '❌ Could not find the incident for this alert.' });
                return;
            }
            if (incident.falsePositive) {
                await interaction.editReply({ content: `ℹ️ Already marked as a false positive by <@${incident.resolvedBy}>.`, allowedMentions: { users: incident.resolvedBy ? [incident.resolvedBy] : [] } });
                return;
            }

            const guild = this.client.guilds.cache.get(incident.guildId);
            const notes: string[] = [];

            if (guild) {
                if (incident.action.startsWith('timeout')) {
                    const member = await guild.members.fetch(incident.userId).catch(() => null);
                    if (member) {
                        await member.timeout(null, 'SpamGuard: marked as false positive').catch(() => {});
                        notes.push('Timeout removed.');
                    } else {
                        notes.push('User is no longer in the server — nothing to un-timeout.');
                    }
                } else if (incident.action === 'ban') {
                    await guild.members.unban(incident.userId, 'SpamGuard: marked as false positive').catch(() => {});
                    notes.push('User unbanned.');
                } else if (incident.action === 'kick') {
                    notes.push("Kick can't be undone — the user already left. They're welcome to rejoin.");
                }
            }

            if (incident.matchedHash) {
                await this.db.spamImageHash.deleteMany({ where: { guildId: incident.guildId, hash: incident.matchedHash } });
                this.invalidateHashCache(incident.guildId);
                notes.push('The matching image hash was removed from the blocklist.');
            }

            await this.db.spamGuardIncident.update({
                where: { id: incidentId },
                data: { falsePositive: true, resolvedBy: interaction.user.id, resolvedAt: new Date() },
            });

            await this.disableAlertButtons(interaction, `Marked not spam by ${interaction.user.username}`);
            await interaction.editReply({ content: `✅ Marked as a false positive.${notes.length ? '\n' + notes.join(' ') : ''}` });
        } catch (err) {
            this.logger.error('[SpamGuard] Failed to process undo button', err);
            await interaction.editReply({ content: '❌ Failed to undo — check the logs.' }).catch(() => {});
        }
    }

    // ─── Blocked Phrase Check ─────────────────────────────────────────────────

    private async checkBlockedPhrases(
        message: Message,
        member: GuildMember,
        settings: any,
    ): Promise<boolean> {
        const guildId = message.guild!.id;
        const phrases = await this.getPhraseCache(guildId);
        if (phrases.length === 0) return false;

        const content = message.content;
        const contentLower = content.toLowerCase();

        for (const entry of phrases) {
            let hit = false;
            if (entry.isRegex) {
                if (entry.compiled) {
                    try { hit = entry.compiled.test(content); } catch { hit = false; }
                }
            } else if (entry.caseSensitive) {
                hit = content.includes(entry.phrase);
            } else {
                hit = contentLower.includes(entry.phrase.toLowerCase());
            }

            if (hit) {
                // Increment hit count in background
                this.db.spamBlockedPhrase.updateMany({
                    where: { guildId, phrase: entry.phrase },
                    data: { hitCount: { increment: 1 } },
                }).catch((err: any) => this.logger.error('[SpamGuard] Failed to increment phrase hit count', err));

                await this.handleViolation(message, member, settings, 'blocked_phrase', [message.id]);
                return true;
            }
        }
        return false;
    }

    // ─── Behavioral Check ─────────────────────────────────────────────────────

    private async checkBehavior(
        message: Message,
        member: GuildMember,
        settings: any,
        now: number,
    ): Promise<boolean> {
        const guildId = message.guild!.id;
        const userId = member.id;

        if (!this.activity.has(guildId)) this.activity.set(guildId, new Map());
        const guildActivity = this.activity.get(guildId)!;

        if (!guildActivity.has(userId)) {
            guildActivity.set(userId, { attachmentTimes: [], channelIds: new Map() });
        }
        const ua = guildActivity.get(userId)!;

        const attachWindowMs = settings.attachmentWindowSec * 1000;
        const channelWindowMs = settings.channelSpreadWindowSec * 1000;

        // Record this message
        ua.attachmentTimes.push(now);
        ua.channelIds.set(message.channelId, now);

        // Prune old entries
        ua.attachmentTimes = ua.attachmentTimes.filter(t => now - t < attachWindowMs);
        for (const [cId, ts] of ua.channelIds) {
            if (now - ts > channelWindowMs) ua.channelIds.delete(cId);
        }

        const attachCount = ua.attachmentTimes.length;
        const channelCount = ua.channelIds.size;

        let triggerType: string | null = null;
        if (attachCount >= settings.attachmentLimit) {
            triggerType = 'attachment_flood';
        } else if (channelCount >= settings.channelSpreadLimit) {
            triggerType = 'channel_spread';
        }

        if (!triggerType) return false;

        // Reset tracker so we don't double-trigger
        guildActivity.delete(userId);

        await this.handleViolation(message, member, settings, triggerType, [message.id]);
        return true;
    }

    // ─── Image Hash Check ─────────────────────────────────────────────────────

    private async checkImageHashes(
        message: Message,
        member: GuildMember,
        settings: any,
    ): Promise<void> {
        const guildId = message.guild!.id;
        const blockedHashes = await this.getHashCache(guildId);
        if (blockedHashes.length === 0) return;

        const imageAttachments = [...message.attachments.values()].filter(a =>
            a.contentType?.startsWith('image/'),
        );
        if (imageAttachments.length === 0) return;

        for (const attachment of imageAttachments) {
            try {
                const response = await axios.get(attachment.url, {
                    responseType: 'arraybuffer',
                    timeout: 5000,
                    maxContentLength: 8 * 1024 * 1024, // 8MB max
                });
                const buf = Buffer.from(response.data);
                const hash = await computeDHash(buf);

                for (const blocked of blockedHashes) {
                    if (hammingDistance(hash, blocked) <= HASH_MATCH_THRESHOLD) {
                        // Increment hit count in background
                        this.db.spamImageHash.updateMany({
                            where: { guildId, hash: blocked },
                            data: { hitCount: { increment: 1 } },
                        }).catch((err: any) => this.logger.error('[SpamGuard] Failed to increment hash hit count', err));

                        await this.handleViolation(message, member, settings, 'known_hash', [message.id], blocked);
                        return;
                    }
                }
            } catch {
                // Ignore download / processing errors — don't block legitimate messages
            }
        }
    }

    // ─── Violation Handler ────────────────────────────────────────────────────

    private async handleViolation(
        message: Message,
        member: GuildMember,
        settings: any,
        triggerType: string,
        messageIds: string[],
        matchedHash?: string,
    ): Promise<void> {
        const guild = message.guild!;
        const guildId = guild.id;

        const triggerLabels: Record<string, string> = {
            attachment_flood: 'Attachment flood',
            channel_spread: 'Multi-channel spam',
            known_hash: 'Known spam image',
            blocked_phrase: 'Blocked phrase / message',
        };

        let actionTaken = 'deleted_messages';

        // Grab the flagged image(s) BEFORE deleting the message — once the message is gone
        // the CDN URL stops resolving and there is no way to see what actually triggered the
        // detection after the fact (this is exactly why a past "Known spam image" incident
        // couldn't be diagnosed). Re-uploaded as fresh attachments on the alert embed below so
        // they survive independently of the original (deleted) message.
        const imageAttachments = [...message.attachments.values()].filter(a => a.contentType?.startsWith('image/'));
        const previewFiles: { name: string; attachment: Buffer }[] = [];
        // Durable copies for the audit log — the Discord alert message above can itself be
        // deleted/archived, but R2 URLs keep working independently of any Discord message.
        const imageUrls: string[] = [];
        for (const [i, att] of imageAttachments.slice(0, 3).entries()) {
            try {
                const res = await axios.get(att.url, { responseType: 'arraybuffer', timeout: 5000, maxContentLength: 8 * 1024 * 1024 });
                const buf = Buffer.from(res.data);
                const ext = att.name?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
                const fileName = `spam-preview-${i}.${ext}`;
                previewFiles.push({ name: fileName, attachment: buf });

                if (R2Storage.isConfigured()) {
                    try {
                        const key = R2Storage.buildKey('spam-guard', `${guildId}-${message.id}`, fileName);
                        const url = await R2Storage.uploadBuffer(key, buf, att.contentType || 'image/png');
                        imageUrls.push(url);
                    } catch (err) {
                        this.logger.error('[SpamGuard] Failed to archive image to R2', err);
                    }
                }
            } catch { /* image gone or unfetchable — alert still sends without it */ }
        }

        // Delete offending messages
        try {
            if (message.deletable) await message.delete();
        } catch { /* ignore */ }

        // Take configured action
        if (settings.action !== 'delete_only') {
            try {
                if (settings.action === 'timeout') {
                    const until = new Date(Date.now() + settings.timeoutMinutes * 60 * 1000);
                    if (member.moderatable) {
                        await member.timeout(settings.timeoutMinutes * 60 * 1000, `[SpamGuard] ${triggerLabels[triggerType]}`);
                        actionTaken = `timeout_${settings.timeoutMinutes}m`;
                    }
                } else if (settings.action === 'kick') {
                    if (member.kickable) {
                        await member.kick(`[SpamGuard] ${triggerLabels[triggerType]}`);
                        actionTaken = 'kick';
                    }
                } else if (settings.action === 'ban') {
                    if (member.bannable) {
                        await guild.members.ban(member.id, {
                            reason: `[SpamGuard] ${triggerLabels[triggerType]}`,
                            deleteMessageSeconds: 60 * 60, // Delete last 1 hour of messages
                        });
                        actionTaken = 'ban';
                    }
                }
            } catch (err) {
                this.logger.error(`[SpamGuard] Failed to take action on ${member.user.tag}`, err);
            }
        }

        // Log incident — created before the alert is sent so the alert's buttons can
        // reference incident.id (the "Not Spam" undo button needs it to look up what to reverse).
        let incidentId: string | null = null;
        try {
            const incident = await this.db.spamGuardIncident.create({
                data: {
                    guildId,
                    userId: member.id,
                    username: member.user.tag,
                    triggerType,
                    action: actionTaken,
                    channelId: message.channelId,
                    messageIds,
                    details: triggerLabels[triggerType],
                    matchedHash: matchedHash || null,
                },
            });
            incidentId = incident.id;
        } catch (err) {
            this.logger.error('[SpamGuard] Failed to log incident', err);
        }

        // Also record to the shared audit log (dashboard → Logs) so spam triggers show up
        // alongside every other moderation action, with the flagged image(s) attached.
        try {
            await this.logAction({
                guildId,
                actionType: 'spam_detected',
                executorId: member.id,
                targetId: message.channelId,
                details: {
                    triggerType,
                    triggerLabel: triggerLabels[triggerType] ?? triggerType,
                    action: actionTaken,
                    username: member.user.tag,
                    channelId: message.channelId,
                    messageIds,
                    imageUrls,
                },
            });
        } catch (err) {
            this.logger.error('[SpamGuard] Failed to write audit log entry', err);
        }

        // Send alert to mod channel — repeat triggers from the same user within
        // ALERT_THREAD_TTL_MS consolidate into one thread instead of a new message each time.
        if (settings.alertChannelId) {
            try {
                const alertChannel = guild.channels.cache.get(settings.alertChannelId) as TextChannel | undefined;
                if (alertChannel?.isTextBased()) {
                    const threadKey = `${guildId}:${member.id}`;
                    const existing = this.activeAlertThreads.get(threadKey);
                    const stillActive = existing && Date.now() - existing.lastAt < ALERT_THREAD_TTL_MS;

                    if (stillActive) {
                        // Reply into the existing thread instead of posting a new alert message.
                        try {
                            const thread = await this.client.channels.fetch(existing!.threadId).catch(() => null);
                            if (thread?.isTextBased()) {
                                const followUp = new EmbedBuilder()
                                    .setColor(Colors.Red)
                                    .setDescription(`🚨 **Triggered again** — ${triggerLabels[triggerType] ?? triggerType} · ${actionTaken.replace(/_/g, ' ')} · <#${message.channelId}>`)
                                    .setTimestamp();
                                if (previewFiles.length > 0) followUp.setImage(`attachment://${previewFiles[0].name}`);
                                await (thread as TextChannel).send({ embeds: [followUp], files: previewFiles });
                                existing!.lastAt = Date.now();
                                if (incidentId) {
                                    await this.db.spamGuardIncident.update({
                                        where: { id: incidentId },
                                        data: { alertMessageId: existing!.alertMessageId, alertThreadId: existing!.threadId },
                                    }).catch(() => {});
                                }
                            }
                        } catch (err) {
                            this.logger.error('[SpamGuard] Failed to post into existing alert thread', err);
                        }
                    } else {
                        const embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('🚨 SpamGuard — Spam Detected')
                            .addFields(
                                { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
                                { name: 'Trigger', value: triggerLabels[triggerType] ?? triggerType, inline: true },
                                { name: 'Action', value: actionTaken.replace(/_/g, ' '), inline: true },
                                { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
                            )
                            .setTimestamp()
                            .setFooter({ text: 'SpamGuard' });

                        if (previewFiles.length > 0) {
                            embed.setImage(`attachment://${previewFiles[0].name}`);
                            if (previewFiles.length > 1) {
                                embed.addFields({ name: 'Images', value: `${previewFiles.length} attached below`, inline: true });
                            }
                        }

                        const kickBtn = new ButtonBuilder()
                            .setCustomId(`SPAMGUARD_KICK_${member.id}_${guildId}`)
                            .setLabel('Kick — Compromised Account')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔴');
                        const undoBtn = new ButtonBuilder()
                            .setCustomId(`SPAMGUARD_UNDO_${incidentId ?? 'none'}`)
                            .setLabel('Not Spam — Undo')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('✅')
                            .setDisabled(!incidentId);

                        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(kickBtn, undoBtn);
                        const sent = await alertChannel.send({ embeds: [embed], components: [row], files: previewFiles });

                        // Start a thread on this message so any repeat trigger has somewhere to go.
                        let threadId: string | null = null;
                        try {
                            const thread = await sent.startThread({
                                name: `Spam: ${member.user.username}`.slice(0, 100),
                                autoArchiveDuration: 1440,
                                reason: 'SpamGuard: consolidating repeat triggers',
                            });
                            threadId = thread.id;
                            this.activeAlertThreads.set(threadKey, { alertMessageId: sent.id, threadId: thread.id, channelId: alertChannel.id, lastAt: Date.now() });
                        } catch (err) {
                            this.logger.error('[SpamGuard] Failed to start alert thread', err);
                        }

                        if (incidentId) {
                            await this.db.spamGuardIncident.update({
                                where: { id: incidentId },
                                data: { alertMessageId: sent.id, alertThreadId: threadId },
                            }).catch(() => {});
                        }
                    }
                }
            } catch { /* ignore alert failures */ }
        }

        this.logger.info(`[SpamGuard] ${triggerType} by ${member.user.tag} in ${guildId} → ${actionTaken}`);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async getSettings(guildId: string): Promise<any> {
        try {
            let settings = await this.db.spamGuardSettings.findUnique({ where: { guildId } });
            if (!settings) {
                await this.db.guild.upsert({
                    where: { id: guildId },
                    update: {},
                    create: { id: guildId, name: 'Unknown' },
                });
                settings = await this.db.spamGuardSettings.create({
                    data: { guildId },
                });
            }
            return settings;
        } catch {
            return null;
        }
    }

    private async getHashCache(guildId: string): Promise<string[]> {
        const cached = this.hashCache.get(guildId);
        if (cached && Date.now() - cached.loadedAt < this.HASH_CACHE_TTL) {
            return cached.hashes;
        }

        try {
            const hashes = await this.db.spamImageHash.findMany({
                where: { guildId },
                select: { hash: true },
            });
            const hashList = hashes.map((h: { hash: string }) => h.hash);
            this.hashCache.set(guildId, { hashes: hashList, loadedAt: Date.now() });
            return hashList;
        } catch {
            return [];
        }
    }

    // Called by API when a new hash is added, to flush the cache
    invalidateHashCache(guildId: string): void {
        this.hashCache.delete(guildId);
    }

    private async getPhraseCache(guildId: string): Promise<
        { phrase: string; isRegex: boolean; caseSensitive: boolean; compiled?: RegExp }[]
    > {
        const cached = this.phraseCache.get(guildId);
        if (cached && Date.now() - cached.loadedAt < this.PHRASE_CACHE_TTL) {
            return cached.phrases;
        }

        try {
            const rows = await this.db.spamBlockedPhrase.findMany({
                where: { guildId },
                select: { phrase: true, isRegex: true, caseSensitive: true },
            });
            const phrases = rows.map((r: { phrase: string; isRegex: boolean; caseSensitive: boolean }) => {
                let compiled: RegExp | undefined;
                if (r.isRegex) {
                    try {
                        compiled = new RegExp(r.phrase, r.caseSensitive ? '' : 'i');
                    } catch {
                        compiled = undefined;
                    }
                }
                return { phrase: r.phrase, isRegex: r.isRegex, caseSensitive: r.caseSensitive, compiled };
            });
            this.phraseCache.set(guildId, { phrases, loadedAt: Date.now() });
            return phrases;
        } catch {
            return [];
        }
    }

    // Called by API when a phrase is added/removed, to flush the cache
    invalidatePhraseCache(guildId: string): void {
        this.phraseCache.delete(guildId);
    }
}
