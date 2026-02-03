import { 
    Message, 
    MessageReaction, 
    User, 
    PartialUser, 
    PartialMessageReaction,
    EmbedBuilder, 
    TextChannel, 
    PermissionFlagsBits, 
    ChannelType,
    Guild
} from 'discord.js';
import { IPlugin, IPluginContext, ILogger } from '../types/plugin';
import { z } from 'zod';

export class BeatBattlePlugin implements IPlugin {
    id = 'beat-battle';
    name = 'Beat Battle';
    description = 'Complete lifecycle management for beat battles.';
    version = '1.8.2';
    author = 'Fuji Studio';
    
    requiredPermissions = [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageRoles
    ];
    commands = [];
    dashboardSections = ['beat-battle'];
    defaultEnabled = true;
    configSchema = z.object({});

    events = ['messageCreate', 'messageReactionAdd', 'messageReactionRemove'];

    private logger!: ILogger;
    private db: any;
    private client: any;
    private watchdogInterval: NodeJS.Timeout | null = null;
    private votingEmoji = '🔥'; // Default, should load from config

    async initialize(context: IPluginContext): Promise<void> {
        this.logger = context.logger;
        this.db = context.db;
        this.client = context.client;

        this.logger.info('Beat Battle Manager initialized');
        this.startWatchdog();
    }

    async shutdown(): Promise<void> {
        if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    }

    private startWatchdog() {
        this.watchdogInterval = setInterval(() => this.cycle(), 10000); // 10s heartbeat
    }
    
    private async cycle() {
        try {
            // 1. Time-based transitions (Auto-Schedule)
            await this.checkSchedule();

            // 2. State-based executions (Transition Queue)
            await this.processTransitions();

        } catch (e) {
            this.logger.error('BeatBattle Cycle Error', e);
        }
    }

    // --- SCHEDULE & AUTOMATION ---

