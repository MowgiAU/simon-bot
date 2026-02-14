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
    Interaction,
    Partials
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';

// Helper to calculate level from XP
// Using a common formula: Level = 0.1 * sqrt(XP)
// XP = 100 * Level^2
const calculateLevel = (xp: number): number => {
    return Math.floor(0.1 * Math.sqrt(xp));
};

export class CommunityProgressionPlugin implements IPlugin {
    id = 'progression';
    name = 'Community Progression';
    description = 'XP System, Level Rewards, Onboarding, and Reaction Roles';
    version = '1.0.0';
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
        PermissionsBitField.Flags.ManageRoles
    ];

    commands: string[] = [];  // No text commands for now

    dashboardSections = ['levelling', 'onboarding', 'reaction-roles'];
    
    defaultEnabled = true;

    configSchema = z.object({});

    private client!: Client;
    private db: any;
    private logger: any;
    private logAction: any;
    
    // Cooldowns for text XP: Map<userId_guildId, timestamp>
    private textCooldowns = new Map<string, number>();

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.logAction = context.logAction;
        
        this.logger.info('Community Progression Plugin initialized');
        
        // Ensure partials are handled if not globally? 
        // Typically handled in creating the client, but reaction roles need MESSAGE, REACTION, USER partials.
    }

    async shutdown(): Promise<void> {
        this.textCooldowns.clear();
    }

    // =========================================================================
    // Event Handlers
    // =========================================================================

    /**
     * Handle Text XP
     */
    async onMessageCreate(message: Message) {
        if (!message.guild || message.author.bot) return;

        // Get settings
        const settings = await this.db.levellingSettings.findUnique({
            where: { guildId: message.guild.id }
        });

        if (!settings || !settings.enabled) return;

        // Check cooldown
        const cooldownKey = `${message.author.id}_${message.guild.id}`;
        const lastMsg = this.textCooldowns.get(cooldownKey) || 0;
        const now = Date.now();

        if (now - lastMsg < settings.cooldownText * 1000) {
            return;
        }

        // Apply XP
        await this.addXp(message.guild.id, message.author.id, settings.xpRateText, message);
        
        // Update cooldown
        this.textCooldowns.set(cooldownKey, now);
    }

    /**
     * Handle Voice XP
     */
    async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const guild = newState.guild || oldState.guild;
        const member = newState.member || oldState.member;
        
        if (!guild || !member || member.user.bot) return;

        // Get settings
        const settings = await this.db.levellingSettings.findUnique({
            where: { guildId: guild.id }
        });

        if (!settings || !settings.enabled) return;

        // Check if joined or left
        const wasInChannel = oldState.channelId !== null && oldState.channelId !== guild.afkChannelId;
        const isInChannel = newState.channelId !== null && newState.channelId !== guild.afkChannelId;

        // Logic:
        // If Joined (ignoring AFK): Start Timer
        // If Left (or moved to AFK): Stop Timer & Award XP
        
        if (!wasInChannel && isInChannel) {
            // Joined valid voice channel
            await this.db.userLevel.upsert({
                where: {
                    guildId_userId: {
                        guildId: guild.id,
                        userId: member.id
                    }
                },
                update: {
                    lastVoiceJoin: new Date()
                },
                create: {
                    guildId: guild.id,
                    userId: member.id,
                    xp: 0,
                    level: 0,
                    lastVoiceJoin: new Date()
                }
            });
        } else if (wasInChannel && !isInChannel) {
            // Left valid voice channel
            const userLevel = await this.db.userLevel.findUnique({
                where: {
                    guildId_userId: {
                        guildId: guild.id,
                        userId: member.id
                    }
                }
            });

            if (userLevel && userLevel.lastVoiceJoin) {
                const joinTime = new Date(userLevel.lastVoiceJoin).getTime();
                const now = Date.now();
                const diffMs = now - joinTime;
                
                // 5 minutes = 300,000 ms
                const periodMs = 5 * 60 * 1000;
                
                // If less than minimum requirements? 
                // Let's just calculate chunks
                if (diffMs > periodMs) {
                    const periods = Math.floor(diffMs / periodMs);
                    const xpToGive = periods * settings.xpRateVoice;
                    
                    if (xpToGive > 0) {
                        // Check Anti-AFK (min users) - Optional check
                        // Note: If we want to strictly check 'min users' during the session, it's hard with just begin/end timestamps.
                        // We will assume simpler logic for now: if they spent time, they get XP.
                        
                        await this.addXp(guild.id, member.id, xpToGive, null, true);
                    }
                }

                // Reset voice join time
                await this.db.userLevel.update({
                    where: {
                        guildId_userId: {
                            guildId: guild.id,
                            userId: member.id
                        }
                    },
                    data: {
                        lastVoiceJoin: null
                    }
                });
            }
        }
    }

    /**
     * Handle New Member (Onboarding + Sticky Roles)
     */
    async onGuildMemberAdd(member: GuildMember) {
        if (member.user.bot) return;

        // Fetch settings
        const onboarding = await this.db.onboardingSettings.findUnique({
            where: { guildId: member.guild.id }
        });

        if (!onboarding || !onboarding.enabled) return;

        // 1. Auto Roles
        if (onboarding.autoRoles && onboarding.autoRoles.length > 0) {
            if (onboarding.delaySeconds > 0) {
                setTimeout(async () => {
                    // Re-fetch member to ensure they are still there
                    try {
                        const m = await member.guild.members.fetch(member.id);
                        await m.roles.add(onboarding.autoRoles).catch(err => this.logger.error('Failed to add auto roles', err));
                    } catch (e) { /* Member left? */ }
                }, onboarding.delaySeconds * 1000);
            } else {
                await member.roles.add(onboarding.autoRoles).catch(err => this.logger.error('Failed to add auto roles', err));
            }
        }

        // 2. Sticky Roles
        const userLevel = await this.db.userLevel.findUnique({
            where: {
                guildId_userId: {
                    guildId: member.guild.id,
                    userId: member.id
                }
            }
        });

        if (userLevel && userLevel.stickyRoles && userLevel.stickyRoles.length > 0) {
            await member.roles.add(userLevel.stickyRoles).catch(err => this.logger.error('Failed to add sticky roles', err));
            // Optional: Clear sticky roles after re-applying?
            // Usually we keep them or clear them. If we clear, they lose roles if they leave again instantly.
            // But if they stay, their roles are live. If we keep, we might re-apply old roles if they lose them manually?
            // "Sticky" usually implies "Persist through leave/join". If they manually lose a role, should it come back on rejoin?
            // Typically sticky roles are ONLY updated on LEAVE.
            // So we don't clear here.
        }
    }

    /**
     * Handle Member Leave (Save Sticky Roles)
     */
    async onGuildMemberRemove(member: GuildMember | PartialUser) {
        // PartialUser doesn't have roles. We need GuildMember.
        // If the member is partial, we can't save roles.
        // But GuildMemberRemove usually passes GuildMember unless not cached.
        
        if (!('guild' in member)) return; // It's a User or PartialUser not Member?
        
        const m = member as GuildMember;
        if (m.user.bot) return;

        const rolesToSave = m.roles.cache
            .filter(r => !r.managed && r.name !== '@everyone')
            .map(r => r.id);

        if (rolesToSave.length === 0) return;

        await this.db.userLevel.upsert({
            where: {
                guildId_userId: {
                    guildId: m.guild.id,
                    userId: m.id
                }
            },
            update: {
                stickyRoles: rolesToSave
            },
            create: {
                guildId: m.guild.id,
                userId: m.id,
                stickyRoles: rolesToSave
            }
        });
    }

    /**
     * Handle Reaction Add (Reaction Roles)
     */
    async onMessageReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
        if (user.bot) return;
        await this.handleReaction(reaction, user, true);
    }

    /**
     * Handle Reaction Remove (Reaction Roles)
     */
    async onMessageReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
        if (user.bot) return;
        await this.handleReaction(reaction, user, false);
    }

    private async handleReaction(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, added: boolean) {
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                this.logger.error('Something went wrong when fetching the message: ', error);
                return;
            }
        }
        if (user.partial) {
            try {
                await user.fetch();
            } catch (error) {
                this.logger.error('Something went wrong when fetching the user: ', error);
                return;
            }
        }

        const messageId = reaction.message.id;
        const guildId = reaction.message.guild?.id;
        if (!guildId) return;

        // Check if this message is a reaction role message
        const rrMessage = await this.db.reactionRoleMessage.findUnique({
            where: { messageId },
            include: { mappings: true }
        });

        if (!rrMessage) return;

        // Find mapping for utilized emoji
        const emojiId = reaction.emoji.id || reaction.emoji.name;
        const mapping = rrMessage.mappings.find((m: any) => m.emoji === emojiId);

        if (mapping) {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(user.id);
            
            if (added) {
                await member.roles.add(mapping.roleId).catch(e => this.logger.error('Failed to add reaction role', e));
                this.logger.info(`Added role ${mapping.roleId} to ${user.tag}`);
            } else {
                await member.roles.remove(mapping.roleId).catch(e => this.logger.error('Failed to remove reaction role', e));
                this.logger.info(`Removed role ${mapping.roleId} from ${user.tag}`);
            }
        }
    }

    // =========================================================================
    // Core Logic
    // =========================================================================

    private async addXp(guildId: string, userId: string, amount: number, message: Message | null, fromVoice: boolean = false) {
        // Calculate new XP/Level
        const userLevel = await this.db.userLevel.upsert({
            where: { guildId_userId: { guildId, userId } },
            update: { 
                xp: { increment: amount },
                lastMessage: message ? new Date() : undefined
            },
            create: {
                guildId,
                userId,
                xp: amount,
                lastMessage: new Date()
            }
        });

        const currentLevel = userLevel.level;
        const newTotalXp = userLevel.xp;
        const calcLevel = calculateLevel(newTotalXp);

        if (calcLevel > currentLevel) {
            // Level Up!
            await this.db.userLevel.update({
                where: { guildId_userId: { guildId, userId } },
                data: { level: calcLevel }
            });

            // Announce
            await this.handleLevelUp(guildId, userId, calcLevel, message ? (message.channel as TextChannel) : null);
        }
    }

    private async handleLevelUp(guildId: string, userId: string, newLevel: number, channel: TextChannel | null) {
        const settings = await this.db.levellingSettings.findUnique({
            where: { guildId },
            include: { rewards: true }
        });

        if (!settings) return;

        // 1. Rewards
        const rewards = settings.rewards.filter((r: any) => r.level === newLevel);
        if (rewards.length > 0) {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            
            for (const reward of rewards) {
                await member.roles.add(reward.roleId).catch(e => console.error(e));
                
                if (!reward.stackPrevious) {
                    // Remove previous level roles?
                    // This logic is complex if we don't know which roles are "previous".
                    // Usually implies "remove lower level reward roles".
                    // We can find all lower level rewards and remove them.
                    const lowerRewards = settings.rewards.filter((r: any) => r.level < newLevel);
                    for (const lower of lowerRewards) {
                         await member.roles.remove(lower.roleId).catch(e => console.error(e));
                    }
                }
            }
        }

        // 2. Announce
        if (settings.announceLevelUp) {
            let targetChannel = channel;
            
            if (settings.announceChannelId) {
                try {
                    const c = await this.client.channels.fetch(settings.announceChannelId);
                    if (c && c.isTextBased()) targetChannel = c as TextChannel;
                } catch (e) { /* Invalid channel */ }
            }

            if (targetChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Level Up!')
                    .setDescription(`Congratulations <@${userId}>! You have reached **Level ${newLevel}**!`)
                    .setColor(0x00ff00)
                    .setTimestamp();
                    
                await targetChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    }
}
