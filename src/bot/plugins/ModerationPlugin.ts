import { 
    Client, 
    ChatInputCommandInteraction, 
    GuildMember, 
    GuildBan,
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    TextChannel,
    ForumChannel,
    Colors,
    MessageFlags,
    ChannelType,
    AuditLogEvent,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ButtonInteraction,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export class ModerationPlugin implements IPlugin {
    readonly id = 'moderation';
    readonly name = 'Moderation System';
    readonly version = '1.0.0';
    readonly description = 'Comprehensive moderation tools with logging';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ManageMessages
    ];

    readonly commands = ['kick', 'ban', 'timeout', 'warn', 'warnings', 'purge', 'remove', 'modlog'];
    readonly events = ['interactionCreate', 'guildBanAdd', 'guildBanRemove', 'guildMemberRemove'];
    readonly dashboardSections = ['moderation'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
        logChannel: z.string().optional(),
    });

    private client!: Client;
    private db!: PrismaClient;
    private logger: any;
    private taskInterval?: NodeJS.Timeout;

    // Track actions performed by the bot's slash commands to avoid double-logging
    private recentBotActions = new Set<string>();

    // In-memory store for pending /remove review requests
    private pendingRemovals = new Map<string, {
        guildId: string;
        channelId: string;
        messageId: string;
        messageContent: string;
        attachmentUrls: string[];
        authorId: string;
        authorTag: string;
        authorUsername: string;
        authorAvatar: string | null;
        requestorId: string;
        reason: string;
        reviewChannelId: string;
        reviewMessageId: string;
    }>();

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.logger.info('Moderation Plugin initialized');
        
        // Ensure settings exist for all guilds
        this.initializeSettings();
        
        // Start scheduler
        this.startTaskProcessor();
    }

    private async initializeSettings() {
        const guilds = this.client.guilds.cache;
        for (const [id] of guilds) {
            try {
                const exists = await this.db.moderationSettings.findUnique({ where: { guildId: id } });
                if (!exists) {
                    await this.db.moderationSettings.create({
                        data: { guildId: id }
                    });
                }
            } catch (e) {
                this.logger.error(`Failed to init mod settings for ${id}`, e);
            }
        }
    }

    private startTaskProcessor() {
        // Run immediately then interval
        this.processScheduledTasks();
        this.taskInterval = setInterval(() => this.processScheduledTasks(), 60 * 1000);
    }

    private async processScheduledTasks() {
        try {
            const now = new Date();
            const tasks = await this.db.scheduledTask.findMany({
                where: { executeAt: { lte: now } }
            });

            for (const task of tasks) {
                if (task.type === 'unban') {
                    const guild = this.client.guilds.cache.get(task.guildId);
                    if (guild) {
                        try {
                            const reason = (task.data as any)?.reason || 'Ban duration expired';
                            await guild.members.unban(task.targetId, reason);
                            this.logger.info(`Auto-unbanned ${task.targetId} in ${task.guildId}`);
                        } catch (e) {
                            this.logger.error(`Failed to auto-unban ${task.targetId} in ${task.guildId}`, e);
                        }
                    }
                }
                // Always delete processed task
                await this.db.scheduledTask.delete({ where: { id: task.id } });
            }
        } catch (error) {
            this.logger.error('Error processing scheduled tasks', error);
        }
    }

    async shutdown(): Promise<void> {
        if (this.taskInterval) clearInterval(this.taskInterval);
    }

    // ─── Native Discord event handlers (bans/kicks done outside the bot) ────────

    /**
     * Fires when someone is banned via Discord's native UI or another bot.
     * Checks the audit log to find executor + reason, skips if the bot did it.
     */
    async onGuildBanAdd(ban: GuildBan): Promise<void> {
        const guildId = ban.guild.id;
        const targetId = ban.user.id;

        // Skip if the bot performed this ban via slash command
        if (this.recentBotActions.has(`ban:${guildId}:${targetId}`)) return;

        try {
            // Small delay to let the audit log populate
            await new Promise(r => setTimeout(r, 1500));

            const auditLogs = await ban.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanAdd,
                limit: 5,
            });

            const entry = auditLogs.entries.find(e =>
                e.targetId === targetId && Date.now() - e.createdTimestamp < 15_000
            );

            const executorId = entry?.executorId || 'Unknown';
            const reason = entry?.reason || ban.reason || 'No reason provided';

            // Skip if the bot itself was the executor (slash command)
            if (executorId === this.client.user?.id) return;

            this.logger.info(`[NativeMod] Ban detected: ${ban.user.tag} by ${executorId}`);
            await this.logAction(guildId, 'ban', executorId, targetId, {
                reason,
                duration: 'Permanent',
                source: 'Discord native',
            });
        } catch (e) {
            this.logger.error('Error handling native ban event', e);
        }
    }

    /**
     * Fires when someone is unbanned via Discord's native UI.
     */
    async onGuildBanRemove(ban: GuildBan): Promise<void> {
        const guildId = ban.guild.id;
        const targetId = ban.user.id;

        try {
            await new Promise(r => setTimeout(r, 1500));

            const auditLogs = await ban.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanRemove,
                limit: 5,
            });

            const entry = auditLogs.entries.find(e =>
                e.targetId === targetId && Date.now() - e.createdTimestamp < 15_000
            );

            const executorId = entry?.executorId || 'Unknown';
            const reason = entry?.reason || 'No reason provided';

            // Skip bot auto-unbans (scheduled tasks)
            if (executorId === this.client.user?.id) return;

            this.logger.info(`[NativeMod] Unban detected: ${ban.user.tag} by ${executorId}`);
            await this.logAction(guildId, 'unban', executorId, targetId, {
                reason,
                source: 'Discord native',
            });
        } catch (e) {
            this.logger.error('Error handling native unban event', e);
        }
    }

    /**
     * Fires when a member leaves or is kicked. We check the audit log to
     * distinguish a kick from a voluntary leave — only log if it was a kick.
     */
    async onGuildMemberRemove(member: GuildMember): Promise<void> {
        const guildId = member.guild.id;
        const targetId = member.id;

        // Skip if the bot performed this kick via slash command
        if (this.recentBotActions.has(`kick:${guildId}:${targetId}`)) return;

        try {
            // Small delay to let the audit log populate
            await new Promise(r => setTimeout(r, 1500));

            const auditLogs = await member.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberKick,
                limit: 5,
            });

            const entry = auditLogs.entries.find(e =>
                e.targetId === targetId && Date.now() - e.createdTimestamp < 15_000
            );

            // No recent kick audit entry = user left voluntarily, not a kick
            if (!entry) return;

            const executorId = entry.executorId || 'Unknown';
            const reason = entry.reason || 'No reason provided';

            // Skip if the bot itself did the kick
            if (executorId === this.client.user?.id) return;

            this.logger.info(`[NativeMod] Kick detected: ${member.user.tag} by ${executorId}`);
            await this.logAction(guildId, 'kick', executorId, targetId, {
                reason,
                source: 'Discord native',
            });
        } catch (e) {
            this.logger.error('Error handling native kick event', e);
        }
    }

    // Event Handler
    async onInteractionCreate(interaction: ChatInputCommandInteraction | ButtonInteraction | any): Promise<void> {
        // Handle review approval/denial buttons
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('MOD_RM_APPROVE_')) {
                const key = interaction.customId.slice('MOD_RM_APPROVE_'.length);
                await this.handleRemoveApprove(interaction, key);
                return;
            }
            if (interaction.customId.startsWith('MOD_RM_DENY_')) {
                const key = interaction.customId.slice('MOD_RM_DENY_'.length);
                await this.handleRemoveDeny(interaction, key);
                return;
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        // Route commands
        switch (interaction.commandName) {
            case 'kick': await this.handleKick(interaction); break;
            case 'ban': await this.handleBan(interaction); break;
            case 'timeout': await this.handleTimeout(interaction); break;
            case 'purge': await this.handlePurge(interaction); break;
            case 'remove': await this.handleRemove(interaction); break;
            case 'warn': await this.handleWarn(interaction); break;
            case 'warnings': await this.handleWarnings(interaction); break;
        }
    }

    // --- Permission Check ---

    /**
     * Checks whether the invoking member is allowed to run a moderation command.
     * Allows if:
     *   1. Member has the Administrator native Discord permission, OR
     *   2. Member has the relevant native Discord permission for that action, OR
     *   3. Member has a custom ModerationPermission row (from the dashboard) with the flag set to true.
     *
     * This is the single source of truth for moderation access. Do NOT use
     * setDefaultMemberPermissions on the command builders — that would bypass this check.
     */
    private async checkModerationAccess(
        interaction: ChatInputCommandInteraction,
        flag: 'canWarn' | 'canKick' | 'canBan' | 'canTimeout' | 'canPurge' | 'canRemove' | 'canViewLogs'
    ): Promise<boolean> {
        const member = interaction.member as GuildMember;
        if (!member) return false;

        // Administrators always have access
        if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

        // Native Discord permission shortcuts (for existing server roles that already have these)
        const nativeMap: Record<typeof flag, bigint> = {
            canKick:     PermissionFlagsBits.KickMembers,
            canBan:      PermissionFlagsBits.BanMembers,
            canTimeout:  PermissionFlagsBits.ModerateMembers,
            canPurge:    PermissionFlagsBits.ManageMessages,
            canRemove:   PermissionFlagsBits.ManageMessages,
            canWarn:     PermissionFlagsBits.KickMembers,
            canViewLogs: PermissionFlagsBits.ViewAuditLog,
        };
        if (member.permissions.has(nativeMap[flag])) return true;

        // Custom dashboard permissions stored in DB
        try {
            const settings = await this.db.moderationSettings.findUnique({
                where: { guildId: interaction.guildId! },
                include: { permissions: true },
            });
            if (!settings?.permissions?.length) return false;
            const memberRoleIds = member.roles.cache.map(r => r.id);
            return settings.permissions.some(
                perm => memberRoleIds.includes(perm.roleId) && perm[flag] === true
            );
        } catch (e) {
            this.logger.error('Failed to check moderation permissions', e);
            return false;
        }
    }

    // --- Commands ---

    private async sendDM(guildId: string, member: GuildMember, action: 'kick' | 'ban' | 'timeout', reason: string, duration?: string) {
        try {
            const settings = await this.db.moderationSettings.findUnique({ where: { guildId } });
            if (!settings || !settings.dmUponAction) return;

            let messageTemplate = '';
            switch (action) {
                case 'kick': messageTemplate = settings.kickMessage || 'You were kicked from **{server}** for: {reason}'; break;
                case 'ban': messageTemplate = settings.banMessage || 'You were banned from **{server}** for: {reason}'; break;
                case 'timeout': messageTemplate = settings.timeoutMessage || 'You were timed out in **{server}** for {duration}. Reason: {reason}'; break;
            }

            let message = messageTemplate
                .replace(/{server}/g, member.guild.name)
                .replace(/{user}/g, member.user.tag)
                .replace(/{reason}/g, reason)
                .replace(/{duration}/g, duration || '');

            if (action === 'ban' || action === 'kick') {
                message += '\n\nYou can appeal this action by visiting: https://fujistud.io/appeal';
            }

            await member.send({ content: message }).catch(() => {});
        } catch (e) {
            // Ignore DM failures (user might have DMs closed)
        }
    }

    private async handleKick(interaction: ChatInputCommandInteraction) {
        if (!await this.checkModerationAccess(interaction, 'canKick')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }
        const target = interaction.options.getMember('user') as GuildMember;
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        if (!target) {
            return interaction.reply({ content: 'User not found.', flags: MessageFlags.Ephemeral });
        }

        // Basic self-check permissions
        if (!target.kickable) {
            return interaction.reply({ content: 'I cannot kick this user (missing permissions or target has higher role).', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // Send DM before action
            await this.sendDM(interaction.guildId!, target, 'kick', reason);

            await target.kick(reason);
            
            // Mark as bot-initiated so guildMemberRemove handler skips it
            this.recentBotActions.add(`kick:${interaction.guildId}:${target.id}`);
            setTimeout(() => this.recentBotActions.delete(`kick:${interaction.guildId}:${target.id}`), 10_000);

            // Log & Reply
            await this.logAction(interaction.guildId!, 'kick', interaction.user.id, target.id, { reason });

            // Delete messages if requested (after logging so the messages are preserved in the log)
            const deleteCount = interaction.options.getInteger('messages');
            let deletedCount = 0;
            if (deleteCount && deleteCount > 0) {
                deletedCount = await this.deleteUserMessages(interaction.guildId!, target.id, deleteCount);
            }
            
            const deleteInfo = deletedCount > 0 ? ` Deleted ${deletedCount} message(s).` : '';
            await interaction.editReply({ 
                content: `👢 **${target.user.tag}** was kicked. Reason: ${reason}${deleteInfo}`,
            });

        } catch (error) {
            this.logger.error('Kick failed', error);
            await interaction.editReply({ content: 'Kick failed due to an error.' });
        }
    }

    private async handleBan(interaction: ChatInputCommandInteraction) {
        if (!await this.checkModerationAccess(interaction, 'canBan')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }
         const targetMember = interaction.options.getMember('user') as GuildMember;
         const user = interaction.options.getUser('user'); 
         const reason = interaction.options.getString('reason') || 'No reason provided';
         const durationStr = interaction.options.getString('duration');
         
         if (!user) return interaction.reply({ content: 'User not found', flags: MessageFlags.Ephemeral });

         // If member object exists, check permissions
         if (targetMember && !targetMember.bannable) return interaction.reply({ content: 'Cannot ban user (higher role or missing permissions).', flags: MessageFlags.Ephemeral });

         // Parse duration before deferring so we can reply with validation errors
         let unbanDate: Date | null = null;
         if (durationStr) {
             const ms = this.parseDuration(durationStr);
             if (!ms) {
                 return interaction.reply({ content: 'Invalid duration. Use 1d, 24h, 30m etc.', flags: MessageFlags.Ephemeral });
             }
             unbanDate = new Date(Date.now() + ms);
         }

         await interaction.deferReply({ flags: MessageFlags.Ephemeral });

         try {
             // Send DM if member is present
             if (targetMember) {
                 await this.sendDM(interaction.guildId!, targetMember, 'ban', reason, durationStr || undefined);
             }

             await interaction.guild!.members.ban(user, { reason });

             // Mark as bot-initiated so guildBanAdd handler skips it
             this.recentBotActions.add(`ban:${interaction.guildId}:${user.id}`);
             setTimeout(() => this.recentBotActions.delete(`ban:${interaction.guildId}:${user.id}`), 10_000);

             if (unbanDate) {
                 await this.db.scheduledTask.create({
                     data: {
                         guildId: interaction.guildId!,
                         type: 'unban',
                         targetId: user.id,
                         executeAt: unbanDate,
                         data: { reason: 'Ban duration expired' }
                     }
                 });
             }

             await this.logAction(interaction.guildId!, 'ban', interaction.user.id, user.id, { reason, duration: durationStr || 'Permanent' });

             // Delete messages if requested (after logging so the messages are preserved in the log)
             const deleteCount = interaction.options.getInteger('messages');
             let deletedCount = 0;
             if (deleteCount && deleteCount > 0) {
                 deletedCount = await this.deleteUserMessages(interaction.guildId!, user.id, deleteCount);
             }

             const deleteInfo = deletedCount > 0 ? ` Deleted ${deletedCount} message(s).` : '';
             const msg = durationStr 
                ? `🔨 **${user.tag}** was banned for ${durationStr}. Reason: ${reason}${deleteInfo}`
                : `🔨 **${user.tag}** was banned permanently. Reason: ${reason}${deleteInfo}`;
             await interaction.editReply({ content: msg });
         } catch (e) {
             this.logger.error('Ban failed', e);
             await interaction.editReply({ content: 'Ban failed.' });
         }
    }

    private async handleTimeout(interaction: ChatInputCommandInteraction) {
        if (!await this.checkModerationAccess(interaction, 'canTimeout')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }
        const target = interaction.options.getMember('user') as GuildMember;
        const durationStr = interaction.options.getString('duration') || '5m';
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const notify = interaction.options.getBoolean('notify') ?? true;

        if (!target) return interaction.reply({ content: 'User not found', flags: MessageFlags.Ephemeral });
        if (!target.moderatable) return interaction.reply({ content: 'Cannot timeout user.', flags: MessageFlags.Ephemeral });

        const ms = this.parseDuration(durationStr);
        if (!ms) return interaction.reply({ content: 'Invalid duration. Use formats like `10m`, `1h`, `1d`, `7d`.', flags: MessageFlags.Ephemeral });

        const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord max: 28 days
        if (ms > MAX_TIMEOUT_MS) return interaction.reply({ content: 'Duration cannot exceed 28 days.', flags: MessageFlags.Ephemeral });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (notify) await this.sendDM(interaction.guildId!, target, 'timeout', reason, durationStr);
            await target.timeout(ms, reason);
            await this.logAction(interaction.guildId!, 'timeout', interaction.user.id, target.id, { reason, duration: durationStr, notified: notify });
            await interaction.editReply({ content: `⏳ **${target.user.tag}** timed out for ${durationStr}${notify ? '' : ' (not notified)'}. Reason: ${reason}` });
        } catch (e) {
            this.logger.error('Timeout failed', e);
            await interaction.editReply({ content: 'Timeout failed.' });
        }
    }

    private async handlePurge(interaction: ChatInputCommandInteraction) {
        if (!await this.checkModerationAccess(interaction, 'canPurge')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }
        const amount = interaction.options.getInteger('amount');
        if (!amount || amount < 1 || amount > 100) {
            return interaction.reply({ content: 'Amount must be between 1 and 100.', flags: MessageFlags.Ephemeral });
        }

        const targetUser = interaction.options.getUser('user');
        // Discord's user picker only lists current members, so anyone kicked or gone can
        // only be named by ID or by the username left on their messages.
        const targetText = interaction.options.getString('user_id')?.trim() ?? null;
        const pickedChannel = interaction.options.getChannel('channel');
        const allChannels = interaction.options.getBoolean('all_channels') ?? false;

        if (pickedChannel && allChannels) {
            return interaction.reply({ content: 'Choose a channel or all channels, not both.', flags: MessageFlags.Ephemeral });
        }
        if (targetUser && targetText) {
            return interaction.reply({ content: 'Use either `user` or `user_id`, not both.', flags: MessageFlags.Ephemeral });
        }

        const textId = targetText && /^\d{15,25}$/.test(targetText.replace(/[<@!>]/g, ''))
            ? targetText.replace(/[<@!>]/g, '')
            : null;
        const textName = targetText && !textId ? targetText.replace(/^@/, '').toLowerCase() : null;
        const filtering = !!(targetUser || targetText);
        /** Matches the author of a message against whichever way the user was named. */
        const isTarget = (m: any): boolean => {
            if (targetUser) return m.author.id === targetUser.id;
            if (textId) return m.author.id === textId;
            if (textName) {
                return m.author.username?.toLowerCase() === textName
                    || m.author.globalName?.toLowerCase() === textName
                    || m.author.tag?.toLowerCase() === textName;
            }
            return true;
        };

        // Work out which channels to search.
        const guild = interaction.guild!;
        const me = guild.members.me;
        const usable = (c: any): boolean => {
            if (!c?.isTextBased?.() || c.isVoiceBased?.()) return false;
            const perms = me && c.permissionsFor(me);
            return !!perms?.has(PermissionFlagsBits.ViewChannel)
                && !!perms?.has(PermissionFlagsBits.ReadMessageHistory)
                && !!perms?.has(PermissionFlagsBits.ManageMessages);
        };

        let channels: TextChannel[];
        if (allChannels) {
            // Newest activity first, so "the last N messages" means the most recent ones
            // server-wide rather than wherever the channel cache happens to start.
            channels = [...guild.channels.cache.values()]
                .filter(usable)
                .sort((a: any, b: any) => (b.lastMessageId ?? '0').localeCompare(a.lastMessageId ?? '0')) as TextChannel[];
        } else {
            const one = (pickedChannel ?? interaction.channel) as any;
            if (!usable(one)) {
                return interaction.reply({
                    content: pickedChannel
                        ? 'I can’t read or manage messages in that channel.'
                        : 'I can’t manage messages in this channel.',
                    flags: MessageFlags.Ephemeral,
                });
            }
            channels = [one as TextChannel];
        }
        if (channels.length === 0) {
            return interaction.reply({ content: 'There are no channels here I can manage messages in.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Discord refuses to bulk delete anything older than 14 days.
        const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
        let remaining = amount;
        let totalDeleted = 0;
        let tooOld = 0;
        const perChannel: string[] = [];

        for (const channel of channels) {
            if (remaining <= 0) break;
            try {
                // With a user filter we have to look past their messages to find them, so
                // always scan a full page and pick out the ones that match.
                const fetchLimit = filtering ? 100 : Math.min(remaining, 100);
                const recent = await channel.messages.fetch({ limit: fetchLimit });
                const matching = [...recent.values()]
                    .filter(isTarget)
                    .filter(m => !m.pinned);
                const deletable = matching.filter(m => m.createdTimestamp > cutoff).slice(0, remaining);
                tooOld += matching.filter(m => m.createdTimestamp <= cutoff).length;
                if (deletable.length === 0) continue;

                // bulkDelete needs at least two messages; a single one is deleted on its own.
                if (deletable.length === 1) await deletable[0].delete();
                else await channel.bulkDelete(deletable, true);

                remaining -= deletable.length;
                totalDeleted += deletable.length;
                perChannel.push(`#${channel.name}: ${deletable.length}`);
            } catch (e: any) {
                this.logger.warn(`Purge failed in #${(channel as any).name}: ${e?.message}`);
            }
        }

        await this.logAction(interaction.guildId!, 'purge', interaction.user.id, targetUser?.id ?? textId ?? channels[0].id, {
            amount: totalDeleted,
            requested: amount,
            user: targetUser?.tag ?? targetText ?? 'everyone',
            scope: allChannels ? 'all channels' : `#${channels[0].name}`,
        });

        const label = targetUser?.tag ?? targetText;
        const who = label ? `**${label}**’s messages` : 'messages';
        const where = allChannels ? 'across all channels' : `in <#${channels[0].id}>`;
        const lines = [
            totalDeleted > 0
                ? `Deleted **${totalDeleted}** ${who} ${where}.`
                : `No ${who} found to delete ${where}.`,
        ];
        if (allChannels && perChannel.length > 1) lines.push(perChannel.join(' · '));
        if (totalDeleted < amount && tooOld > 0) lines.push(`${tooOld} were older than 14 days — Discord won’t let bots delete those.`);
        if (totalDeleted === 0 && textName) {
            lines.push('Usernames must match exactly. Their user ID is more reliable — turn on Developer Mode, right-click them on a message and Copy User ID.');
        }

        await interaction.editReply({ content: lines.join('\n') });
    }

    // --- Helpers ---

    private async handleWarn(interaction: ChatInputCommandInteraction) {
        if (!await this.checkModerationAccess(interaction, 'canWarn')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }
        const target = interaction.options.getMember('user') as GuildMember;
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!user) return interaction.reply({ content: 'User not found.', flags: MessageFlags.Ephemeral });

        const guildId = interaction.guildId!;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await this.db.moderationWarning.create({
                data: { guildId, userId: user.id, reason, issuedBy: interaction.user.id },
            });

            const totalWarnings = await this.db.moderationWarning.count({ where: { guildId, userId: user.id } });

            // DM the user — always send for warns regardless of dmUponAction setting
            await user.send({
                content: `⚠️ You have received a warning in **${interaction.guild!.name}**.\nReason: ${reason}\nYou now have **${totalWarnings}** warning${totalWarnings !== 1 ? 's' : ''}.`,
            }).catch(() => {}); // Silently ignore if user has DMs closed

            await this.logAction(guildId, 'warn', interaction.user.id, user.id, { reason, totalWarnings });

            await interaction.editReply({
                content: `⚠️ **${user.tag}** has been warned. Reason: ${reason}\nTotal warnings: **${totalWarnings}**`,
            });
        } catch (e) {
            this.logger.error('Warn failed', e);
            await interaction.editReply({ content: 'Failed to issue warning.' });
        }
    }

    private async handleWarnings(interaction: ChatInputCommandInteraction) {
        if (!await this.checkModerationAccess(interaction, 'canViewLogs')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }
        const user = interaction.options.getUser('user');
        if (!user) return interaction.reply({ content: 'User not found.', flags: MessageFlags.Ephemeral });

        const guildId = interaction.guildId!;

        try {
            const warnings = await this.db.moderationWarning.findMany({
                where: { guildId, userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 10,
            });

            if (warnings.length === 0) {
                return interaction.reply({ content: `✅ **${user.tag}** has no warnings.`, flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setTitle(`⚠️ Warnings for ${user.tag}`)
                .setColor(Colors.Yellow)
                .setDescription(
                    warnings.map((w, i) =>
                        `**#${i + 1}** — ${w.reason}\n> Issued by <@${w.issuedBy}> • <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`
                    ).join('\n\n')
                )
                .setFooter({ text: `Total: ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (e) {
            this.logger.error('Warnings lookup failed', e);
            await interaction.reply({ content: 'Failed to retrieve warnings.', flags: MessageFlags.Ephemeral });
        }
    }

    /**
     * Called by external plugins (e.g. SpamGuard) to kick a user and create a full
     * moderation log entry + case file, as if the kick came from this plugin.
     */
    public async kickAndLog(guildId: string, targetId: string, executorId: string, reason: string): Promise<void> {
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
            const member = await guild.members.fetch(targetId).catch(() => null);
            if (member?.kickable) {
                await member.kick(`[SpamGuard] ${reason}`).catch(() => {});
            }
        }
        await this.logAction(guildId, 'kick', executorId, targetId, { reason });
    }

    private async logAction(guildId: string, action: string, executorId: string, targetId: string, details: any) {
        // 1. DB Log (fetch recent messages first so they're stored with the entry)
        try {
            let recentMessages: any[] = [];
            if (action !== 'purge') {
                try {
                    const msgs = await this.fetchRecentMessages(guildId, targetId);
                    recentMessages = msgs.map((m: any) => ({
                        content: String(m.content || '').slice(0, 200),
                        channelId: m.channelId,
                        channelName: m.channelName,
                        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
                        attachments: (m.attachments || []).slice(0, 3).map((a: any) => ({ url: a.url, name: a.name, contentType: a.contentType })),
                    }));
                } catch { /* non-fatal */ }
            }

            await this.db.actionLog.create({
                data: {
                    guildId,
                    pluginId: 'moderation',
                    action,
                    executorId,
                    targetId,
                    details: { ...details, recentMessages },
                    searchableText: `${action} ${targetId}`
                }
            });

            // 2. Channel Log + Case File (parallel)
            const settings = await this.db.moderationSettings.findUnique({ where: { guildId }});

            const embed = new EmbedBuilder()
                .setTitle(`Moderation: ${action.toUpperCase()}`)
                .setColor(Colors.Red)
                .addFields(
                    { name: 'Executor', value: `<@${executorId}>`, inline: true },
                    { name: 'Target', value: `<@${targetId}>`, inline: true },
                    { name: 'Reason', value: details.reason || 'None' }
                )
                .setTimestamp();
            
            if (details.duration) embed.addFields({ name: 'Duration', value: details.duration, inline: true });
            if (details.amount) embed.addFields({ name: 'Amount', value: String(details.amount), inline: true });
            if (details.totalWarnings) embed.addFields({ name: 'Total Warnings', value: String(details.totalWarnings), inline: true });

            // Fetch recent messages (skip for purge which targets a channel)
            const embeds: EmbedBuilder[] = [embed];
            if (action !== 'purge') {
                try {
                    const recentMsgs = await this.fetchRecentMessages(guildId, targetId);
                    if (recentMsgs.length > 0) {
                        const msgEmbed = new EmbedBuilder()
                            .setTitle(`📝 Last ${recentMsgs.length} message${recentMsgs.length !== 1 ? 's' : ''} from <@${targetId}>`)
                            .setColor(0xF59E0B)
                            .setTimestamp();

                        for (const msg of recentMsgs) {
                            const ts = Math.floor(msg.timestamp.getTime() / 1000);
                            const attachTxt = msg.attachments.length > 0
                                ? '\n' + msg.attachments.map((a: any) => {
                                    const icon = a.contentType?.startsWith('image') ? '🖼️' : a.contentType?.startsWith('video') ? '🎬' : a.contentType?.startsWith('audio') ? '🎵' : '📎';
                                    return `${icon} [${a.name}](${a.url})`;
                                }).join('\n')
                                : '';
                            const content = msg.content.length > 180 ? msg.content.substring(0, 180) + '…' : msg.content;
                            const value = ((content || '*(no text)*') + attachTxt).substring(0, 1024);
                            msgEmbed.addFields({ name: `#${msg.channelName} — <t:${ts}:R>`, value });
                        }

                        // Set first image attachment as embed image for visual preview
                        const firstImage = recentMsgs
                            .flatMap((m: any) => m.attachments)
                            .find((a: any) => a.contentType?.startsWith('image'));
                        if (firstImage) msgEmbed.setImage(firstImage.url);

                        embeds.push(msgEmbed);
                    }
                } catch (e) {
                    this.logger.error('Failed to fetch recent messages for moderation log', e);
                }
            }

            // Channel log
            if (settings?.logChannelId) {
                const channel = this.client.channels.cache.get(settings.logChannelId) as TextChannel;
                if (channel) {
                    channel.send({ embeds }).catch(() => {});
                }
            }

            // Case file forum thread
            if (settings?.caseLogForumId) {
                this.postToCaseThread(guildId, settings.caseLogForumId, targetId, embeds).catch(e => {
                    this.logger.error('Failed to post to case thread', e);
                });
            }
        } catch(e) {
            this.logger.error('Failed to log action', e);
        }
    }

    /**
     * Posts a moderation embed to a per-user forum thread.
     * Thread naming: "Nickname (username) - UserID"
     * If a thread already exists for the user (matched by user ID in thread name), reuses it.
     * Otherwise creates a new one. Automatically unarchives threads if needed.
     */
    private async postToCaseThread(guildId: string, forumId: string, targetId: string, embeds: EmbedBuilder[]) {
        const forum = await this.client.channels.fetch(forumId).catch(() => null);
        if (!forum || forum.type !== ChannelType.GuildForum) return;

        const forumChannel = forum as ForumChannel;

        // Search active + archived threads for one containing the user ID
        let thread = await this.findCaseThread(forumChannel, targetId);

        if (!thread) {
            // Resolve user for display name
            const guild = this.client.guilds.cache.get(guildId);
            let threadName = `Unknown User - ${targetId}`;
            if (guild) {
                const member = await guild.members.fetch(targetId).catch(() => null);
                if (member) {
                    const displayName = member.displayName || member.user.username;
                    threadName = `${displayName} (${member.user.username}) - ${targetId}`;
                } else {
                    const user = await this.client.users.fetch(targetId).catch(() => null);
                    if (user) {
                        threadName = `${user.displayName || user.username} (${user.username}) - ${targetId}`;
                    }
                }
            }

            // Truncate to Discord's 100 char limit
            if (threadName.length > 100) {
                threadName = threadName.substring(0, 97) + '...';
            }

            const created = await forumChannel.threads.create({
                name: threadName,
                message: { content: `📂 **Case file opened for <@${targetId}>**`, allowedMentions: { users: [targetId] } },
            });
            thread = created;
        }

        // Unarchive if needed
        if (thread.archived) {
            await thread.setArchived(false).catch(() => {});
        }

        await thread.send({ embeds });
    }

    /**
     * Searches both active and archived threads for a matching user ID.
     */
    private async findCaseThread(forum: ForumChannel, userId: string) {
        // Check active threads
        const active = await forum.threads.fetch();
        const match = active.threads.find(t => t.name.includes(userId));
        if (match) return match;

        // Check archived threads (paginate)
        let hasMore = true;
        let before: string | undefined;
        while (hasMore) {
            const archived = await forum.threads.fetchArchived({ before, limit: 100 }).catch(() => null);
            if (!archived || archived.threads.size === 0) break;

            const found = archived.threads.find(t => t.name.includes(userId));
            if (found) return found;

            hasMore = archived.hasMore;
            const last = archived.threads.last();
            before = last?.id;
        }

        return null;
    }

    /**
     * Fetches the target user's last N messages across the guild using Discord's
     * guild message search API (GET /guilds/:id/messages/search?author_id=...).
     * Returns them sorted newest-first with content, channel, timestamp, and attachment URLs.
     */
    private async fetchRecentMessages(guildId: string, userId: string, limit = 5) {
        try {
            const data = await this.client.rest.get(
                `/guilds/${guildId}/messages/search?author_id=${userId}&limit=${limit}`
            ) as any;

            if (!data?.messages?.length) return [];

            return data.messages.map((group: any[]) => {
                // Search results come as arrays with the matched message at index 0
                const msg = group[0];
                const channelId = msg.channel_id || '';
                const channel = this.client.channels.cache.get(channelId);
                const channelName = channel && 'name' in channel ? (channel as TextChannel).name : 'unknown';

                return {
                    content: msg.content || '',
                    channelId,
                    channelName,
                    timestamp: new Date(msg.timestamp),
                    attachments: (msg.attachments || []).map((a: any) => ({
                        url: a.url,
                        name: a.filename || 'file',
                        contentType: a.content_type || null,
                    })),
                };
            });
        } catch (e) {
            this.logger.error('Failed to search messages via REST', e);
            return [];
        }
    }

    /**
     * Deletes up to `count` recent messages from a user across the guild.
     * Uses the Discord search API to find messages, then deletes them individually.
     */
    private async deleteUserMessages(guildId: string, userId: string, count: number): Promise<number> {
        try {
            const data = await this.client.rest.get(
                `/guilds/${guildId}/messages/search?author_id=${userId}&limit=${Math.min(count, 100)}`
            ) as any;

            if (!data?.messages?.length) return 0;

            let deleted = 0;
            for (const group of data.messages) {
                const msg = group[0];
                if (!msg?.id || !msg?.channel_id) continue;
                try {
                    const channel = this.client.channels.cache.get(msg.channel_id) as TextChannel;
                    if (!channel) continue;
                    const message = await channel.messages.fetch(msg.id).catch(() => null);
                    if (message) {
                        await message.delete();
                        deleted++;
                    }
                } catch {
                    // Skip messages we can't delete (permissions, already deleted, etc.)
                }
            }
            return deleted;
        } catch (e) {
            this.logger.error('Failed to delete user messages', e);
            return 0;
        }
    }

    private async handleRemove(interaction: ChatInputCommandInteraction) {
        if (!await this.checkModerationAccess(interaction, 'canRemove')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        const messageId = interaction.options.getString('message_id', true);
        const reason = interaction.options.getString('reason', true);
        const channel = interaction.channel as TextChannel;

        if (!channel) {
            return interaction.reply({ content: 'This command must be used in a text channel.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const targetMessage = await channel.messages.fetch(messageId).catch(() => null);
            if (!targetMessage) {
                return interaction.editReply({ content: 'Message not found. Make sure you are in the same channel as the message.' });
            }

            const settings = await this.db.moderationSettings.findUnique({ where: { guildId: interaction.guildId! } });
            const reviewChannelId = settings?.logChannelId;
            const alertRoleId = settings?.removeAlertRoleId;

            if (!reviewChannelId) {
                return interaction.editReply({ content: '⚠️ No log channel is configured. Ask an admin to set one in Moderation Settings.' });
            }

            const reviewChannel = this.client.channels.cache.get(reviewChannelId) as TextChannel;
            if (!reviewChannel) {
                return interaction.editReply({ content: '⚠️ The configured log channel was not found.' });
            }

            const messageContent = targetMessage.content || '';
            const messageAuthor = targetMessage.author;
            const attachmentUrls = [...targetMessage.attachments.values()].map(a => a.url);

            // Generate a short unique key for this review
            const reviewKey = Math.random().toString(36).slice(2, 10);

            const embed = new EmbedBuilder()
                .setTitle('⏳ Removal Review Request')
                .setColor(Colors.Yellow)
                .setDescription(`**${interaction.user}** has requested a message be removed and needs senior staff approval.`)
                .addFields(
                    { name: 'Message Author', value: `<@${messageAuthor.id}> (${messageAuthor.tag})`, inline: true },
                    { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                    { name: 'Reason', value: reason },
                    { name: 'Message Content', value: messageContent.substring(0, 1024) || '*No text content*' },
                )
                .setFooter({ text: `Review ID: ${reviewKey}` })
                .setTimestamp();

            if (attachmentUrls.length > 0) {
                embed.addFields({ name: 'Attachments', value: attachmentUrls.map((u, i) => `[File ${i + 1}](${u})`).join('\n') });
            }

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`MOD_RM_APPROVE_${reviewKey}`)
                    .setLabel('✅ Approve Removal')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`MOD_RM_DENY_${reviewKey}`)
                    .setLabel('❌ Deny')
                    .setStyle(ButtonStyle.Danger),
            );

            const pingContent = alertRoleId ? `<@&${alertRoleId}>` : undefined;
            const reviewMsg = await reviewChannel.send({ content: pingContent, embeds: [embed], components: [row], allowedMentions: alertRoleId ? { roles: [alertRoleId] } : undefined });

            // Store pending review in memory
            this.pendingRemovals.set(reviewKey, {
                guildId: interaction.guildId!,
                channelId: channel.id,
                messageId: targetMessage.id,
                messageContent,
                attachmentUrls,
                authorId: messageAuthor.id,
                authorTag: messageAuthor.tag,
                authorUsername: messageAuthor.username,
                authorAvatar: messageAuthor.displayAvatarURL() || null,
                requestorId: interaction.user.id,
                reason,
                reviewChannelId,
                reviewMessageId: reviewMsg.id,
            });

            // Auto-expire after 24 hours
            setTimeout(() => this.pendingRemovals.delete(reviewKey), 24 * 60 * 60 * 1000);

            await interaction.editReply({ content: `📨 Removal request sent for review. Senior staff have been notified in <#${reviewChannelId}>.` });
        } catch (e) {
            this.logger.error('Remove command failed', e);
            await interaction.editReply({ content: 'Failed to submit removal request.' });
        }
    }

    /**
     * Checks if the button interaction user is a moderator or admin level.
     * Requires Discord Administrator, native BanMembers, or DB canBan permission.
     * Jr staff / regular staff with only canRemove do NOT qualify.
     */
    private async checkApprovalAccess(interaction: ButtonInteraction): Promise<boolean> {
        const member = interaction.member as GuildMember;
        if (!member) return false;
        if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        if (member.permissions.has(PermissionFlagsBits.BanMembers)) return true;

        try {
            const settings = await this.db.moderationSettings.findUnique({
                where: { guildId: interaction.guildId! },
                include: { permissions: true },
            });
            if (!settings?.permissions?.length) return false;
            const memberRoleIds = member.roles.cache.map(r => r.id);
            return settings.permissions.some(
                perm => memberRoleIds.includes(perm.roleId) && perm.canBan === true
            );
        } catch {
            return false;
        }
    }

    private async handleRemoveApprove(interaction: ButtonInteraction, reviewKey: string) {
        if (!await this.checkApprovalAccess(interaction)) {
            return interaction.reply({ content: '❌ Only moderators/admins can approve or deny removal requests.', flags: MessageFlags.Ephemeral });
        }

        const data = this.pendingRemovals.get(reviewKey);
        if (!data) {
            return interaction.reply({ content: '❌ This review request has expired or was already processed.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferUpdate();
        this.pendingRemovals.delete(reviewKey);

        try {
            // Delete the original message
            const targetChannel = this.client.channels.cache.get(data.channelId) as TextChannel | null;
            if (targetChannel) {
                const targetMessage = await targetChannel.messages.fetch(data.messageId).catch(() => null);
                if (targetMessage) await targetMessage.delete().catch(() => {});
            }

            // Update the review embed
            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('done_a').setLabel('✅ Approved').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('done_b').setLabel('❌ Deny').setStyle(ButtonStyle.Danger).setDisabled(true),
            );

            await interaction.editReply({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle('✅ Removal Approved')
                    .setColor(Colors.Green)
                    .setDescription(`Approved by **${interaction.user.tag}**. Message deleted.`)],
                components: [disabledRow],
            });

            // DM the requestor
            const requestor = await this.client.users.fetch(data.requestorId).catch(() => null);
            if (requestor) {
                requestor.send(`✅ Your removal request for a message by **${data.authorTag}** in <#${data.channelId}> was **approved** by ${interaction.user.tag}.`).catch(() => {});
            }

            await this.logAction(data.guildId, 'remove', interaction.user.id, data.authorId, {
                reason: data.reason,
                channel: data.channelId,
                decision: 'approved',
                reviewedBy: interaction.user.id,
            });
        } catch (e) {
            this.logger.error('Remove approval failed', e);
        }
    }

    private async handleRemoveDeny(interaction: ButtonInteraction, reviewKey: string) {
        if (!await this.checkApprovalAccess(interaction)) {
            return interaction.reply({ content: '❌ Only moderators/admins can approve or deny removal requests.', flags: MessageFlags.Ephemeral });
        }

        const data = this.pendingRemovals.get(reviewKey);
        if (!data) {
            return interaction.reply({ content: '❌ This review request has expired or was already processed.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferUpdate();
        this.pendingRemovals.delete(reviewKey);

        // Update the review embed
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('done_a').setLabel('✅ Approve').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('done_b').setLabel('❌ Denied').setStyle(ButtonStyle.Danger).setDisabled(true),
        );

        await interaction.editReply({
            embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle('❌ Removal Denied')
                .setColor(Colors.Red)
                .setDescription(`Denied by **${interaction.user.tag}**. Message left in place.`)],
            components: [disabledRow],
        });

        // DM the requestor
        const requestor = await this.client.users.fetch(data.requestorId).catch(() => null);
        if (requestor) {
            requestor.send(`❌ Your removal request for a message by **${data.authorTag}** in <#${data.channelId}> was **denied** by ${interaction.user.tag}.`).catch(() => {});
        }

        await this.logAction(data.guildId, 'remove', interaction.user.id, data.authorId, {
            reason: data.reason,
            channel: data.channelId,
            decision: 'denied',
            reviewedBy: interaction.user.id,
        }).catch(() => {});
    }

    private parseDuration(input: string): number | null {
        const regex = /^(\d+)([smhdw])$/i;
        const match = input.match(regex);
        if (!match) return null;
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            case 'w': return value * 7 * 24 * 60 * 60 * 1000;
            default: return null;
        }
    }
}