    private async checkSchedule() {
        const activeBattles = await this.db.beatBattle.findMany({
            where: { status: { not: 'ARCHIVED' } }
        });

        const now = new Date();

        for (const battle of activeBattles) {
            // Auto-Open Submissions
            if (battle.startDate && now >= new Date(battle.startDate) && ['SETUP', 'ANNOUNCED'].includes(battle.status)) {
                this.logger.info(`[Schedule] Opening submissions for ${battle.title}`);
                await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'OPENING_SUBS' } });
            }

            // Auto-Start Voting
            if (battle.votingDate && now >= new Date(battle.votingDate) && battle.status === 'SUBMISSIONS') {
                this.logger.info(`[Schedule] Starting voting for ${battle.title}`);
                await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'STARTING_VOTING' } });
            }

            // Auto-End Battle
            if (battle.endDate && now >= new Date(battle.endDate) && battle.status === 'VOTING') {
                this.logger.info(`[Schedule] Ending battle ${battle.title}`);
                await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'ENDING' } });
            }
        }
    }

    private async processTransitions() {
        const pending = await this.db.beatBattle.findMany({
            where: {
                status: { in: ['ANNOUNCING', 'OPENING_SUBS', 'STARTING_VOTING', 'ENDING', 'ARCHIVING', 'CREATING_CHANNEL'] }
            }
        });

        for (const battle of pending) {
            this.logger.info(`Processing Transition: ${battle.status} -> ${battle.title}`);
            try {
                switch (battle.status) {
                    case 'CREATING_CHANNEL': await this.doCreateChannel(battle); break;
                    case 'ANNOUNCING': await this.doAnnounce(battle); break;
                    case 'OPENING_SUBS': await this.doOpenSubs(battle); break;
                    case 'STARTING_VOTING': await this.doStartVoting(battle); break;
                    case 'ENDING': await this.doEnd(battle); break;
                    case 'ARCHIVING': await this.doArchive(battle); break;
                }
            } catch (e) {
                this.logger.error(`Failed execution for ${battle.status}`, e);
            }
        }
    }

    // --- EXECUTORS ---

    private async doCreateChannel(battle: any) {
        const config = await this.getConfig(battle.guildId);
        if (!config?.activeCategoryId) {
            this.logger.warn(`Cannot create channel: No Active Category set for guild ${battle.guildId}`);
            // Reset to SETUP so it doesn't loop forever
            await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'SETUP' } });
            return;
        }

        const guild = await this.client.guilds.fetch(battle.guildId);
        const newChannel = await guild.channels.create({
            name: `🪘◾submissions-${battle.number}`,
            type: ChannelType.GuildText,
            parent: config.activeCategoryId,
            permissionOverwrites: [
                { 
                    id: guild.id, 
                    deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions], 
                    allow: [PermissionFlagsBits.ViewChannel] 
                }
            ]
        });

        await this.db.beatBattleConfig.update({
            where: { guildId: battle.guildId },
            data: { submissionChannelId: newChannel.id }
        });
        
        await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'SETUP' } });
    }

    private async doAnnounce(battle: any) {
        await this.sendEmbed(battle, 'battle_announce');
        await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'ANNOUNCED' } });
    }

    private async doOpenSubs(battle: any) {
        const config = await this.getConfig(battle.guildId);
        if (config?.submissionChannelId) {
             const channel = await this.client.channels.fetch(config.submissionChannelId) as TextChannel;
             if (channel) {
                 // Unlock
                 await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                     SendMessages: true,
                     AddReactions: false
                 });
                 await this.sendEmbed(battle, 'submission_open', channel.id);
             }
        }
        await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'SUBMISSIONS' } });
    }

    private async doStartVoting(battle: any) {
        const config = await this.getConfig(battle.guildId);
        if (config?.submissionChannelId) {
             const channel = await this.client.channels.fetch(config.submissionChannelId) as TextChannel;
             if (channel) {
                 // Lock & seed
                 await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                     SendMessages: false,
                     AddReactions: true
                 });

                 await this.seedVotes(battle, channel);
                 await this.sendEmbed(battle, 'voting_begin', channel.id);
             }
        }
        await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'VOTING' } });
    }

    private async doEnd(battle: any) {
        // Just announce winners. The channel specific stuff happens in archive
        const winners = await this.calculateWinners(battle);
        await this.sendEmbed(battle, 'winners', undefined, winners); // Send to announcement channel
        await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'ENDED' } });
    }

    private async doArchive(battle: any) {
         const config = await this.getConfig(battle.guildId);
         if (config?.submissionChannelId && config?.archiveCategoryId) {
             try {
                const channel = await this.client.channels.fetch(config.submissionChannelId) as TextChannel;
                if (channel) {
                    const oldName = `archived-${battle.number}-${battle.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
                    await channel.setName(oldName.substring(0, 99));
                    await channel.setParent(config.archiveCategoryId, { lockPermissions: true });
                    
                    // Detach from config
                    await this.db.beatBattleConfig.update({
                        where: { guildId: battle.guildId },
                        data: { submissionChannelId: null }
                    });
                }
             } catch (e) {
                 this.logger.error('Archive failed', e);
             }
         }
         await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'ARCHIVED' } });
    }

    // --- HELPERS ---

    private async getConfig(guildId: string) {
        return await this.db.beatBattleConfig.findUnique({ where: { guildId } });
    }

    private async seedVotes(battle: any, channel: TextChannel) {
        const subs = await this.db.beatBattleSubmission.findMany({ where: { battleId: battle.id } });
        for (const sub of subs) {
            try {
                const msg = await channel.messages.fetch(sub.messageId);
                if (msg) await msg.react(this.votingEmoji);
            } catch (e) {}
        }
    }

    private async calculateWinners(battle: any) {
        // Simplified winner calc based on DB votes or reactions? 
        // Let's use DB votes as we are tracking them.
        // But for display in embed we need names etc.
        return []; 
    }

    private async sendEmbed(battle: any, type: string, targetChannelId?: string, extraData?: any) {
        const config = await this.getConfig(battle.guildId);
        let channelId = targetChannelId || config?.announcementChannelId;
        
        if (!channelId) return;

        try {
            const channel = await this.client.channels.fetch(channelId) as TextChannel;
            if (!channel) return;

            const embed = new EmbedBuilder();
            const rolePing = config?.notifyRoleId ? `<@&${config.notifyRoleId}>` : '';
            let content = rolePing;

            const getMsg = (key: string) => battle[key] || ''; 

            // Common Fields
            const addSponsor = () => {
                if (battle.sponsorName) {
                    const txt = battle.sponsorLink ? `[**${battle.sponsorName}**](${battle.sponsorLink})` : `**${battle.sponsorName}**`;
                    embed.addFields({ name: '🤝 Brought to you by', value: txt });
                }
            };

            switch (type) {
                case 'battle_announce':
                    embed.setTitle(`🏆 NEW BATTLE: ${battle.title}`)
                         .setColor(0xFFD700)
                         .setDescription(`${getMsg('announceText')}\n\nA new beat battle has been announced! Check the details below.`)
                         .addFields(
                            { name: '🎁 Prizes', value: battle.prizePool || 'None', inline: true },
                            { name: '📅 Date', value: `Ends: ${new Date(battle.endDate).toLocaleDateString()}`, inline: true }
                         );
                    if (battle.rules) embed.addFields({ name: '📜 Rules', value: battle.rules });
                    addSponsor();
                    break;
                
                case 'submission_open':
                    embed.setTitle(`📂 Submissions OPEN!`).setColor(0x57F287)
                         .setDescription(`${getMsg('openText')}\n\nThe queue for **${battle.title}** is now open!`);
                    
                    if (config?.submissionChannelId) {
                        embed.addFields({ name: '❓ How to Submit', value: `1. Drag your **.mp3** or **.wav** into <#${config.submissionChannelId}>\n2. **No text.** Just the file.\n3. Wait for the ${this.votingEmoji} reaction.` });
                    }
                    addSponsor();
                    break;

                case 'voting_begin':
                    embed.setTitle(`🗳️ Voting has BEGUN!`).setColor(0x5865F2)
                         .setDescription(`${getMsg('voteText')}\n\nSubmissions are closed. Pick your favorites!`);
                    if (config?.submissionChannelId) {
                        embed.addFields({ name: '📝 Instructions', value: `Go to <#${config.submissionChannelId}> and react with ${this.votingEmoji}.` });
                    }
                    break;

                case 'winners':
                    embed.setTitle(`🎉 WINNERS: ${battle.title}`).setColor(0xFF0055)
                         .setDescription(`${getMsg('winnerText')}\n\nThe results are in! (View specific results in the channel)`);
                    addSponsor();
                    break;
            }

            await channel.send({ content: content.trim() || undefined, embeds: [embed] });

        } catch (e) {
            this.logger.error(`Failed to send embed ${type}`, e);
        }
    }

    // --- EVENTS ---

    async onMessageCreate(message: Message): Promise<void> {
        if (message.author.bot || !message.guild) return;
        
        const config = await this.getConfig(message.guild.id);
        if (!config?.submissionChannelId || message.channelId !== config.submissionChannelId) return;

        // Strict Check Active Battle
        const battle = await this.db.beatBattle.findFirst({
            where: { guildId: message.guild.id, status: 'SUBMISSIONS' }
        });

        if (!battle) return; // Should be locked anyway, but double check

        // Validation
        const hasAttachment = message.attachments.size > 0;
        const validExt = message.attachments.every(a => a.name?.toLowerCase().endsWith('.mp3') || a.name?.toLowerCase().endsWith('.wav'));
        const hasText = message.content.trim().length > 0;

        if (!hasAttachment || !validExt || hasText) {
            try {
                await message.delete();
                const dm = await message.author.createDM();
                await dm.send(`❌ **Submission Rejected**\nOnly .mp3/.wav files allowed. No text.`);
            } catch (e) {}
            return;
        }

        // Valid
        await this.db.beatBattleSubmission.create({
            data: {
                battleId: battle.id,
                userId: message.author.id,
                messageId: message.id,
                attachmentUrl: message.attachments.first()!.url,
                filename: message.attachments.first()!.name || 'unknown'
            }
        });
        // Wait for seeding phase to react
    }

    async onMessageReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch();
        if (user.partial) await user.fetch();
        if (!reaction.message.guild) return;

        const config = await this.getConfig(reaction.message.guild.id);
        if (!config?.submissionChannelId || reaction.message.channelId !== config.submissionChannelId) return;
        
        // Check Phase
        const battle = await this.db.beatBattle.findFirst({
            where: { guildId: reaction.message.guild.id, status: 'VOTING' } // Only count in voting
        });

        if (!battle) {
            await reaction.users.remove(user.id);
            return;
        }

        if (reaction.emoji.name !== this.votingEmoji) {
            await reaction.users.remove(user.id);
            return;
        }

        // Check Count (Max 2)
        const voteCount = await this.db.beatBattleVote.count({
            where: { battleId: battle.id, userId: user.id }
        });

        if (voteCount >= 2) {
            await reaction.users.remove(user.id);
            try {
                const dm = await user.createDM();
                await dm.send(`⚠️ **Vote Limit**\nYou can only vote for 2 tracks.`);
            } catch (e) {}
            return;
        }

        // Register Vote
        const sub = await this.db.beatBattleSubmission.findFirst({ where: { messageId: reaction.message.id } });
        if (sub) {
            await this.db.beatBattleVote.create({
                data: { battleId: battle.id, submissionId: sub.id, userId: user.id }
            });
        }
    }

    async onMessageReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch();
        
        // Remove vote from DB
        const sub = await this.db.beatBattleSubmission.findFirst({ where: { messageId: reaction.message.id } });
        if (sub) {
            await this.db.beatBattleVote.deleteMany({
                where: { submissionId: sub.id, userId: user.id }
            });
        }
    }
}