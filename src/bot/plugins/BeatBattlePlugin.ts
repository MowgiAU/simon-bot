import { 
    Message, 
    MessageReaction, 
    User, 
    PartialUser, 
    PartialMessageReaction,
    EmbedBuilder, 
    TextChannel, 
    PermissionFlagsBits, 
    ChannelType
} from 'discord.js';
import { IPlugin, IPluginContext, ILogger } from '../types/plugin';
import { Logger } from '../utils/logger';
import { z } from 'zod';

export class BeatBattlePlugin implements IPlugin {
    id = 'beat-battle';
    name = 'Beat Battle';
    description = 'Automated music battle management system';
    version = '1.0.0';
    author = 'Fuji Studio';
    
    // Plugin Contract
    requiredPermissions = [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.EmbedLinks
    ];
    commands = [];
    dashboardSections = ['beat-battle'];
    defaultEnabled = true;
    configSchema = z.object({});

    // We listen to these events
    events = ['messageCreate', 'messageReactionAdd', 'messageReactionRemove'];

    private logger!: ILogger;
    private db: any;
    private client: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.logger = context.logger;
        this.db = context.db;
        this.client = context.client;

        this.logger.info('Beat Battle plugin initialized');
        
        // Start state watchdog
        this.startWatchdog();
    }

    async shutdown(): Promise<void> {
        // Cleanup if needed
    }
    
    private startWatchdog() {
        setInterval(() => this.checkStates(), 10000); // Check every 10s
    }
    
    private async checkStates() {
        try {
            // Find battles in transitional states
            const pendingBattles = await this.db.beatBattle.findMany({
                where: {
                    status: { in: ['ANNOUNCING', 'OPENING_SUBS', 'STARTING_VOTING', 'ENDING', 'ARCHIVING'] }
                }
            });
            
            for (const battle of pendingBattles) {
                this.logger.info(`Processing battle transition: ${battle.status} for ${battle.title}`);
                await this.processTransition(battle);
            }
        } catch (e) {
            this.logger.error('Error in Beat Battle watchdog', e);
        }
    }
    
    private async processTransition(battle: any) {
        switch (battle.status) {
            case 'ANNOUNCING': await this.doAnnounce(battle); break;
            case 'OPENING_SUBS': await this.doOpenSubs(battle); break;
            case 'STARTING_VOTING': await this.doStartVoting(battle); break;
            case 'ENDING': await this.doEnd(battle); break;
            case 'ARCHIVING': await this.doArchive(battle); break;
        }
    }
    
    // --- Actions ---
    
    private async doAnnounce(battle: any) {
        const config = await this.db.beatBattleConfig.findUnique({ where: { guildId: battle.guildId } });
        if (!config?.announcementChannelId) return; // Error handling needed
        
        const channel = await this.client.channels.fetch(config.announcementChannelId) as TextChannel;
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(`🥁 ${battle.title}`)
                .setDescription(battle.announceText || battle.description || 'New Beat Battle starting soon!')
                .setColor(0x00ff00);

            // Dates Field
            const datesValue = [
                `**Start:** ${new Date(battle.startDate).toLocaleDateString()}`,
                battle.votingDate ? `**Voting:** ${new Date(battle.votingDate).toLocaleDateString()}` : null,
                `**End:** ${new Date(battle.endDate).toLocaleDateString()}`
            ].filter(Boolean).join('\n');
            
            embed.addFields({ name: '📅 Timeline', value: datesValue, inline: true });
            
            // Battle Number
            embed.addFields({ name: '#', value: battle.number.toString(), inline: true });

            // Sponsor
            if (battle.sponsorName) {
                const val = battle.sponsorLink ? `[${battle.sponsorName}](${battle.sponsorLink})` : battle.sponsorName;
                embed.addFields({ name: '🤝 Sponsor', value: val, inline: true });
            }

            // Prize Pool
            if (battle.prizePool) {
                embed.addFields({ name: '🏆 Prize', value: battle.prizePool, inline: true });
            }

            // Rules
            if (battle.rules) {
                embed.addFields({ name: '📜 Rules', value: battle.rules, inline: false });
            }
            
            await channel.send({ embeds: [embed] });
        }
        
        // Advance state
        await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'ANNOUNCED' } });
    }
    
    private async doOpenSubs(battle: any) {
        const config = await this.db.beatBattleConfig.findUnique({ where: { guildId: battle.guildId } });
        if (config?.submissionChannelId) {
             const channel = await this.client.channels.fetch(config.submissionChannelId) as TextChannel;
             // Unlock channel: Grant SEND_MESSAGES to Everyone
             await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                 SendMessages: true,
                 AddReactions: false // Only allowed in voting
             });
             
             const msg = battle.openText || '🔓 **Submissions are now OPEN!**\nUpload your .mp3 / .wav file below.';
             await channel.send(msg);
        }
        await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'SUBMISSIONS' } });
    }
    
    private async doStartVoting(battle: any) {
        const config = await this.db.beatBattleConfig.findUnique({ where: { guildId: battle.guildId } });
        if (config?.submissionChannelId) {
             const channel = await this.client.channels.fetch(config.submissionChannelId) as TextChannel;
             // Lock channel: Deny SEND_MESSAGES, Allow ADD_REACTIONS
             await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                 SendMessages: false,
                 AddReactions: true
             });
             
             // Auto-seed: Find all submissions and react
             const submissions = await this.db.beatBattleSubmission.findMany({
                 where: { battleId: battle.id }
             });

             this.logger.info(`Auto-seeding ${submissions.length} submissions for battle ${battle.id}`);

             for (const sub of submissions) {
                 try {
                     const message = await channel.messages.fetch(sub.messageId);
                     if (message) await message.react('🔥');
                 } catch (e) {
                     this.logger.warn(`Failed to seed reaction for message ${sub.messageId}`);
                 }
             }
             
             const msg = battle.voteText || '🔒 **Submissions CLOSED.**\nVoting has begun! React with 🔥 to vote for your favorites.';
             await channel.send(msg);
        }
        await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'VOTING' } });
    }
    
    private async doEnd(battle: any) {
        const config = await this.db.beatBattleConfig.findUnique({ where: { guildId: battle.guildId } });
        // Calculate winner logic would go here
        
        // Notification
        if (config?.announcementChannelId) {
             const channel = await this.client.channels.fetch(config.announcementChannelId) as TextChannel;
             const msg = battle.winnerText || `🏆 **Beat Battle #${battle.number} has ended!**`;
             await channel.send(msg);
        }

        await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'ENDED' } });
    }
    
    private async doArchive(battle: any) {
         // Logic to rename/move channel
         await this.db.beatBattle.update({ where: { id: battle.id }, data: { status: 'ARCHIVED' } });
    }

    async onMessageCreate(message: Message): Promise<void> {
        if (message.author.bot) return;
        if (!message.guild) return;

        // Check if this channel is the submission channel for an active battle
        // Logic:
        // 1. Get config for guild
        // 2. Check if message.channel.id === config.submissionChannelId
        // 3. Check if there is an active battle in SUBMISSIONS phase
        // 4. Validate attachment (.mp3, .wav)
        // 5. If valid, no-op (maybe confirm DM). If invalid, delete & DM.
        
        await this.handleSubmission(message);
    }

    async onMessageReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch();
        if (user.partial) await user.fetch();

        // Check if this is a vote in the submission channel
        await this.handleVote(reaction as MessageReaction, user as User);
    }

    async onMessageReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
        // Optional: Untrack vote from DB
        await this.handleVoteRemoval(reaction as MessageReaction, user as User);
    }

    /**
     * Core Logic: Submission Handling
     */
    private async handleSubmission(message: Message) {
        // Fetch config & active battle
        const config = await this.db.beatBattleConfig.findUnique({ where: { guildId: message.guild!.id } });
        if (!config || config.submissionChannelId !== message.channelId) return;

        const activeBattle = await this.db.beatBattle.findFirst({
            where: { 
                guildId: message.guild!.id,
                status: 'SUBMISSIONS'
            }
        });

        if (!activeBattle) return;

        // Enforcement
        const hasAttachment = message.attachments.size > 0;
        const validExtensions = ['mp3', 'wav'];
        const isAudio = message.attachments.every(att => 
            validExtensions.some(ext => att.name?.toLowerCase().endsWith(ext))
        );

        // Allow text ONLY if it comes with a valid attachment (optional? User said "No chatting")
        // "Deletes messages that contain text or no attachments" -> Implies ONLY attachments allowed.
        // But usually people say "Here's my beat". Let's restrict strictness to "Must have attachment".
        // Actually prompt says: "deletes messages that contain text or no attachments"
        // This implies: Text is NOT allowed. Only file.
        
        const hasText = message.content.length > 0;

        if (!hasAttachment || !isAudio || hasText) {
            try {
                await message.delete();
                const user = await message.author.createDM();
                await user.send(`❌ **Submission Rejected**\n\nThe submission channel is for .mp3 and .wav files only. No text allowed during this phase.\n\nPlease upload just the file!`);
            } catch (e) {
                this.logger.error('Failed to moderate submission', e);
            }
            return;
        }

        // Valid Submission!
        // 1. Record in DB
        // 2. Add to auto-seed queue (if we want to seed immediately or later)
        try {
            await this.db.beatBattleSubmission.create({
                data: {
                    battleId: activeBattle.id,
                    userId: message.author.id,
                    messageId: message.id,
                    attachmentUrl: message.attachments.first()!.url,
                    filename: message.attachments.first()!.name || 'unknown'
                }
            });
            
            // Auto-react if configured (to help clicking) - Wait, prompt says "Auto-Seeding... allows users to click to vote".
            // If voting hasn't started, we might not want to react yet?
            // "Auto-Seeding: It automatically reacts with an emoji... on every valid submission"
            // Usually done at start of Voting phase? Or immediately?
            // If I react now, people can vote early.
            // Prompt says "Phase 3 Voting... Auto-Seeding". This implies seeing happens AT phase 3 transition.
            
        } catch (e) {
            this.logger.error('Failed to track submission', e);
        }
    }

    /**
     * Core Logic: Voting Handling
     */
    private async handleVote(reaction: MessageReaction, user: User) {
        const config = await this.db.beatBattleConfig.findUnique({ where: { guildId: reaction.message.guild!.id } });
        if (!config || config.submissionChannelId !== reaction.message.channelId) return;

        // Check if we are in VOTING phase
        const activeBattle = await this.db.beatBattle.findFirst({
            where: { 
                guildId: reaction.message.guild!.id,
                status: 'VOTING'
            }
        });

        if (!activeBattle) {
            // If not in voting phase, remove reaction?
            // "Reactions are ONLY allowed during the voting phase" (Prompt)
            try {
                await reaction.users.remove(user.id);
            } catch (e) {}
            return;
        }

        // Verify Emoji
        if (reaction.emoji.name !== config.votingEmoji) {
             await reaction.users.remove(user.id);
             return;
        }

        // Enforce 2 Vote Limit
        // Count user's current votes in this battle
        // We can query DB votes or scan reactions (DB is faster if we sync)
        
        // Let's assume we want to track votes in DB to Audit.
        // Check DB for active votes by this user for this battle.
        const userVotes = await this.db.beatBattleVote.count({
            where: {
                battleId: activeBattle.id,
                userId: user.id
            }
        });

        if (userVotes >= 2) {
             // 3rd vote attempt
             try {
                 await reaction.users.remove(user.id);
                 const dm = await user.createDM();
                 await dm.send(`⚠️ **Vote Limit Reached**\nYou can only vote for 2 active submissions per battle.`);
             } catch (e) {}
             return;
        }

        // Record Vote
        // Find submission by message ID
        const submission = await this.db.beatBattleSubmission.findFirst({
            where: { messageId: reaction.message.id }
        });

        if (submission) {
            await this.db.beatBattleVote.create({
                data: {
                    battleId: activeBattle.id,
                    submissionId: submission.id,
                    userId: user.id
                }
            });
        }
    }

    private async handleVoteRemoval(reaction: MessageReaction, user: User) {
        // Remove from DB to decrement count
         const submission = await this.db.beatBattleSubmission.findFirst({
            where: { messageId: reaction.message.id }
        });

        if (submission) {
             // Need active battle ID? Or just delete by submission/user interaction
             await this.db.beatBattleVote.deleteMany({
                 where: {
                     submissionId: submission.id,
                     userId: user.id
                 }
             });
        }
    }

    async shutdown(): Promise<void> {}
}
