import {
    Client,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ChannelType,
    PermissionFlagsBits,
    TextChannel,
    Message,
    Attachment,
    ButtonInteraction,
    GuildChannel,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

export class BeatBattlePlugin implements IPlugin {
    readonly id = 'beat-battle';
    readonly name = 'Beat Battle';
    readonly version = '1.0.0';
    readonly description = 'Host beat battles with Discord & web sync, voting, sponsors, and archives.';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = true;

    readonly requiredPermissions = [];
    readonly commands = ['battle'];
    readonly events = ['interactionCreate', 'messageCreate'];
    readonly dashboardSections = ['beat-battle'];

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
        announcementChannelId: z.string().optional(),
        battleCategoryId: z.string().optional(),
    });

    private db!: PrismaClient;
    private client!: Client;
    private logger: any;
    private logAction!: (data: any) => Promise<void>;

    private async getGuildSettings(guildId: string) {
        return this.db.beatBattleSettings.findUnique({ where: { guildId } });
    }
    private lifecycleInterval: ReturnType<typeof setInterval> | null = null;

    async initialize(context: IPluginContext): Promise<void> {
        this.db = context.db;
        this.client = context.client;
        this.logger = context.logger;
        this.logAction = context.logAction;
        this.logger.info('Beat Battle Plugin initialized');

        // Start lifecycle check every 60 seconds
        this.lifecycleInterval = setInterval(() => this.checkLifecycles(), 60_000);
    }

    async shutdown(): Promise<void> {
        if (this.lifecycleInterval) clearInterval(this.lifecycleInterval);
        this.logger.info('Beat Battle Plugin shutting down');
    }

    // ───── Slash Command Registration ─────

    async registerCommands() {
        const battleCommand = new SlashCommandBuilder()
            .setName('battle')
            .setDescription('Beat Battle commands')
            .addSubcommand(sub =>
                sub.setName('info')
                    .setDescription('View info about the current active battle')
            )
            .addSubcommand(sub =>
                sub.setName('submit')
                    .setDescription('Submit a track to the active battle')
                    .addAttachmentOption(opt =>
                        opt.setName('track')
                            .setDescription('Your audio file (MP3/WAV)')
                            .setRequired(true)
                    )
                    .addStringOption(opt =>
                        opt.setName('title')
                            .setDescription('Title of your beat')
                            .setRequired(true)
                    )
            )
            .addSubcommand(sub =>
                sub.setName('leaderboard')
                    .setDescription('View the current vote standings')
            );

        return [battleCommand];
    }

    // ───── Interaction Router ─────

    async onInteractionCreate(interaction: any): Promise<void> {
        if (interaction.isChatInputCommand() && interaction.commandName === 'battle') {
            const sub = interaction.options.getSubcommand();
            if (sub === 'info') await this.handleInfo(interaction);
            else if (sub === 'submit') await this.handleSubmit(interaction);
            else if (sub === 'leaderboard') await this.handleLeaderboard(interaction);
        }

        // Handle vote button clicks
        if (interaction.isButton() && interaction.customId.startsWith('battle_vote_')) {
            await this.handleVoteButton(interaction);
        }
    }

    // ───── Discord Audio Submission from Channel ─────

    async onMessageCreate(message: Message): Promise<void> {
        if (message.author.bot || !message.guildId) return;

        // Check if this message is in a battle submissions channel
        const battle = await this.db.beatBattle.findFirst({
            where: {
                submissionChannelId: message.channelId,
                status: 'active',
            },
        });

        if (!battle) return;

        // Check for audio attachments
        const audioAttachment = message.attachments.find((a: Attachment) =>
            a.contentType?.startsWith('audio/') ||
            a.name?.endsWith('.mp3') ||
            a.name?.endsWith('.wav') ||
            a.name?.endsWith('.flac')
        );

        if (!audioAttachment) return;

        // Check if user already submitted
        const existingEntry = await this.db.battleEntry.findUnique({
            where: { battleId_userId: { battleId: battle.id, userId: message.author.id } },
        });

        if (existingEntry) {
            await message.reply({ content: 'You already have a submission for this battle! One entry per person.' });
            return;
        }

        try {
            // Download and save the audio file
            const response = await fetch(audioAttachment.url);
            const buffer = Buffer.from(await response.arrayBuffer());
            const uploadsDir = path.join(PROJECT_ROOT, 'public/uploads/battles');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

            const uniqueName = `battle-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(audioAttachment.name || '.mp3')}`;
            const filePath = path.join(uploadsDir, uniqueName);
            fs.writeFileSync(filePath, buffer);

            const audioUrl = `/uploads/battles/${uniqueName}`;
            const title = message.content?.trim() || audioAttachment.name || 'Untitled Beat';

            // Create entry
            const entry = await this.db.battleEntry.create({
                data: {
                    battleId: battle.id,
                    userId: message.author.id,
                    username: message.author.displayName || message.author.username,
                    trackTitle: title,
                    audioUrl,
                    source: 'discord',
                },
            });

            // Post formatted embed with vote button
            const embed = this.buildEntryEmbed(entry, message.author.displayAvatarURL(), battle.title);
            const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`battle_vote_${entry.id}`)
                    .setLabel('Vote (0)')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔥')
            );

            const embedMsg = await (message.channel as TextChannel).send({ embeds: [embed], components: [voteRow] });

            // Save the embed message ID
            await this.db.battleEntry.update({
                where: { id: entry.id },
                data: { discordMsgId: embedMsg.id },
            });

            // Record analytics event
            await this.db.battleAnalytics.create({
                data: { battleId: battle.id, eventType: 'submission', userId: message.author.id },
            });

            await message.react('✅');
            this.logger.info(`Beat Battle: ${message.author.username} submitted "${title}" to "${battle.title}"`);
        } catch (err) {
            this.logger.error('Beat Battle: Failed to process Discord submission', err);
            await message.reply({ content: 'Something went wrong processing your submission. Please try again.' });
        }
    }

    // ───── Vote Button Handler ─────

    private async handleVoteButton(interaction: ButtonInteraction): Promise<void> {
        const entryId = interaction.customId.replace('battle_vote_', '');

        const entry = await this.db.battleEntry.findUnique({
            where: { id: entryId },
            include: { battle: true },
        });

        if (!entry) {
            await interaction.reply({ content: 'This submission no longer exists.', ephemeral: true });
            return;
        }

        if (entry.battle.status !== 'voting' && entry.battle.status !== 'active') {
            await interaction.reply({ content: 'Voting is not currently open for this battle.', ephemeral: true });
            return;
        }

        // Cannot vote for yourself
        if (entry.userId === interaction.user.id) {
            await interaction.reply({ content: 'You cannot vote for your own submission!', ephemeral: true });
            return;
        }

        // Check if already voted for this entry
        const existingVote = await this.db.battleVote.findUnique({
            where: { entryId_userId: { entryId, userId: interaction.user.id } },
        });

        if (existingVote) {
            await interaction.reply({ content: 'You have already voted for this submission!', ephemeral: true });
            return;
        }

        // Record vote
        await this.db.battleVote.create({
            data: { entryId, userId: interaction.user.id, source: 'discord' },
        });

        // Increment denormalized count
        const updated = await this.db.battleEntry.update({
            where: { id: entryId },
            data: { voteCount: { increment: 1 } },
        });

        // Record analytics
        await this.db.battleAnalytics.create({
            data: { battleId: entry.battleId, eventType: 'vote_cast', userId: interaction.user.id },
        });

        // Update button label with new count
        try {
            const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`battle_vote_${entryId}`)
                    .setLabel(`Vote (${updated.voteCount})`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔥')
            );
            await interaction.update({ components: [voteRow] });
        } catch {
            await interaction.reply({ content: `Vote recorded! (${updated.voteCount} total)`, ephemeral: true });
        }
    }

    // ───── /battle info ─────

    private async handleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
        const battle = await this.db.beatBattle.findFirst({
            where: {
                guildId: interaction.guildId!,
                status: { in: ['active', 'voting', 'upcoming'] },
            },
            include: { sponsor: true, _count: { select: { entries: true } } },
            orderBy: { createdAt: 'desc' },
        });

        if (!battle) {
            await interaction.reply({ content: 'No active beat battle right now. Stay tuned!', ephemeral: true });
            return;
        }

        const statusLabel = { upcoming: '📅 Upcoming', active: '🎵 Submissions Open', voting: '🗳️ Voting Open', completed: '🏆 Completed' }[battle.status] || battle.status;

        const embed = new EmbedBuilder()
            .setTitle(`🎤 ${battle.title}`)
            .setDescription(battle.description || 'No description provided.')
            .setColor(0x2B8C71)
            .addFields(
                { name: 'Status', value: statusLabel, inline: true },
                { name: 'Entries', value: `${battle._count.entries}`, inline: true },
            )
            .setFooter({ text: 'Fuji Studio Beat Battle' })
            .setTimestamp();

        if (battle.submissionEnd) {
            embed.addFields({ name: 'Submissions Close', value: `<t:${Math.floor(battle.submissionEnd.getTime() / 1000)}:R>`, inline: true });
        }
        if (battle.votingEnd) {
            embed.addFields({ name: 'Voting Ends', value: `<t:${Math.floor(battle.votingEnd.getTime() / 1000)}:R>`, inline: true });
        }
        if (battle.rules) {
            embed.addFields({ name: '📋 Rules', value: battle.rules });
        }
        if (battle.sponsor) {
            let sponsorText = `**${battle.sponsor.name}**`;
            if (battle.sponsor.websiteUrl) sponsorText += ` — [Website](${battle.sponsor.websiteUrl})`;
            embed.addFields({ name: '🤝 Sponsored by', value: sponsorText });
            if (battle.sponsor.logoUrl) embed.setThumbnail(battle.sponsor.logoUrl);
        }

        await interaction.reply({ embeds: [embed] });
    }

    // ───── /battle submit ─────

    private async handleSubmit(interaction: ChatInputCommandInteraction): Promise<void> {
        const battle = await this.db.beatBattle.findFirst({
            where: { guildId: interaction.guildId!, status: 'active' },
            orderBy: { createdAt: 'desc' },
        });

        if (!battle) {
            await interaction.reply({ content: 'No active battle accepting submissions right now.', ephemeral: true });
            return;
        }

        const existingEntry = await this.db.battleEntry.findUnique({
            where: { battleId_userId: { battleId: battle.id, userId: interaction.user.id } },
        });

        if (existingEntry) {
            await interaction.reply({ content: 'You already submitted a track to this battle!', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const attachment = interaction.options.getAttachment('track', true);
        const title = interaction.options.getString('title', true);

        if (!attachment.contentType?.startsWith('audio/') && !attachment.name?.match(/\.(mp3|wav|flac|ogg)$/i)) {
            await interaction.editReply({ content: 'Please upload an audio file (MP3, WAV, FLAC).' });
            return;
        }

        try {
            const response = await fetch(attachment.url);
            const buffer = Buffer.from(await response.arrayBuffer());
            const uploadsDir = path.join(PROJECT_ROOT, 'public/uploads/battles');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

            const uniqueName = `battle-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(attachment.name || '.mp3')}`;
            const filePath = path.join(uploadsDir, uniqueName);
            fs.writeFileSync(filePath, buffer);

            const audioUrl = `/uploads/battles/${uniqueName}`;

            const entry = await this.db.battleEntry.create({
                data: {
                    battleId: battle.id,
                    userId: interaction.user.id,
                    username: interaction.user.displayName || interaction.user.username,
                    trackTitle: title,
                    audioUrl,
                    source: 'discord',
                },
            });

            // Post embed in submissions channel
            if (battle.submissionChannelId) {
                const channel = await this.client.channels.fetch(battle.submissionChannelId) as TextChannel | null;
                if (channel) {
                    const embed = this.buildEntryEmbed(entry, interaction.user.displayAvatarURL(), battle.title);
                    const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`battle_vote_${entry.id}`)
                            .setLabel('Vote (0)')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔥')
                    );
                    const embedMsg = await channel.send({ embeds: [embed], components: [voteRow] });
                    await this.db.battleEntry.update({
                        where: { id: entry.id },
                        data: { discordMsgId: embedMsg.id },
                    });
                }
            }

            await this.db.battleAnalytics.create({
                data: { battleId: battle.id, eventType: 'submission', userId: interaction.user.id },
            });

            await interaction.editReply({ content: `Your beat "${title}" has been submitted! Good luck! 🔥` });
        } catch (err) {
            this.logger.error('Beat Battle: slash submit failed', err);
            await interaction.editReply({ content: 'Failed to process your submission. Please try again.' });
        }
    }

    // ───── /battle leaderboard ─────

    private async handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
        const battle = await this.db.beatBattle.findFirst({
            where: {
                guildId: interaction.guildId!,
                status: { in: ['active', 'voting', 'completed'] },
            },
            include: {
                entries: { orderBy: { voteCount: 'desc' }, take: 10 },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!battle || battle.entries.length === 0) {
            await interaction.reply({ content: 'No entries to show yet.', ephemeral: true });
            return;
        }

        const lines = battle.entries.map((e, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            return `${medal} **${e.trackTitle}** by <@${e.userId}> — ${e.voteCount} votes`;
        });

        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${battle.title} — Leaderboard`)
            .setDescription(lines.join('\n'))
            .setColor(0x2B8C71)
            .setFooter({ text: 'Fuji Studio Beat Battle' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    // ───── Lifecycle Checks (Auto-transition) ─────

    private async checkLifecycles(): Promise<void> {
        const now = new Date();
        try {
            // Upcoming → Active (submission period started)
            const toActivate = await this.db.beatBattle.findMany({
                where: { status: 'upcoming', submissionStart: { lte: now } },
            });
            for (const battle of toActivate) {
                await this.transitionToActive(battle);
            }

            // Active → Voting (submission period ended)
            const toVoting = await this.db.beatBattle.findMany({
                where: { status: 'active', submissionEnd: { lte: now } },
            });
            for (const battle of toVoting) {
                await this.transitionToVoting(battle);
            }

            // Voting → Completed (voting period ended)
            const toComplete = await this.db.beatBattle.findMany({
                where: { status: 'voting', votingEnd: { lte: now } },
                include: { entries: { orderBy: { voteCount: 'desc' }, take: 1 } },
            });
            for (const battle of toComplete) {
                await this.transitionToCompleted(battle);
            }
        } catch (err) {
            this.logger.error('Beat Battle lifecycle check failed', err);
        }
    }

    private async transitionToActive(battle: any): Promise<void> {
        this.logger.info(`Beat Battle: Activating "${battle.title}"`);

        const settings = await this.getGuildSettings(battle.guildId);

        // Create submissions channel
        let channelId = battle.submissionChannelId;
        try {
            const guild = await this.client.guilds.fetch(battle.guildId);
            const channelName = `submissions-${battle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
            const categoryId = battle.categoryId || settings?.submissionCategoryId || settings?.battleCategoryId || undefined;
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryId,
                topic: `Submit your beats for: ${battle.title}`,
            });
            channelId = channel.id;

            // Send instructions embed
            const instrEmbed = new EmbedBuilder()
                .setTitle(`🎵 ${battle.title} — Submissions Open!`)
                .setDescription('Drop your audio file (MP3/WAV) in this channel to submit, or use `/battle submit`.\n\nOne entry per person. Good luck!')
                .setColor(0x2B8C71);
            await channel.send({ embeds: [instrEmbed] });
        } catch (err) {
            this.logger.error('Beat Battle: Failed to create submissions channel', err);
        }

        await this.db.beatBattle.update({
            where: { id: battle.id },
            data: { status: 'active', submissionChannelId: channelId },
        });
    }

    private async transitionToVoting(battle: any): Promise<void> {
        this.logger.info(`Beat Battle: Transitioning "${battle.title}" to voting`);

        await this.db.beatBattle.update({
            where: { id: battle.id },
            data: { status: 'voting' },
        });

        const settings = await this.getGuildSettings(battle.guildId);
        const annChannelId = battle.announcementChannelId || settings?.announcementChannelId;

        // Post announcement that voting is open
        if (annChannelId) {
            try {
                const channel = await this.client.channels.fetch(annChannelId) as TextChannel | null;
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle(`🗳️ ${battle.title} — Voting is Now Open!`)
                        .setDescription('Submissions are closed. Head to the submissions channel and hit the 🔥 Vote button on your favorite beat!')
                        .setColor(0xFFA500)
                        .setTimestamp();
                    if (battle.votingEnd) {
                        embed.addFields({ name: 'Voting Ends', value: `<t:${Math.floor(battle.votingEnd.getTime() / 1000)}:R>` });
                    }
                    await channel.send({ embeds: [embed] });
                }
            } catch (err) {
                this.logger.error('Beat Battle: Failed to post voting announcement', err);
            }
        }
    }

    private async transitionToCompleted(battle: any): Promise<void> {
        this.logger.info(`Beat Battle: Completing "${battle.title}"`);

        const winner = battle.entries?.[0];
        const settings = await this.getGuildSettings(battle.guildId);

        await this.db.beatBattle.update({
            where: { id: battle.id },
            data: {
                status: 'completed',
                winnerEntryId: winner?.id || null,
            },
        });

        // Archive submissions channel (set to read-only, move to archive category)
        if (battle.submissionChannelId) {
            try {
                const guild = await this.client.guilds.fetch(battle.guildId);
                const channel = await guild.channels.fetch(battle.submissionChannelId) as GuildChannel | null;
                if (channel) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false,
                        AddReactions: false,
                    });
                    // Move to archive category if configured
                    if (settings?.archiveCategoryId) {
                        await channel.setParent(settings.archiveCategoryId, { lockPermissions: false });
                    }
                    // Rename with archived prefix
                    await channel.setName(`archived-${channel.name}`.slice(0, 100));
                }
            } catch (err) {
                this.logger.error('Beat Battle: Failed to archive channel', err);
            }
        }

        // Post winner spotlight
        const annChannelId = battle.announcementChannelId || settings?.announcementChannelId;
        if (winner && annChannelId) {
            try {
                const channel = await this.client.channels.fetch(annChannelId) as TextChannel | null;
                if (channel) {
                    const apiUrl = process.env.API_URL || 'https://fujistudio.app';
                    const embed = new EmbedBuilder()
                        .setTitle(`🏆 ${battle.title} — Winner!`)
                        .setDescription(`Congratulations to <@${winner.userId}>!\n\n**"${winner.trackTitle}"** with **${winner.voteCount}** votes!`)
                        .setColor(0xFFD700)
                        .addFields({ name: '🎧 Listen', value: `[Play on Fuji Studio](${apiUrl}/battles/archive)` })
                        .setFooter({ text: 'Fuji Studio Beat Battle' })
                        .setTimestamp();
                    const spotlightMsg = await channel.send({ embeds: [embed] });

                    await this.db.beatBattle.update({
                        where: { id: battle.id },
                        data: { winnerSpotlightMsgId: spotlightMsg.id },
                    });
                }
            } catch (err) {
                this.logger.error('Beat Battle: Failed to post winner spotlight', err);
            }
        }
    }

    // ───── Announcement Posting (called from API when battle is created) ─────

    async postAnnouncement(battle: any): Promise<string | null> {
        const settings = await this.getGuildSettings(battle.guildId);
        const annChannelId = battle.announcementChannelId || settings?.announcementChannelId;
        if (!annChannelId) return null;

        try {
            const channel = await this.client.channels.fetch(annChannelId) as TextChannel | null;
            if (!channel) return null;

            const embed = new EmbedBuilder()
                .setTitle(`🎤 New Beat Battle: ${battle.title}`)
                .setDescription(battle.description || 'A new beat battle has been announced!')
                .setColor(0x2B8C71)
                .setFooter({ text: 'Fuji Studio Beat Battle' })
                .setTimestamp();

            if (battle.submissionStart) {
                embed.addFields({ name: '🗓️ Submissions Open', value: `<t:${Math.floor(new Date(battle.submissionStart).getTime() / 1000)}:F>`, inline: true });
            }
            if (battle.submissionEnd) {
                embed.addFields({ name: '🔒 Submissions Close', value: `<t:${Math.floor(new Date(battle.submissionEnd).getTime() / 1000)}:F>`, inline: true });
            }
            if (battle.rules) {
                embed.addFields({ name: '📋 Rules', value: battle.rules });
            }

            // Sponsor info
            if (battle.sponsor) {
                let sponsorText = `**${battle.sponsor.name}**`;
                if (battle.sponsor.websiteUrl) sponsorText += ` — [Visit Website](${battle.sponsor.websiteUrl})`;
                embed.addFields({ name: '🤝 Sponsored by', value: sponsorText });
                if (battle.sponsor.logoUrl) embed.setThumbnail(battle.sponsor.logoUrl);

                // Add promo links as buttons
                if (battle.sponsor.links?.length) {
                    const linkRow = new ActionRowBuilder<ButtonBuilder>();
                    for (const link of battle.sponsor.links.slice(0, 5)) {
                        linkRow.addComponents(
                            new ButtonBuilder()
                                .setLabel(link.label)
                                .setURL(link.url)
                                .setStyle(ButtonStyle.Link)
                        );
                    }
                    const msg = await channel.send({ embeds: [embed], components: [linkRow] });
                    return msg.id;
                }
            }

            const msg = await channel.send({ embeds: [embed] });
            return msg.id;
        } catch (err) {
            this.logger.error('Beat Battle: Failed to post announcement', err);
            return null;
        }
    }

    // Post entry embed to Discord submissions channel (called from API when web submission happens)
    async postEntryToDiscord(entry: any, battle: any): Promise<string | null> {
        if (!battle.submissionChannelId) return null;

        try {
            const channel = await this.client.channels.fetch(battle.submissionChannelId) as TextChannel | null;
            if (!channel) return null;

            const embed = this.buildEntryEmbed(entry, null, battle.title);
            const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`battle_vote_${entry.id}`)
                    .setLabel(`Vote (${entry.voteCount || 0})`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔥')
            );

            const msg = await channel.send({ embeds: [embed], components: [voteRow] });
            return msg.id;
        } catch (err) {
            this.logger.error('Beat Battle: Failed to post entry to Discord', err);
            return null;
        }
    }

    // Update vote count on Discord embed
    async updateDiscordVoteCount(entry: any): Promise<void> {
        if (!entry.discordMsgId) return;

        const battle = await this.db.beatBattle.findUnique({ where: { id: entry.battleId } });
        if (!battle?.submissionChannelId) return;

        try {
            const channel = await this.client.channels.fetch(battle.submissionChannelId) as TextChannel | null;
            if (!channel) return;

            const msg = await channel.messages.fetch(entry.discordMsgId);
            const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`battle_vote_${entry.id}`)
                    .setLabel(`Vote (${entry.voteCount})`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔥')
            );
            await msg.edit({ components: [voteRow] });
        } catch (err) {
            this.logger.error('Beat Battle: Failed to update Discord vote count', err);
        }
    }

    // ───── Helpers ─────

    private buildEntryEmbed(entry: any, avatarUrl: string | null, battleTitle: string): EmbedBuilder {
        const apiUrl = process.env.API_URL || 'https://fujistudio.app';
        const embed = new EmbedBuilder()
            .setTitle(`🎵 ${entry.trackTitle}`)
            .setDescription(`Submitted by **${entry.username}**`)
            .setColor(0x2B8C71)
            .addFields(
                { name: '🎤 Battle', value: battleTitle, inline: true },
                { name: '🔥 Votes', value: `${entry.voteCount || 0}`, inline: true },
                { name: '🎧 Listen', value: `[Play on Web](${apiUrl}${entry.audioUrl})` },
            )
            .setFooter({ text: 'Click the Vote button to support this entry!' })
            .setTimestamp();

        if (avatarUrl) embed.setThumbnail(avatarUrl);
        if (entry.coverUrl) embed.setImage(`${apiUrl}${entry.coverUrl}`);

        return embed;
    }
}
