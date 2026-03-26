import {
    Client,
    ChatInputCommandInteraction,
    GuildMember,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';

// ─────────────────────────────────────────
// XP Curve: 100 × level^1.5 + 400
// ─────────────────────────────────────────
function xpForLevel(level: number): number {
    if (level <= 0) return 0;
    return Math.floor(100 * Math.pow(level, 1.5) + 400);
}

function totalXpForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i <= level; i++) total += xpForLevel(i);
    return total;
}

function levelFromTotalXp(totalXp: number): number {
    let level = 0;
    let accumulated = 0;
    while (true) {
        const required = xpForLevel(level + 1);
        if (accumulated + required > totalXp) break;
        accumulated += required;
        level++;
    }
    return level;
}

function progressBar(current: number, max: number, length = 12): string {
    const filled = Math.round((current / Math.max(max, 1)) * length);
    const empty = length - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
}

export class LevelingPlugin implements IPlugin {
    readonly id = 'leveling';
    readonly name = 'Leveling System';
    readonly version = '1.0.0';
    readonly description = 'High-performance XP & leveling with role rewards, streaks, and sticky roles';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [PermissionFlagsBits.ManageRoles];
    readonly commands = ['rank', 'leaderboard', 'xp', 'leveling-sync'];
    readonly events = ['interactionCreate', 'messageCreate', 'voiceStateUpdate', 'messageReactionAdd', 'guildMemberAdd'];
    readonly dashboardSections = ['leveling'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
    });

    private client!: Client;
    private db!: PrismaClient;
    private logger: any;

    // Cooldown tracking (userId-guildId → timestamp)
    private messageCooldowns = new Map<string, number>();

    // Voice session tracking (userId-guildId → join timestamp)
    private voiceTracker = new Map<string, number>();

    // Voice XP interval
    private voiceInterval?: ReturnType<typeof setInterval>;

    // Daily streak tracking (userId-guildId → last date string)
    private streakCache = new Map<string, string>();

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;

        // Start voice XP ticker (every 60s)
        this.voiceInterval = setInterval(() => this.tickVoiceXP(), 60_000);

        // Populate voice tracker for members already in voice
        this.client.guilds.cache.forEach(guild => {
            guild.voiceStates.cache.forEach(vs => {
                if (vs.member && !vs.member.user.bot && vs.channel) {
                    this.voiceTracker.set(`${vs.member.id}-${guild.id}`, Date.now());
                }
            });
        });

        this.logger.info('Leveling Plugin initialized');
    }

    async shutdown(): Promise<void> {
        if (this.voiceInterval) clearInterval(this.voiceInterval);
        this.messageCooldowns.clear();
        this.voiceTracker.clear();
    }

    // ─────────────────────────────────────────
    // Slash Command Registration
    // ─────────────────────────────────────────
    async registerCommands() {
        const rank = new SlashCommandBuilder()
            .setName('rank')
            .setDescription('Check your rank and XP progress')
            .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false));

        const leaderboard = new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('View the server leaderboard')
            .addStringOption(o =>
                o.setName('type')
                    .setDescription('Leaderboard type')
                    .addChoices(
                        { name: 'XP', value: 'xp' },
                        { name: 'Voice', value: 'voice' },
                        { name: 'Messages', value: 'messages' },
                    )
            )
            .addIntegerOption(o =>
                o.setName('page').setDescription('Page number').setMinValue(1)
            );

        const xp = new SlashCommandBuilder()
            .setName('xp')
            .setDescription('Admin XP management')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .addSubcommand(sub =>
                sub.setName('give')
                    .setDescription('Give XP to a user')
                    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                    .addIntegerOption(o => o.setName('amount').setDescription('XP amount').setRequired(true).setMinValue(1))
            )
            .addSubcommand(sub =>
                sub.setName('remove')
                    .setDescription('Remove XP from a user')
                    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                    .addIntegerOption(o => o.setName('amount').setDescription('XP amount').setRequired(true).setMinValue(1))
            )
            .addSubcommand(sub =>
                sub.setName('set')
                    .setDescription('Set a user\'s level')
                    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
                    .addIntegerOption(o => o.setName('level').setDescription('Target level').setRequired(true).setMinValue(0))
            );

        const sync = new SlashCommandBuilder()
            .setName('leveling-sync')
            .setDescription('Re-scan and fix your level roles (admin: sync a user)')
            .addUserOption(o => o.setName('user').setDescription('User to sync (admin only)'));

        return [rank, leaderboard, xp, sync];
    }

    // ─────────────────────────────────────────
    // Event Handlers
    // ─────────────────────────────────────────

    async onInteractionCreate(interaction: any): Promise<void> {
        if (interaction.isChatInputCommand()) {
            switch (interaction.commandName) {
                case 'rank': return this.handleRank(interaction);
                case 'leaderboard': return this.handleLeaderboard(interaction);
                case 'xp': return this.handleXpAdmin(interaction);
                case 'leveling-sync': return this.handleSync(interaction);
            }
        }
        if (interaction.isButton() && interaction.customId.startsWith('lb_')) {
            return this.handleLeaderboardButton(interaction);
        }
    }

    async onMessageCreate(message: any): Promise<void> {
        if (message.author.bot || !message.guild) return;

        const settings = await this.getSettings(message.guild.id);
        if (!settings?.enabled || !settings.messageXpEnabled) return;

        // Blacklist check
        if (settings.blacklistedChannels.includes(message.channel.id)) return;
        const memberRoles = message.member?.roles?.cache;
        if (memberRoles && settings.blacklistedRoles.some((r: string) => memberRoles.has(r))) return;

        // Cooldown
        const key = `${message.author.id}-${message.guild.id}`;
        const now = Date.now();
        const last = this.messageCooldowns.get(key) || 0;
        if (now - last < (settings.messageCooldownSec * 1000)) return;
        this.messageCooldowns.set(key, now);

        // Calculate XP with multiplier
        const baseXp = Math.floor(Math.random() * (settings.messageXpMax - settings.messageXpMin + 1)) + settings.messageXpMin;
        const xp = Math.floor(baseXp * settings.xpMultiplier);

        await this.addXP(message.author.id, message.guild.id, xp, 'message');
    }

    async onVoiceStateUpdate(oldState: any, newState: any): Promise<void> {
        const member = newState.member;
        if (!member || member.user.bot) return;
        const guildId = newState.guild.id;
        const key = `${member.id}-${guildId}`;

        const settings = await this.getSettings(guildId);
        if (!settings?.enabled || !settings.voiceXpEnabled) return;

        // Joined voice
        if (!oldState.channel && newState.channel) {
            if (!settings.blacklistedChannels.includes(newState.channel.id)) {
                this.voiceTracker.set(key, Date.now());
            }
        }
        // Left voice
        if (oldState.channel && !newState.channel) {
            this.voiceTracker.delete(key);
        }
        // Moved channels
        if (oldState.channel && newState.channel && oldState.channelId !== newState.channelId) {
            if (settings.blacklistedChannels.includes(newState.channel.id)) {
                this.voiceTracker.delete(key);
            } else if (!this.voiceTracker.has(key)) {
                this.voiceTracker.set(key, Date.now());
            }
        }
    }

    async onMessageReactionAdd(reaction: any, user: any): Promise<void> {
        if (user.bot || !reaction.message.guild) return;

        const guildId = reaction.message.guild.id;
        const settings = await this.getSettings(guildId);
        if (!settings?.enabled || !settings.reactionXpEnabled) return;

        // XP for giving a reaction
        const giverXp = Math.floor(settings.reactionGivenXp * settings.xpMultiplier);
        if (giverXp > 0) await this.addXP(user.id, guildId, giverXp, 'reaction_given');

        // XP for receiving a reaction (if not self-reacting)
        const authorId = reaction.message.author?.id;
        if (authorId && authorId !== user.id) {
            const receiverXp = Math.floor(settings.reactionReceivedXp * settings.xpMultiplier);
            if (receiverXp > 0) await this.addXP(authorId, guildId, receiverXp, 'reaction_received');
        }
    }

    async onGuildMemberAdd(member: any): Promise<void> {
        if (member.user.bot) return;

        // Restore sticky roles
        try {
            const dbMember = await this.db.member.findUnique({
                where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
            });
            if (!dbMember || !dbMember.earnedRoles || dbMember.earnedRoles.length === 0) return;

            const settings = await this.getSettings(member.guild.id);
            if (!settings) return;

            const rewards = await this.db.levelRoleReward.findMany({
                where: { settingsId: settings.id, sticky: true },
            });
            const stickyRoleIds = new Set(rewards.map(r => r.roleId));

            let restored = 0;
            for (const roleId of dbMember.earnedRoles) {
                if (!stickyRoleIds.has(roleId)) continue;
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role, 'Leveling: Sticky role restore').catch(() => {});
                    restored++;
                }
            }
            if (restored > 0) {
                this.logger.info(`Restored ${restored} sticky roles for ${member.user.username} in ${member.guild.name}`);
            }
        } catch (e) {
            this.logger.error('Sticky role restore error', e);
        }
    }

    // ─────────────────────────────────────────
    // Core XP Engine
    // ─────────────────────────────────────────

    private async addXP(userId: string, guildId: string, amount: number, source: string): Promise<void> {
        try {
            // Upsert member
            const member = await this.db.member.upsert({
                where: { guildId_userId: { guildId, userId } },
                update: {
                    totalXp: { increment: amount },
                    lastActiveAt: new Date(),
                    ...(source === 'message' ? { messagesCount: { increment: 1 } } : {}),
                    ...(source === 'voice' ? { voiceMinutes: { increment: 1 } } : {}),
                    ...(source === 'reaction_given' ? { reactionsGiven: { increment: 1 } } : {}),
                    ...(source === 'reaction_received' ? { reactionsReceived: { increment: 1 } } : {}),
                },
                create: {
                    guildId,
                    userId,
                    totalXp: amount,
                    level: 0,
                    xp: 0,
                    messagesCount: source === 'message' ? 1 : 0,
                    voiceMinutes: source === 'voice' ? 1 : 0,
                    reactionsGiven: source === 'reaction_given' ? 1 : 0,
                    reactionsReceived: source === 'reaction_received' ? 1 : 0,
                },
            });

            // Recalculate level from totalXp
            const newLevel = levelFromTotalXp(member.totalXp);
            const oldLevel = member.level;

            // Update streak for message activity
            if (source === 'message') {
                await this.updateStreak(userId, guildId);
            }

            // Compute current-level progress XP
            const totalForCurrent = totalXpForLevel(newLevel);
            const currentProgress = member.totalXp - totalForCurrent;

            if (newLevel !== oldLevel) {
                await this.db.member.update({
                    where: { guildId_userId: { guildId, userId } },
                    data: { level: newLevel, xp: currentProgress },
                });

                if (newLevel > oldLevel) {
                    await this.handleLevelUp(userId, guildId, newLevel, oldLevel);
                }
            } else {
                await this.db.member.update({
                    where: { guildId_userId: { guildId, userId } },
                    data: { xp: currentProgress },
                });
            }
        } catch (e) {
            this.logger.error(`addXP error for ${userId}`, e);
        }
    }

    private async updateStreak(userId: string, guildId: string): Promise<void> {
        const key = `${userId}-${guildId}`;
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const lastDate = this.streakCache.get(key);

        if (lastDate === today) return; // Already counted today

        const member = await this.db.member.findUnique({
            where: { guildId_userId: { guildId, userId } },
        });
        if (!member) return;

        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

        let newStreak = member.currentStreak;
        if (lastDate === yesterday || (member.lastDailyAt && member.lastDailyAt.toISOString().slice(0, 10) === yesterday)) {
            newStreak += 1;
        } else if (lastDate !== today) {
            newStreak = 1; // Reset streak
        }

        const longestStreak = Math.max(member.longestStreak, newStreak);

        await this.db.member.update({
            where: { guildId_userId: { guildId, userId } },
            data: {
                currentStreak: newStreak,
                longestStreak,
                lastDailyAt: new Date(),
                lastMessageAt: new Date(),
            },
        });

        this.streakCache.set(key, today);

        // Streak bonus: 10% extra XP for every 5 days of streak (max 50%)
        if (newStreak >= 5) {
            const bonusMultiplier = Math.min(Math.floor(newStreak / 5) * 0.10, 0.50);
            const bonusXp = Math.floor(20 * bonusMultiplier); // Base streak bonus
            if (bonusXp > 0) {
                await this.db.member.update({
                    where: { guildId_userId: { guildId, userId } },
                    data: { totalXp: { increment: bonusXp } },
                });
            }
        }
    }

    private async handleLevelUp(userId: string, guildId: string, newLevel: number, oldLevel: number): Promise<void> {
        const settings = await this.getSettings(guildId);
        if (!settings) return;

        const guild = this.client.guilds.cache.get(guildId);
        const member = await guild?.members.fetch(userId).catch(() => null);
        if (!guild || !member) return;

        // Check for role rewards at each level between old and new
        const rewards = await this.db.levelRoleReward.findMany({
            where: {
                settingsId: settings.id,
                level: { gt: oldLevel, lte: newLevel },
            },
            orderBy: { level: 'asc' },
        });

        const grantedRoles: string[] = [];
        for (const reward of rewards) {
            const role = guild.roles.cache.get(reward.roleId);
            if (!role) continue;

            try {
                await member.roles.add(role, `Leveling: Reached level ${reward.level}`);
                grantedRoles.push(reward.roleId);

                // Track in earnedRoles for sticky restore
                await this.db.member.update({
                    where: { guildId_userId: { guildId, userId } },
                    data: {
                        earnedRoles: {
                            push: reward.roleId,
                        },
                    },
                });
            } catch (e) {
                this.logger.error(`Failed to grant role ${reward.roleId} to ${userId}`, e);
            }
        }

        // Send level-up notification
        if (settings.levelUpChannelId) {
            const channel = this.client.channels.cache.get(settings.levelUpChannelId) as TextChannel;
            if (channel) {
                const msg = settings.levelUpMessage
                    .replace('{user}', `<@${userId}>`)
                    .replace('{level}', String(newLevel))
                    .replace('{username}', member.user.username);

                let content = msg;

                // Announce role rewards
                if (settings.announceRoleReward && rewards.length > 0) {
                    const roleNames = rewards
                        .map(r => guild.roles.cache.get(r.roleId)?.name)
                        .filter(Boolean);
                    if (roleNames.length > 0) {
                        content += `\n🏅 Earned: **${roleNames.join('**, **')}**`;
                    }
                }

                channel.send(content).catch(() => {});
            }
        }
    }

    private async tickVoiceXP(): Promise<void> {
        const now = Date.now();
        for (const [key, joinTime] of Array.from(this.voiceTracker.entries())) {
            const [userId, guildId] = key.split('-');
            if (now - joinTime < 60_000) continue; // Need at least 1 min

            const settings = await this.getSettings(guildId);
            if (!settings?.enabled || !settings.voiceXpEnabled) continue;

            // Check if user is still in a non-AFK, non-muted state
            const guild = this.client.guilds.cache.get(guildId);
            const vs = guild?.voiceStates.cache.get(userId);
            if (!vs || !vs.channel || vs.selfDeaf) continue;

            // Require at least 2 members in the voice channel (no solo farming)
            const humanMembers = vs.channel.members.filter(m => !m.user.bot);
            if (humanMembers.size < 2) continue;

            const xp = Math.floor(settings.voiceXpPerMinute * settings.xpMultiplier);
            if (xp > 0) await this.addXP(userId, guildId, xp, 'voice');

            this.voiceTracker.set(key, now); // Reset timer
        }
    }

    // ─────────────────────────────────────────
    // Slash Command Handlers
    // ─────────────────────────────────────────

    private async handleRank(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guildId!;

        const member = await this.db.member.findUnique({
            where: { guildId_userId: { guildId, userId: targetUser.id } },
        });

        const totalXp = member?.totalXp || 0;
        const level = member?.level || 0;
        const currentLevelTotal = totalXpForLevel(level);
        const nextLevelXp = xpForLevel(level + 1);
        const progress = totalXp - currentLevelTotal;

        // Get rank position
        const rank = await this.db.member.count({
            where: { guildId, totalXp: { gt: totalXp } },
        }) + 1;

        const totalMembers = await this.db.member.count({ where: { guildId } });

        const streakText = member?.currentStreak
            ? `🔥 ${member.currentStreak} day${member.currentStreak !== 1 ? 's' : ''}`
            : 'None';

        const embed = new EmbedBuilder()
            .setColor(0x10B981)
            .setAuthor({ name: `${targetUser.username}'s Rank`, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
            .addFields(
                { name: 'Rank', value: `#${rank} / ${totalMembers}`, inline: true },
                { name: 'Level', value: `${level}`, inline: true },
                { name: 'Total XP', value: `${totalXp.toLocaleString()}`, inline: true },
                { name: 'Progress', value: `${progressBar(progress, nextLevelXp)} ${progress}/${nextLevelXp}`, inline: false },
                { name: 'Messages', value: `${(member?.messagesCount || 0).toLocaleString()}`, inline: true },
                { name: 'Voice', value: `${(member?.voiceMinutes || 0).toLocaleString()}m`, inline: true },
                { name: 'Streak', value: streakText, inline: true },
            )
            .setFooter({ text: `Next level at ${totalXpForLevel(level + 1).toLocaleString()} total XP` });

        await interaction.editReply({ embeds: [embed] });
    }

    private async handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        const type = interaction.options.getString('type') || 'xp';
        const page = (interaction.options.getInteger('page') || 1) - 1;
        const perPage = 10;

        await this.sendLeaderboardPage(interaction, type, page, perPage);
    }

    private async sendLeaderboardPage(interaction: any, type: string, page: number, perPage: number): Promise<void> {
        const guildId = interaction.guildId!;

        const orderBy = type === 'voice' ? { voiceMinutes: 'desc' as const }
            : type === 'messages' ? { messagesCount: 'desc' as const }
            : { totalXp: 'desc' as const };

        const total = await this.db.member.count({ where: { guildId } });
        const maxPage = Math.max(0, Math.ceil(total / perPage) - 1);
        page = Math.min(page, maxPage);

        const members = await this.db.member.findMany({
            where: { guildId },
            orderBy,
            skip: page * perPage,
            take: perPage,
        });

        const lines: string[] = [];
        for (let i = 0; i < members.length; i++) {
            const m = members[i];
            const rank = page * perPage + i + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;

            let value: string;
            if (type === 'voice') value = `${m.voiceMinutes.toLocaleString()} min`;
            else if (type === 'messages') value = `${m.messagesCount.toLocaleString()} msgs`;
            else value = `Lvl ${m.level} • ${m.totalXp.toLocaleString()} XP`;

            lines.push(`${medal} <@${m.userId}> — ${value}`);
        }

        const typeLabel = type === 'voice' ? 'Voice Time' : type === 'messages' ? 'Messages' : 'XP';

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`🏆 ${typeLabel} Leaderboard`)
            .setDescription(lines.join('\n') || 'No data yet.')
            .setFooter({ text: `Page ${page + 1}/${maxPage + 1} • ${total} members tracked` });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`lb_${type}_${page - 1}`)
                .setLabel('◀ Prev')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`lb_${type}_${page + 1}`)
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= maxPage),
        );

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components: [row] });
        } else {
            await interaction.update({ embeds: [embed], components: [row] });
        }
    }

    private async handleLeaderboardButton(interaction: any): Promise<void> {
        const parts = interaction.customId.split('_'); // lb_type_page
        const type = parts[1];
        const page = parseInt(parts[2]);
        if (isNaN(page)) return;

        await this.sendLeaderboardPage(interaction, type, page, 10);
    }

    private async handleXpAdmin(interaction: ChatInputCommandInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user', true);
        const guildId = interaction.guildId!;

        if (sub === 'give') {
            const amount = interaction.options.getInteger('amount', true);
            await this.addXP(targetUser.id, guildId, amount, 'admin');
            await interaction.reply({ content: `✅ Gave **${amount} XP** to ${targetUser}.`, flags: MessageFlags.Ephemeral });

        } else if (sub === 'remove') {
            const amount = interaction.options.getInteger('amount', true);
            const member = await this.db.member.findUnique({
                where: { guildId_userId: { guildId, userId: targetUser.id } },
            });
            if (!member) return void interaction.reply({ content: 'User has no XP data.', flags: MessageFlags.Ephemeral });

            const newTotal = Math.max(0, member.totalXp - amount);
            const newLevel = levelFromTotalXp(newTotal);
            const progress = newTotal - totalXpForLevel(newLevel);

            await this.db.member.update({
                where: { guildId_userId: { guildId, userId: targetUser.id } },
                data: { totalXp: newTotal, level: newLevel, xp: progress },
            });

            await interaction.reply({ content: `✅ Removed **${amount} XP** from ${targetUser}. Now: Level ${newLevel}, ${newTotal} total XP.`, flags: MessageFlags.Ephemeral });

        } else if (sub === 'set') {
            const level = interaction.options.getInteger('level', true);
            const newTotal = totalXpForLevel(level);

            await this.db.member.upsert({
                where: { guildId_userId: { guildId, userId: targetUser.id } },
                update: { totalXp: newTotal, level, xp: 0 },
                create: { guildId, userId: targetUser.id, totalXp: newTotal, level, xp: 0 },
            });

            await interaction.reply({ content: `✅ Set ${targetUser} to **Level ${level}** (${newTotal.toLocaleString()} XP).`, flags: MessageFlags.Ephemeral });
        }
    }

    private async handleSync(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetUser = interaction.options.getUser('user') || interaction.user;

        // Only admins can sync other users
        if (targetUser.id !== interaction.user.id) {
            const guildMember = interaction.member as GuildMember;
            if (!guildMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return void interaction.editReply('You need Manage Server permission to sync other users.');
            }
        }

        const guildId = interaction.guildId!;
        const guild = interaction.guild!;

        const member = await this.db.member.findUnique({
            where: { guildId_userId: { guildId, userId: targetUser.id } },
        });
        if (!member) return void interaction.editReply(`${targetUser.username} has no leveling data.`);

        const settings = await this.getSettings(guildId);
        if (!settings) return void interaction.editReply('Leveling is not configured for this server.');

        const allRewards = await this.db.levelRoleReward.findMany({
            where: { settingsId: settings.id },
            orderBy: { level: 'asc' },
        });

        const guildMember = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!guildMember) return void interaction.editReply('Could not find member in this server.');

        let added = 0;
        let removed = 0;
        const newEarnedRoles: string[] = [];

        for (const reward of allRewards) {
            const role = guild.roles.cache.get(reward.roleId);
            if (!role) continue;

            if (member.level >= reward.level) {
                // Should have this role
                if (!guildMember.roles.cache.has(reward.roleId)) {
                    await guildMember.roles.add(role, 'Leveling sync').catch(() => {});
                    added++;
                }
                newEarnedRoles.push(reward.roleId);
            } else {
                // Should NOT have this role
                if (guildMember.roles.cache.has(reward.roleId)) {
                    await guildMember.roles.remove(role, 'Leveling sync').catch(() => {});
                    removed++;
                }
            }
        }

        // Update earnedRoles array
        await this.db.member.update({
            where: { guildId_userId: { guildId, userId: targetUser.id } },
            data: { earnedRoles: newEarnedRoles },
        });

        await interaction.editReply(
            `✅ Synced **${targetUser.username}** (Level ${member.level}): +${added} roles added, -${removed} roles removed.`
        );
    }

    // ─────────────────────────────────────────
    // Data Migration
    // ─────────────────────────────────────────

    async migrateLegacyData(filePath: string, guildId: string): Promise<{ migrated: number; errors: number }> {
        this.logger.info(`Starting legacy leveling data migration from ${filePath}`);

        const raw = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(raw);

        if (!data.users) throw new Error('Invalid legacy data: missing "users" key');

        let migrated = 0;
        let errors = 0;

        for (const [userId, guilds] of Object.entries(data.users) as [string, any][]) {
            for (const [gId, stats] of Object.entries(guilds) as [string, any][]) {
                // If guildId filter provided, only migrate that guild
                if (guildId && gId !== guildId) continue;

                try {
                    const totalXp = stats.xp || 0;
                    const level = levelFromTotalXp(totalXp);
                    const progress = totalXp - totalXpForLevel(level);

                    await this.db.member.upsert({
                        where: { guildId_userId: { guildId: gId, userId } },
                        update: {
                            totalXp,
                            level,
                            xp: progress,
                            voiceMinutes: stats.voiceTime || 0,
                            reactionsGiven: stats.reactionsGiven || 0,
                            reactionsReceived: stats.reactionsReceived || 0,
                            earnedRoles: stats.earnedRoles || [],
                        },
                        create: {
                            guildId: gId,
                            userId,
                            totalXp,
                            level,
                            xp: progress,
                            voiceMinutes: stats.voiceTime || 0,
                            reactionsGiven: stats.reactionsGiven || 0,
                            reactionsReceived: stats.reactionsReceived || 0,
                            earnedRoles: stats.earnedRoles || [],
                        },
                    });
                    migrated++;
                } catch (e) {
                    this.logger.error(`Migration error for user ${userId} in guild ${gId}`, e);
                    errors++;
                }
            }
        }

        this.logger.info(`Migration complete: ${migrated} records migrated, ${errors} errors`);
        return { migrated, errors };
    }

    // ─────────────────────────────────────────
    // Settings Helper
    // ─────────────────────────────────────────

    private settingsCache = new Map<string, { data: any; expiry: number }>();
    private SETTINGS_TTL = 30_000; // 30s cache

    private async getSettings(guildId: string) {
        const now = Date.now();
        const cached = this.settingsCache.get(guildId);
        if (cached && cached.expiry > now) return cached.data;

        const settings = await this.db.levelingSettings.findUnique({ where: { guildId } });
        if (settings) {
            this.settingsCache.set(guildId, { data: settings, expiry: now + this.SETTINGS_TTL });
        }
        return settings;
    }

    // Invalidate when settings change from dashboard
    public invalidateSettingsCache(guildId: string): void {
        this.settingsCache.delete(guildId);
    }
}
