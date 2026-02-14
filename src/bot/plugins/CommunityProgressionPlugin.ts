import { 
    Client, 
    Message, 
    VoiceState, 
    GuildMember, 
    MessageReaction, 
    User, 
    PartialUser, 
    PartialMessageReaction, 
    Events,
    EmbedBuilder,
    TextChannel,
    PermissionsBitField,
    AuditLogEvent,
    Collection
} from 'discord.js';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

// Helper: XP to Level (Quadratic)
// XP = 100 * Level^2  => Level = sqrt(XP / 100)
const getLevel = (xp: number) => Math.floor(Math.sqrt(xp / 100));
const getXpForLevel = (level: number) => 100 * Math.pow(level, 2);

export class CommunityProgressionPlugin implements IPlugin {
    id = 'progression';
    name = 'Community Progression';
    description = 'Unified XP, Roles, Onboarding, and Sticky Persistence System';
    version = '2.0.0';
    author = 'Fuji Studio';
    
    events = [
        Events.MessageCreate,
        Events.VoiceStateUpdate,
        Events.GuildMemberAdd,
        Events.GuildMemberRemove,
        Events.MessageReactionAdd,
        Events.MessageReactionRemove
    ];

    requiredPermissions = [
        PermissionsBitField.Flags.ManageRoles,
        PermissionsBitField.Flags.SendMessages
    ];

    commands = ['rank', 'progression']; // Text commands

    dashboardSections = ['progression-settings', 'reaction-roles'];
    
    defaultEnabled = true;

    configSchema = z.object({
        // XP Settings
        xpTextMin: z.number().default(15),
        xpTextMax: z.number().default(25),
        xpTextCooldown: z.number().default(60),
        xpVoicePerTick: z.number().default(10), // Amount per interval
        xpVoiceTickSeconds: z.number().default(300), // 5 minutes
        xpReaction: z.number().default(5),
        
        // Onboarding
        onboardingEnabled: z.boolean().default(false),
        autoRoles: z.array(z.string()).default([]),
        ignoreBots: z.boolean().default(true),
        minAccountAgeDays: z.number().default(0),
        joinDelaySeconds: z.number().default(0),
        
        // Sticky
        stickyEnabled: z.boolean().default(true),
        
        // Alerts
        announceLevelUp: z.boolean().default(true),
        announceChannelId: z.string().optional(),
    });

    private client!: Client;
    private db!: PrismaClient;
    private logger!: Logger;
    private logAction: any;
    
    // Cache
    private textCooldowns = new Map<string, number>(); // userId_guildId -> timestamp
    private voiceJoinTimes = new Map<string, number>(); // userId_guildId -> timestamp
    private voiceInterval: NodeJS.Timeout | null = null;

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.logAction = context.logAction;
        
        this.logger.info('Community Progression Plugin v2 initialized');

