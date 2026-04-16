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

    readonly commands = ['kick', 'ban', 'timeout', 'warn', 'warnings', 'purge', 'modlog'];
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
    async onInteractionCreate(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        // Route commands
        switch (interaction.commandName) {
            case 'kick': await this.handleKick(interaction); break;
            case 'ban': await this.handleBan(interaction); break;
            case 'timeout': await this.handleTimeout(interaction); break;
            case 'purge': await this.handlePurge(interaction); break;
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
        flag: 'canWarn' | 'canKick' | 'canBan' | 'canTimeout' | 'canPurge' | 'canViewLogs'
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

            const message = messageTemplate
                .replace(/{server}/g, member.guild.name)
                .replace(/{user}/g, member.user.tag)
                .replace(/{reason}/g, reason)
                .replace(/{duration}/g, duration || '');

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
            
            await interaction.editReply({ 
                content: `👢 **${target.user.tag}** was kicked. Reason: ${reason}`,
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
             
             const msg = durationStr 
                ? `🔨 **${user.tag}** was banned for ${durationStr}. Reason: ${reason}`
                : `🔨 **${user.tag}** was banned permanently. Reason: ${reason}`;
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

        if (!target) return interaction.reply({ content: 'User not found', flags: MessageFlags.Ephemeral });
        if (!target.moderatable) return interaction.reply({ content: 'Cannot timeout user.', flags: MessageFlags.Ephemeral });

        const ms = this.parseDuration(durationStr);
        if (!ms) return interaction.reply({ content: 'Invalid duration. Use formats like `10m`, `1h`, `1d`, `7d`.', flags: MessageFlags.Ephemeral });

        const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord max: 28 days
        if (ms > MAX_TIMEOUT_MS) return interaction.reply({ content: 'Duration cannot exceed 28 days.', flags: MessageFlags.Ephemeral });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await this.sendDM(interaction.guildId!, target, 'timeout', reason, durationStr);
            await target.timeout(ms, reason);
            await this.logAction(interaction.guildId!, 'timeout', interaction.user.id, target.id, { reason, duration: durationStr });
            await interaction.editReply({ content: `⏳ **${target.user.tag}** timed out for ${durationStr}. Reason: ${reason}` });
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

        const channel = interaction.channel as TextChannel;
        if (!channel) return;

        try {
            const deleted = await channel.bulkDelete(amount, true);
            await this.logAction(interaction.guildId!, 'purge', interaction.user.id, channel.id, { amount: deleted.size, channel: channel.name });
            
            await interaction.reply({ content: `Deleted ${deleted.size} messages.`, flags: MessageFlags.Ephemeral });
        } catch (e) {
            this.logger.error('Purge failed', e);
            await interaction.reply({ content: 'Failed to delete messages. Messages older than 14 days cannot be bulk deleted.', flags: MessageFlags.Ephemeral });
        }
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

    private async logAction(guildId: string, action: string, executorId: string, targetId: string, details: any) {
        // 1. DB Log
        try {
            await this.db.actionLog.create({
                data: {
                    guildId,
                    pluginId: 'moderation',
                    action,
                    executorId,
                    targetId,
                    details,
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
                                ? '\n' + msg.attachments.map(a => {
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
                            .flatMap(m => m.attachments)
                            .find(a => a.contentType?.startsWith('image'));
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
                message: { content: `📂 **Case file opened for <@${targetId}>**` },
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
