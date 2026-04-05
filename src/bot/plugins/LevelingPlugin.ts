import {
    Client,
    Guild,
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
    readonly commands = ['rank', 'leaderboard', 'xp', 'leveling-sync', 'xpboost'];
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
                        { name: 'Power Score', value: 'power' },
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
            .setDescription('Re-scan and fix level roles for a user or the entire server')
            .addUserOption(o => o.setName('user').setDescription('Specific user to sync (admin only). Omit to sync yourself.'))
            .addBooleanOption(o => o.setName('all').setDescription('Sync ALL members in the server (admin only, may take a while)').setRequired(false));

        const xpboost = new SlashCommandBuilder()
            .setName('xpboost')
            .setDescription('Purchase a temporary XP multiplier boost using your economy balance');

        return [rank, leaderboard, xp, sync, xpboost];
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
                case 'xpboost': return this.handleXpBoost(interaction);
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

        // Calculate XP with multiplier + active booster
        const baseXp = Math.floor(Math.random() * (settings.messageXpMax - settings.messageXpMin + 1)) + settings.messageXpMin;
        const boosterMult = await this.getActiveBoosterMultiplier(message.author.id, message.guild.id);
        const xp = Math.floor(baseXp * settings.xpMultiplier * boosterMult);

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
        const boosterMult = await this.getActiveBoosterMultiplier(user.id, guildId);
        const giverXp = Math.floor(settings.reactionGivenXp * settings.xpMultiplier * boosterMult);
        if (giverXp > 0) await this.addXP(user.id, guildId, giverXp, 'reaction_given');

        // XP for receiving a reaction (if not self-reacting)
        const authorId = reaction.message.author?.id;
        if (authorId && authorId !== user.id) {
            const receiverBoost = await this.getActiveBoosterMultiplier(authorId, guildId);
            const receiverXp = Math.floor(settings.reactionReceivedXp * settings.xpMultiplier * receiverBoost);
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

            // ── Economy Synergy: Micro-Rewards ──
            await this.checkMicroRewards(userId, guildId, member, source);

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

            // Streak coin bonus: 1 coin per 5-day tier (max 5 coins)
            const coinBonus = Math.min(Math.floor(newStreak / 5), 5);
            if (coinBonus > 0) {
                try {
                    await this.db.economyAccount.upsert({
                        where: { guildId_userId: { guildId, userId } },
                        update: {
                            balance: { increment: coinBonus },
                            totalEarned: { increment: coinBonus },
                        },
                        create: {
                            guildId,
                            userId,
                            balance: coinBonus,
                            totalEarned: coinBonus,
                        },
                    });
                } catch { /* economy tables may not exist */ }
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

        // ── Economy Synergy: Level-Up Currency Reward ──
        let currencyAwarded = 0;
        let milestoneBonus = 0;
        if (settings.economyRewardsEnabled) {
            // Per-level currency reward
            if (settings.levelUpCurrencyReward > 0) {
                currencyAwarded = settings.levelUpCurrencyReward * (newLevel - oldLevel);
                await this.awardCurrency(guildId, userId, currencyAwarded, 'LEVELUP', `Leveled up to ${newLevel}`);
            }

            // Milestone jackpots
            const milestones = this.parseMilestones(settings.milestoneLevels);
            for (const ms of milestones) {
                if (ms.level > oldLevel && ms.level <= newLevel && ms.reward > 0) {
                    milestoneBonus += ms.reward;
                    await this.awardCurrency(guildId, userId, ms.reward, 'LEVELUP', `Milestone: Level ${ms.level} jackpot`);
                }
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

                // Announce economy rewards
                const totalCoins = currencyAwarded + milestoneBonus;
                if (totalCoins > 0) {
                    content += `\n💰 +${totalCoins.toLocaleString()} coins`;
                    if (milestoneBonus > 0) content += ` (includes **${milestoneBonus.toLocaleString()}** milestone bonus!)`;
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

            const boosterMult = await this.getActiveBoosterMultiplier(userId, guildId);
            const xp = Math.floor(settings.voiceXpPerMinute * settings.xpMultiplier * boosterMult);
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

        // Power Score leaderboard: combined Level × 100 + Wallet
        if (type === 'power') {
            return this.sendPowerLeaderboard(interaction, page, perPage);
        }

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

    private async syncMemberRoles(
        guildId: string,
        guild: Guild,
        userId: string,
        level: number,
        allRewards: { level: number; roleId: string }[],
        cachedOnly = false,
    ): Promise<{ added: number; removed: number; earnedRoles: string[]; skipped: boolean }> {
        const guildMember = cachedOnly
            ? guild.members.cache.get(userId) ?? null
            : await guild.members.fetch(userId).catch(() => null);
        if (!guildMember) return { added: 0, removed: 0, earnedRoles: [], skipped: true };

        let added = 0;
        let removed = 0;
        const newEarnedRoles: string[] = [];

        // Compute which roles to add/remove and batch them
        const rolesToAdd: string[] = [];
        const rolesToRemove: string[] = [];

        for (const reward of allRewards) {
            const role = guild.roles.cache.get(reward.roleId);
            if (!role) continue;

            if (level >= reward.level) {
                if (!guildMember.roles.cache.has(reward.roleId)) {
                    rolesToAdd.push(reward.roleId);
                }
                newEarnedRoles.push(reward.roleId);
            } else {
                if (guildMember.roles.cache.has(reward.roleId)) {
                    rolesToRemove.push(reward.roleId);
                }
            }
        }

        // Single API call for adding roles, single for removing
        if (rolesToAdd.length > 0) {
            await guildMember.roles.add(rolesToAdd, 'Leveling sync').catch(() => {});
            added = rolesToAdd.length;
        }
        if (rolesToRemove.length > 0) {
            await guildMember.roles.remove(rolesToRemove, 'Leveling sync').catch(() => {});
            removed = rolesToRemove.length;
        }

        await this.db.member.update({
            where: { guildId_userId: { guildId, userId } },
            data: { earnedRoles: newEarnedRoles },
        });

        return { added, removed, earnedRoles: newEarnedRoles, skipped: false };
    }

    private async handleSync(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const syncAll = interaction.options.getBoolean('all') ?? false;
        const targetUser = interaction.options.getUser('user') || (!syncAll ? interaction.user : null);
        const invokerMember = interaction.member as GuildMember;
        const isAdmin = invokerMember.permissions.has(PermissionFlagsBits.ManageGuild);

        // Permission checks
        if (syncAll || (targetUser && targetUser.id !== interaction.user.id)) {
            if (!isAdmin) {
                return void interaction.editReply('You need **Manage Server** permission to sync other users or the full server.');
            }
        }

        const guildId = interaction.guildId!;
        const guild = interaction.guild!;

        const settings = await this.getSettings(guildId);
        if (!settings) return void interaction.editReply('Leveling is not configured for this server.');

        const allRewards = await this.db.levelRoleReward.findMany({
            where: { settingsId: settings.id },
            orderBy: { level: 'asc' },
        });

        // ── Bulk sync all members ──────────────────────────────────────────────
        if (syncAll) {
            const allMembers = await this.db.member.findMany({
                where: { guildId },
                select: { userId: true, level: true },
            });

            if (allMembers.length === 0) {
                return void interaction.editReply('No members with leveling data found.');
            }

            await interaction.editReply(`⏳ Syncing **${allMembers.length}** members... this may take a while.`);

            let totalAdded = 0;
            let totalRemoved = 0;
            let processed = 0;
            let failed = 0;
            let skippedNotInServer = 0;

            // Fetch all guild members into cache once to avoid per-member API calls
            await guild.members.fetch().catch(() => null);
            const cachedCount = guild.members.cache.size;

            for (const m of allMembers) {
                try {
                    const result = await this.syncMemberRoles(guildId, guild, m.userId, m.level, allRewards, true);
                    if (result.skipped) {
                        skippedNotInServer++;
                    } else {
                        totalAdded += result.added;
                        totalRemoved += result.removed;
                    }
                    processed++;
                } catch {
                    failed++;
                }
                // Light throttle (only needed for role API calls, cached members are fast)
                if (processed % 10 === 0) {
                    await new Promise(r => setTimeout(r, 50));
                }

                // Post progress update every 500 members
                if (processed % 500 === 0) {
                    await interaction.editReply(
                        `⏳ Progress: ${processed}/${allMembers.length} members synced...`
                    ).catch(() => {});
                }
            }

            return void interaction.editReply(
                `✅ Bulk sync complete!\n` +
                `• **${processed}** members processed (${skippedNotInServer} not in server, ${failed} errors)\n` +
                `• **+${totalAdded}** roles added, **-${totalRemoved}** roles removed`
            );
        }

        // ── Single user sync ───────────────────────────────────────────────────
        const member = await this.db.member.findUnique({
            where: { guildId_userId: { guildId, userId: targetUser!.id } },
        });
        if (!member) return void interaction.editReply(`${targetUser!.username} has no leveling data.`);

        const { added, removed } = await this.syncMemberRoles(guildId, guild, targetUser!.id, member.level, allRewards);

        await interaction.editReply(
            `✅ Synced **${targetUser!.username}** (Level ${member.level}): +${added} roles added, -${removed} roles removed.`
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

    // ─────────────────────────────────────────
    // Economy Synergy Helpers
    // ─────────────────────────────────────────

    private async awardCurrency(guildId: string, userId: string, amount: number, type: string, reason: string): Promise<boolean> {
        if (amount <= 0) return false;
        try {
            await this.db.economyAccount.upsert({
                where: { guildId_userId: { guildId, userId } },
                update: {
                    balance: { increment: amount },
                    totalEarned: { increment: amount },
                },
                create: { guildId, userId, balance: amount, totalEarned: amount },
            });
            await this.db.economyTransaction.create({
                data: { guildId, amount, type, toUserId: userId, reason },
            });
            return true;
        } catch {
            // Economy tables may not exist or be disabled — fail silently
            return false;
        }
    }

    private async getActiveBoosterMultiplier(userId: string, guildId: string): Promise<number> {
        try {
            const booster = await this.db.xpBooster.findUnique({
                where: { guildId_userId: { guildId, userId } },
            });
            if (!booster) return 1;
            if (booster.expiresAt < new Date()) {
                // Expired — clean up
                await this.db.xpBooster.delete({ where: { guildId_userId: { guildId, userId } } }).catch(() => {});
                return 1;
            }
            return booster.multiplier;
        } catch {
            return 1;
        }
    }

    private async checkMicroRewards(userId: string, guildId: string, member: any, source: string): Promise<void> {
        const settings = await this.getSettings(guildId);
        if (!settings?.economyRewardsEnabled || !settings.microRewardsEnabled) return;

        const amount = settings.microRewardAmount || 5;

        if (source === 'reaction' && settings.microRewardReactions > 0) {
            const total = (member.reactionsGiven || 0) + (member.reactionsReceived || 0);
            if (total > 0 && total % settings.microRewardReactions === 0) {
                await this.awardCurrency(guildId, userId, amount, 'LEVELUP', `Micro-reward: ${settings.microRewardReactions} reactions milestone`);
            }
        }

        if (source === 'voice' && settings.microRewardVoiceMin > 0) {
            if (member.voiceMinutes > 0 && member.voiceMinutes % settings.microRewardVoiceMin === 0) {
                await this.awardCurrency(guildId, userId, amount, 'LEVELUP', `Micro-reward: ${settings.microRewardVoiceMin} voice min milestone`);
            }
        }
    }

    private parseMilestones(milestoneLevels: any): { level: number; reward: number }[] {
        try {
            const arr = typeof milestoneLevels === 'string' ? JSON.parse(milestoneLevels) : milestoneLevels;
            if (!Array.isArray(arr)) return [];
            return arr.filter((m: any) => typeof m.level === 'number' && typeof m.reward === 'number');
        } catch {
            return [];
        }
    }

    private async handleXpBoost(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId!;
        const userId = interaction.user.id;

        const settings = await this.getSettings(guildId);
        if (!settings?.xpBoosterEnabled) {
            return void interaction.reply({ content: '❌ XP Boosters are not enabled on this server.', flags: MessageFlags.Ephemeral });
        }

        // Check for existing active booster
        const existing = await this.db.xpBooster.findUnique({
            where: { guildId_userId: { guildId, userId } },
        });
        if (existing && existing.expiresAt > new Date()) {
            const remaining = Math.ceil((existing.expiresAt.getTime() - Date.now()) / 60_000);
            return void interaction.reply({
                content: `⚡ You already have an active **${existing.multiplier}x XP Booster** with **${remaining} minutes** remaining!`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // Check economy balance
        const price = settings.xpBoosterPrice || 500;
        let account: any;
        try {
            account = await this.db.economyAccount.findUnique({
                where: { guildId_userId: { guildId, userId } },
            });
        } catch {
            return void interaction.reply({ content: '❌ Economy system is not available.', flags: MessageFlags.Ephemeral });
        }

        if (!account || account.balance < price) {
            const bal = account?.balance ?? 0;
            return void interaction.reply({
                content: `❌ You need **${price.toLocaleString()} coins** to buy an XP Booster but only have **${bal.toLocaleString()} coins**.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const multiplier = settings.xpBoosterMultiplier || 1.5;
        const durationMin = settings.xpBoosterDurationMin || 60;
        const expiresAt = new Date(Date.now() + durationMin * 60_000);

        // Deduct balance and create booster in a transaction
        await this.db.$transaction([
            this.db.economyAccount.update({
                where: { guildId_userId: { guildId, userId } },
                data: { balance: { decrement: price } },
            }),
            this.db.economyTransaction.create({
                data: { guildId, amount: -price, type: 'SHOP', fromUserId: userId, reason: `XP Booster (${multiplier}x, ${durationMin}min)` },
            }),
            this.db.xpBooster.upsert({
                where: { guildId_userId: { guildId, userId } },
                update: { multiplier, expiresAt },
                create: { guildId, userId, multiplier, expiresAt },
            }),
        ]);

        await interaction.reply({
            content: `⚡ **XP Booster Activated!**\n> **${multiplier}x** XP for **${durationMin} minutes**\n> Cost: **${price.toLocaleString()} coins**`,
            flags: MessageFlags.Ephemeral,
        });
    }

    private async sendPowerLeaderboard(interaction: any, page: number, perPage: number): Promise<void> {
        const guildId = interaction.guildId!;

        // Fetch all members with their economy balance
        const members = await this.db.member.findMany({
            where: { guildId },
            select: { userId: true, level: true, totalXp: true },
        });

        // Fetch economy accounts for this guild
        const accounts = await this.db.economyAccount.findMany({
            where: { guildId },
            select: { userId: true, balance: true },
        }).catch(() => [] as { userId: string; balance: number }[]);

        const balanceMap = new Map(accounts.map(a => [a.userId, a.balance]));

        // Compute power score and sort
        const scored = members.map(m => ({
            userId: m.userId,
            level: m.level,
            totalXp: m.totalXp,
            balance: balanceMap.get(m.userId) ?? 0,
            powerScore: m.level * 100 + (balanceMap.get(m.userId) ?? 0),
        })).sort((a, b) => b.powerScore - a.powerScore);

        const total = scored.length;
        const maxPage = Math.max(0, Math.ceil(total / perPage) - 1);
        page = Math.min(page, maxPage);

        const slice = scored.slice(page * perPage, (page + 1) * perPage);

        const lines: string[] = [];
        for (let i = 0; i < slice.length; i++) {
            const m = slice[i];
            const rank = page * perPage + i + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
            lines.push(`${medal} <@${m.userId}> — ⚡ ${m.powerScore.toLocaleString()} (Lvl ${m.level} + ${m.balance.toLocaleString()} coins)`);
        }

        const embed = new EmbedBuilder()
            .setTitle('⚡ Power Score Leaderboard')
            .setDescription(lines.join('\n') || 'No data yet.')
            .setColor(0xFFD700)
            .setFooter({ text: `Page ${page + 1} / ${maxPage + 1} • ${total} members` });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`lb_power_${page - 1}`)
                .setLabel('◀ Prev')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`lb_power_${page + 1}`)
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
}