        // Start Voice XP Loop
        this.voiceInterval = setInterval(() => this.processVoiceXp(), 60 * 1000); // Check every minute
    }

    async shutdown(): Promise<void> {
        if (this.voiceInterval) clearInterval(this.voiceInterval);
        this.textCooldowns.clear();
        this.voiceJoinTimes.clear();
    }

    // =========================================================================
    // Event Handlers
    // =========================================================================

    async onMessageCreate(message: Message) {
        if (!message.guild || message.author.bot) return;

        // 1. Handle Commands
        if (message.content.startsWith('!rank')) {
            await this.handleRankCommand(message);
            return;
        }
        if (message.content.startsWith('!progression')) {
            await this.handleAdminCommand(message);
            return;
        }

        // 2. Handle XP
        const settings = await this.getSettings(message.guild.id);
        if (!settings) return;

        const cooldownKey = `${message.author.id}_${message.guild.id}`;
        const lastMsg = this.textCooldowns.get(cooldownKey) || 0;
        const now = Date.now();

        if (now - lastMsg >= settings.xpTextCooldown * 1000) {
            // Random XP
            const amount = Math.floor(Math.random() * (settings.xpTextMax - settings.xpTextMin + 1)) + settings.xpTextMin;
            await this.addXp(message.guild.id, message.author.id, amount, message);
            this.textCooldowns.set(cooldownKey, now);
        }
    }

    async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;
        
        const guildId = member.guild.id;
        const key = `${member.id}_${guildId}`;

        const isJoined = newState.channelId && !newState.mute && !newState.deaf;
        const wasJoined = oldState.channelId && !oldState.mute && !oldState.deaf;

        if (isJoined && !wasJoined) {
            // Started earning
            this.voiceJoinTimes.set(key, Date.now());
        } else if (!isJoined && wasJoined) {
            // Stopped earning (left, muted, or deafened)
            await this.awardPendingVoiceXp(member.guild.id, member.id);
            this.voiceJoinTimes.delete(key);
        }
    }

    async onGuildMemberAdd(member: GuildMember) {
        if (member.user.bot) return;
        const settings = await this.getSettings(member.guild.id);
        if (!settings) return;

        // 1. Sticky Restore
        if (settings.stickyEnabled) {
            const userLevel = await this.db.userLevel.findUnique({
                where: { guildId_userId: { guildId: member.guild.id, userId: member.id } }
            });

            if (userLevel) {
                // Restore Roles
                if (userLevel.stickyRoles && Array.isArray(userLevel.stickyRoles) && userLevel.stickyRoles.length > 0) {
                    await member.roles.add(userLevel.stickyRoles)
                        .then(() => {
                            if (this.logAction) {
                                this.logAction({
                                    guildId: member.guild.id,
                                    pluginId: this.id,
                                    action: 'sticky_roles_restored',
                                    targetId: member.id,
                                    details: { roles: userLevel.stickyRoles }
                                });
                            }
                        })
                        .catch(e => this.logger.error('Failed to restore sticky roles', e));
                }
            }
        }

        // 2. Onboarding
        if (settings.onboardingEnabled) {
            if (settings.ignoreBots && member.user.bot) return;
            
            // Age Gate
            const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
            if (accountAgeDays < settings.minAccountAgeDays) return;

            // Auto Roles
            if (settings.autoRoles.length > 0) {
                if (settings.joinDelaySeconds > 0) {
                    setTimeout(async () => {
                        try {
                            const m = await member.guild.members.fetch(member.id);
                            await this.assignAutoRoles(m, settings.autoRoles);
                        } catch (e) { /* Left? */ }
                    }, settings.joinDelaySeconds * 1000);
                } else {
                    await this.assignAutoRoles(member, settings.autoRoles);
                }
            }
        }
    }

    private async assignAutoRoles(member: GuildMember, roles: string[]) {
        await member.roles.add(roles).catch(e => this.logger.error('Failed to add auto roles', e));
        if (this.logAction) {
            this.logAction({
                guildId: member.guild.id,
                pluginId: this.id,
                action: 'autorole_assigned',
                targetId: member.id,
                details: { roles }
            });
        }
    }

    async onGuildMemberRemove(member: GuildMember | PartialUser) {
        if (!('guild' in member)) return;
        const m = member as GuildMember;
        if (m.user.bot) return;

        const settings = await this.getSettings(m.guild.id);
        if (!settings || !settings.stickyEnabled) return;

        // Save Roles (excluding managed/@everyone)
        const rolesToSave = m.roles.cache
            .filter(r => !r.managed && r.name !== '@everyone')
            .map(r => r.id);

        await this.db.userLevel.upsert({
            where: { guildId_userId: { guildId: m.guild.id, userId: m.id } },
            update: { stickyRoles: rolesToSave },
            create: { guildId: m.guild.id, userId: m.id, xp: 0, level: 0, stickyRoles: rolesToSave }
        });
    }

    async onMessageReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
        if (user.bot) return;
        await this.handleReaction(reaction, user, true);
        
        // XP for reaction
        if (reaction.message.guild) {
            const settings = await this.getSettings(reaction.message.guild.id);
            if (settings) {
                await this.addXp(reaction.message.guild.id, user.id, settings.xpReaction, null);
            }
        }
    }

    async onMessageReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
        if (user.bot) return;
        await this.handleReaction(reaction, user, false);
    }

    // =========================================================================
    // Core Logic
    // =========================================================================

    private async addXp(guildId: string, userId: string, amount: number, message: Message | null) {
        const userLevel = await this.db.userLevel.upsert({
            where: { guildId_userId: { guildId, userId } },
            update: { xp: { increment: amount }, lastMessage: message ? new Date() : undefined },
            create: { guildId, userId, xp: amount, level: 0, lastMessage: new Date() }
        });

        const newLevel = getLevel(userLevel.xp);
        if (newLevel > userLevel.level) {
            await this.db.userLevel.update({
                where: { guildId_userId: { guildId, userId } },
                data: { level: newLevel }
            });
            await this.handleLevelUp(guildId, userId, newLevel, message?.channel as TextChannel);
        }
    }

    private async handleLevelUp(guildId: string, userId: string, newLevel: number, channel: TextChannel | null) {
        const settings = await this.getSettings(guildId);
        if (!settings) return;

        // Rewards
        // Assuming rewards are stored in settings or separate table. 
        // Using 'any' here as schema might vary, but logic holds.
        const rewards = (settings as any).levelRewards || []; 
        const earned = rewards.filter((r: any) => r.level === newLevel);

        if (earned.length > 0) {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            
            for (const reward of earned) {
                await member.roles.add(reward.roleId).then(() => {
                    if (this.logAction) {
                        this.logAction({
                            guildId,
                            pluginId: this.id,
                            action: 'level_reward_assigned',
                            targetId: userId,
                            details: { level: newLevel, roleId: reward.roleId }
                        });
                    }
                }).catch(() => {});

                if (!reward.stack) {
                    // Remove lower roles
                    const lower = rewards.filter((r: any) => r.level < newLevel);
                    for (const l of lower) {
                        await member.roles.remove(l.roleId).catch(() => {});
                    }
                }
            }
        }

        // Announce
        if (settings.announceLevelUp) {
            let targetChannel = channel;
            if (settings.announceChannelId) {
                try {
                    const c = await this.client.channels.fetch(settings.announceChannelId);
                    if (c && c.isTextBased()) targetChannel = c as TextChannel;
                } catch (e) {}
            }

            if (targetChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Level Up!')
                    .setDescription(`Congratulations <@${userId}>! You reached **Level ${newLevel}**!`)
                    .setColor(0x00ff00);
                await targetChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    }

    private async processVoiceXp() {
        const now = Date.now();
        for (const [key, joinTime] of this.voiceJoinTimes.entries()) {
            const [userId, guildId] = key.split('_');
            const settings = await this.getSettings(guildId);
            if (!settings) continue;

            // Check if enough time passed for a tick
            const diff = now - joinTime;
            const tickMs = settings.xpVoiceTickSeconds * 1000;

            if (diff >= tickMs) {
                // Award XP
                await this.addXp(guildId, userId, settings.xpVoicePerTick, null);
                // Reset timer to now (so they earn again in X mins)
                this.voiceJoinTimes.set(key, now);
            }
        }
    }

    private async awardPendingVoiceXp(guildId: string, userId: string) {
        const key = `${userId}_${guildId}`;
        const joinTime = this.voiceJoinTimes.get(key);
        if (!joinTime) return;

        const settings = await this.getSettings(guildId);
        if (!settings) return;

        const diff = Date.now() - joinTime;
        // Pro-rate XP? Or just floor? Prompt said "periodically", so maybe strict intervals.
        // We'll just floor it based on the tick.
        const ticks = Math.floor(diff / (settings.xpVoiceTickSeconds * 1000));
        if (ticks > 0) {
            await this.addXp(guildId, userId, ticks * settings.xpVoicePerTick, null);
        }
    }

    private async handleReaction(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, added: boolean) {
        if (reaction.partial) await reaction.fetch();
        if (user.partial) await user.fetch();

        const msgId = reaction.message.id;
        // Check DB for Reaction Role Message
        const rrMsg = await (this.db as any).reactionRoleMessage.findUnique({
            where: { messageId: msgId },
            include: { mappings: true }
        });

        if (!rrMsg) return;

        const emojiId = reaction.emoji.id || reaction.emoji.name;
        const mapping = rrMsg.mappings.find((m: any) => m.emoji === emojiId);

        if (mapping) {
            const guild = await this.client.guilds.fetch(reaction.message.guild!.id);
            const member = await guild.members.fetch(user.id);

            if (added) {
                // Check Limit Mode
                if (rrMsg.mode === 'LIMIT' && rrMsg.limit > 0) {
                    // Count how many roles from this message the user already has
                    const userRoles = member.roles.cache;
                    const rolesFromMsg = rrMsg.mappings.map((m: any) => m.roleId);
                    const hasCount = userRoles.filter(r => rolesFromMsg.includes(r.id)).size;
                    
                    if (hasCount >= rrMsg.limit) {
                        // Remove reaction to indicate failure
                        await reaction.users.remove(user.id);
                        return;
                    }
                }
                await member.roles.add(mapping.roleId).catch(() => {});
            } else {
                // Verify Mode: Cannot remove by un-reacting
                if (rrMsg.mode !== 'VERIFY') {
                    await member.roles.remove(mapping.roleId).catch(() => {});
                }
            }
        }
    }

    // =========================================================================
    // Commands
    // =========================================================================

    private async handleRankCommand(message: Message) {
        const target = message.mentions.users.first() || message.author;
        const userLevel = await this.db.userLevel.findUnique({
            where: { guildId_userId: { guildId: message.guild!.id, userId: target.id } }
        });

        const xp = userLevel?.xp || 0;
        const level = userLevel?.level || 0;
        const nextLevelXp = getXpForLevel(level + 1);
        const prevLevelXp = getXpForLevel(level);
        const progress = xp - prevLevelXp;
        const needed = nextLevelXp - prevLevelXp;
        const percent = Math.floor((progress / needed) * 100);

        const embed = new EmbedBuilder()
            .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
            .setTitle('Rank Card')
            .addFields(
                { name: 'Level', value: `${level}`, inline: true },
                { name: 'XP', value: `${xp} / ${nextLevelXp}`, inline: true },
                { name: 'Progress', value: `${percent}%`, inline: true }
            )
            .setColor(0x0099ff);

        await message.reply({ embeds: [embed] });
    }

    private async handleAdminCommand(message: Message) {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const args = message.content.split(' ');
        const action = args[1]; // sync

        if (action === 'sync') {
            await message.reply('🔄 Syncing roles for all members... This may take a while.');
            const members = await message.guild!.members.fetch();
            let count = 0;
            
            for (const [_, member] of members) {
                if (member.user.bot) continue;
                const ul = await this.db.userLevel.findUnique({
                    where: { guildId_userId: { guildId: message.guild!.id, userId: member.id } }
                });
                if (ul) {
                    // Re-run level up logic to ensure roles
                    await this.handleLevelUp(message.guild!.id, member.id, ul.level, null);
                    count++;
                }
            }
            await message.channel.send(`✅ Synced roles for ${count} members.`);
        }
    }

    // Helper to get merged settings (DB + Defaults)
    private async getSettings(guildId: string) {
        // In a real scenario, we fetch from DB and merge with this.configSchema defaults.
        // For now, we assume the DB returns the correct shape or we use defaults.
        // This is a simplification.
        const dbSettings = await (this.db as any).levellingSettings.findUnique({ where: { guildId } });
        if (!dbSettings) return null; // Or return defaults
        return { ...this.configSchema.parse({}), ...dbSettings };
    }
}
