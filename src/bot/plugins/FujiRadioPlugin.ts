import {
    PermissionsBitField,
    SlashCommandBuilder,
    EmbedBuilder,
    ChatInputCommandInteraction,
    VoiceChannel,
    GuildMember,
    TextChannel,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    type PermissionResolvable,
} from 'discord.js';
import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType,
    type VoiceConnection,
    type AudioPlayer,
    type AudioResource,
} from '@discordjs/voice';
import { z } from 'zod';
import type { IPlugin, IPluginContext } from '../types/plugin.js';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { PassThrough } from 'stream';

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegInstaller.path);

// ─── Types ──────────────────────────────────────────────────────────────────

interface NowPlaying {
    trackId: string;
    title: string;
    artist: string;
    coverUrl: string | null;
    url: string;
    duration: number;
    startedAt: number;
    profileId: string;
    artistUserId?: string;
}

interface RadioState {
    mode: 'auto' | 'host';
    hostUserId: string | null;
    connection: VoiceConnection | null;
    player: AudioPlayer | null;
    nowPlaying: NowPlaying | null;
    queue: NowPlaying[];
    volume: number;
    ducked: boolean;
    songsSinceAd: number;
    paused: boolean;
    listeners: Set<string>;
    killStream?: () => void;
}

// ─── Plugin ─────────────────────────────────────────────────────────────────

export class FujiRadioPlugin implements IPlugin {
    readonly id = 'fuji-radio';
    readonly name = 'Fuji FM';
    readonly description = 'Community radio: 24/7 auto-pilot, live host DJ mode, ads, tips, and listener XP';
    readonly version = '1.0.0';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions: PermissionResolvable[] = [
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak,
        PermissionsBitField.Flags.ManageMessages,
    ];
    readonly commands = ['radio', 'tip', 'like', 'nowplaying'];
    readonly events = ['interactionCreate', 'voiceStateUpdate'];
    readonly dashboardSections = ['fuji-radio'];
    readonly defaultEnabled = true;
    readonly configSchema = z.object({});

    private client: any;
    private db: any;
    private logger: any;
    private context!: IPluginContext;

    // Per-guild radio state
    private radioStates = new Map<string, RadioState>();

    // Listener XP tracking: guildId:userId -> lastXpTick
    private listenerXpTicks = new Map<string, number>();

    // XP tick interval
    private xpInterval: ReturnType<typeof setInterval> | null = null;

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;

        // Start listener XP ticker (every 60s)
        this.xpInterval = setInterval(() => this.tickListenerXp(), 60_000);

        this.logger.info('[FujiRadio] Plugin initialized');
    }

    async shutdown(): Promise<void> {
        if (this.xpInterval) clearInterval(this.xpInterval);

        // Disconnect all radio sessions
        for (const [guildId, state] of this.radioStates) {
            try {
                state.player?.stop(true);
                state.connection?.destroy();
            } catch { /* ignore */ }
        }
        this.radioStates.clear();
        this.listenerXpTicks.clear();
    }

    // ─── Slash Commands ──────────────────────────────────────────────────

    registerCommands() {
        return [
            new SlashCommandBuilder()
                .setName('radio')
                .setDescription('Fuji FM Radio controls')
                .addSubcommand(sub =>
                    sub.setName('start').setDescription('Start the radio in auto-pilot mode'))
                .addSubcommand(sub =>
                    sub.setName('stop').setDescription('Stop the radio'))
                .addSubcommand(sub =>
                    sub.setName('host').setDescription('Switch to live host/DJ mode'))
                .addSubcommand(sub =>
                    sub.setName('skip').setDescription('Skip the current track'))
                .addSubcommand(sub =>
                    sub.setName('queue')
                        .setDescription('Add a track to the queue')
                        .addStringOption(opt =>
                            opt.setName('track').setDescription('Track title to search for').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('np').setDescription('Show what\'s currently playing'))
                .toJSON(),

            new SlashCommandBuilder()
                .setName('tip')
                .setDescription('Tip the currently playing artist')
                .addIntegerOption(opt =>
                    opt.setName('amount').setDescription('Amount to tip').setMinValue(1).setRequired(true))
                .toJSON(),

            new SlashCommandBuilder()
                .setName('like')
                .setDescription('Add the currently playing track to your favourites')
                .toJSON(),

            new SlashCommandBuilder()
                .setName('nowplaying')
                .setDescription('Show the current Fuji FM track')
                .toJSON(),
        ];
    }

    // ─── Event Handlers ──────────────────────────────────────────────────

    async onInteractionCreate(interaction: any): Promise<boolean> {
        if (!interaction.isChatInputCommand()) return false;

        const { commandName } = interaction;
        const guildId = interaction.guildId;
        if (!guildId) return false;

        try {
            switch (commandName) {
                case 'radio': return await this.handleRadioCommand(interaction);
                case 'tip': return await this.handleTipCommand(interaction);
                case 'like': return await this.handleLikeCommand(interaction);
                case 'nowplaying': return await this.handleNowPlayingCommand(interaction);
                default: return false;
            }
        } catch (error) {
            this.logger.error(`[FujiRadio] Command error: ${error}`);
            try {
                if (interaction.deferred) {
                    await interaction.editReply({ content: '❌ An error occurred.' });
                } else if (!interaction.replied) {
                    await interaction.reply({ content: '❌ An error occurred.', flags: MessageFlags.Ephemeral });
                }
            } catch { /* ignore follow-up failure */ }
            return true;
        }
    }

    async handleEvent(event: string, ...args: any[]): Promise<void> {
        if (event === 'voiceStateUpdate') {
            await this.onVoiceStateUpdate(args[0], args[1]);
        }
    }

    // ─── /radio Commands ─────────────────────────────────────────────────

    private async handleRadioCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        switch (sub) {
            case 'start': return await this.cmdStart(interaction, guildId);
            case 'stop': return await this.cmdStop(interaction, guildId);
            case 'host': return await this.cmdHost(interaction, guildId);
            case 'skip': return await this.cmdSkip(interaction, guildId);
            case 'queue': return await this.cmdQueue(interaction, guildId);
            case 'np': return await this.cmdNowPlaying(interaction, guildId);
            default: return false;
        }
    }

    // ── /radio start ──
    private async cmdStart(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        await interaction.deferReply();

        const settings = await this.getSettings(guildId);
        if (!settings.voiceChannelId) {
            await interaction.editReply('⚠️ No radio voice channel configured. Set one in the dashboard.');
            return true;
        }

        const existing = this.radioStates.get(guildId);
        if (existing?.connection) {
            await interaction.editReply('📻 Radio is already running!');
            return true;
        }

        // Join voice channel
        const channel = await this.client.channels.fetch(settings.voiceChannelId).catch(() => null);
        if (!channel || channel.type !== ChannelType.GuildVoice) {
            await interaction.editReply('⚠️ Could not find the radio voice channel.');
            return true;
        }

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId,
                adapterCreator: (channel as VoiceChannel).guild.voiceAdapterCreator as any,
                selfDeaf: false,
                selfMute: false,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

            const player = createAudioPlayer();
            connection.subscribe(player);

            const state: RadioState = {
                mode: 'auto',
                hostUserId: null,
                connection,
                player,
                nowPlaying: null,
                queue: [],
                volume: settings.defaultVolume,
                ducked: false,
                songsSinceAd: 0,
                paused: false,
                listeners: new Set(),
            };

            this.radioStates.set(guildId, state);

            // Handle connection disconnect — try to reconnect if booted from channel
            connection.on(VoiceConnectionStatus.Disconnected as any, async () => {
                try {
                    // Give Discord 5s to auto-reconnect (e.g. network hiccup)
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch {
                    // Auto-reconnect failed — bot was likely force-disconnected
                    // Destroy old connection, wait briefly, then rejoin
                    try { connection.destroy(); } catch { /* ignore */ }
                    this.radioStates.delete(guildId);
                    this.logger.info(`[FujiRadio] Disconnected from ${guildId}, attempting rejoin in 5s...`);
                    setTimeout(() => {
                        this.startAuto(guildId).catch(err =>
                            this.logger.error(`[FujiRadio] Rejoin failed for ${guildId}: ${err}`)
                        );
                    }, 5_000);
                }
            });

            // When player goes idle, play next track
            player.on(AudioPlayerStatus.Idle, () => {
                this.playNextTrack(guildId).catch(err =>
                    this.logger.error(`[FujiRadio] Auto-play error: ${err}`)
                );
            });

            // Auto-populate queue and start playing
            await this.populateAutoQueue(guildId, settings);
            await this.playNextTrack(guildId);

            const embed = new EmbedBuilder()
                .setTitle('📻 Fuji FM — Now Live!')
                .setDescription('The radio is now broadcasting in auto-pilot mode.')
                .setColor(0x2B8C71);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.logger.error(`[FujiRadio] Failed to start: ${error}`);
            await interaction.editReply('❌ Failed to start the radio. Check bot permissions.');
        }

        return true;
    }

    // ── /radio stop ──
    private async cmdStop(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        await interaction.deferReply();

        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.editReply('⚠️ You need Manage Server permission to stop the radio.');
            return true;
        }

        this.cleanupGuild(guildId);
        await interaction.editReply('🔇 Fuji FM has been stopped.');
        return true;
    }

    // ── /radio host ──
    private async cmdHost(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        await interaction.deferReply();

        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.editReply('⚠️ You need Manage Server permission to host.');
            return true;
        }

        const state = this.radioStates.get(guildId);
        if (!state?.connection) {
            await interaction.editReply('⚠️ Radio is not running. Start it first with `/radio start`.');
            return true;
        }

        state.mode = 'host';
        state.hostUserId = interaction.user.id;

        const embed = new EmbedBuilder()
            .setTitle('🎙️ Live Host Mode')
            .setDescription(`**${interaction.user.displayName}** is now hosting Fuji FM!\nThe music will duck when you speak.`)
            .setColor(0xFFD700);

        await interaction.editReply({ embeds: [embed] });
        return true;
    }

    // ── /radio skip ──
    private async cmdSkip(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        const state = this.radioStates.get(guildId);
        if (!state?.player || !state.nowPlaying) {
            await interaction.reply({ content: '⚠️ Nothing is playing.', flags: MessageFlags.Ephemeral });
            return true;
        }

        // Record skip in history
        await this.recordHistory(guildId, state.nowPlaying, state.listeners.size, true);

        state.player.stop(); // Will trigger Idle -> playNextTrack
        await interaction.reply('⏭️ Skipped!');
        return true;
    }

    // ── /radio queue ──
    private async cmdQueue(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        await interaction.deferReply();

        const state = this.radioStates.get(guildId);
        if (!state?.connection) {
            await interaction.editReply('⚠️ Radio is not running.');
            return true;
        }

        const query = interaction.options.getString('track', true);
        const tracks = await this.db.track.findMany({
            where: {
                isPublic: true,
                status: 'active',
                title: { contains: query, mode: 'insensitive' },
            },
            include: { profile: true },
            take: 1,
        });

        if (tracks.length === 0) {
            await interaction.editReply(`❌ No track found matching "${query}".`);
            return true;
        }

        const track = tracks[0];
        const entry: NowPlaying = {
            trackId: track.id,
            title: track.title,
            artist: track.profile.displayName || track.profile.username,
            coverUrl: track.coverUrl,
            url: track.url,
            duration: track.duration,
            startedAt: 0,
            profileId: track.profileId,
            artistUserId: track.profile.userId,
        };

        state.queue.push(entry);

        // Store in DB queue
        await this.db.radioQueue.create({
            data: {
                guildId,
                trackId: track.id,
                addedBy: interaction.user.id,
                position: state.queue.length,
            },
        });

        await interaction.editReply(`✅ Queued: **${track.title}** by ${entry.artist} (Position #${state.queue.length})`);
        return true;
    }

    // ── /radio np ──
    private async cmdNowPlaying(interaction: ChatInputCommandInteraction, guildId: string): Promise<boolean> {
        const state = this.radioStates.get(guildId);
        if (!state?.nowPlaying) {
            await interaction.reply({ content: '📻 Nothing is playing right now.', flags: MessageFlags.Ephemeral });
            return true;
        }

        const embed = this.buildNowPlayingEmbed(state);
        await interaction.reply({ embeds: [embed] });
        return true;
    }

    // ─── /tip ────────────────────────────────────────────────────────────

    private async handleTipCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
        await interaction.deferReply();
        const guildId = interaction.guildId!;
        const state = this.radioStates.get(guildId);

        if (!state?.nowPlaying || !state.nowPlaying.artistUserId) {
            await interaction.editReply('⚠️ No track is currently playing or the artist has no profile.');
            return true;
        }

        const settings = await this.getSettings(guildId);
        if (!settings.tipEnabled) {
            await interaction.editReply('⚠️ Tipping is not enabled on this radio.');
            return true;
        }

        const amount = interaction.options.getInteger('amount', true);
        if (amount < settings.minTipAmount) {
            await interaction.editReply(`⚠️ Minimum tip is ${settings.minTipAmount} coins.`);
            return true;
        }

        // Check sender balance
        const senderAccount = await this.db.economyAccount.findUnique({
            where: { guildId_userId: { guildId, userId: interaction.user.id } },
        });

        if (!senderAccount || senderAccount.balance < amount) {
            await interaction.editReply('⚠️ You don\'t have enough coins.');
            return true;
        }

        // Transfer
        await this.db.$transaction([
            this.db.economyAccount.update({
                where: { guildId_userId: { guildId, userId: interaction.user.id } },
                data: { balance: { decrement: amount } },
            }),
            this.db.economyAccount.upsert({
                where: { guildId_userId: { guildId, userId: state.nowPlaying.artistUserId } },
                update: { balance: { increment: amount }, totalEarned: { increment: amount } },
                create: { guildId, userId: state.nowPlaying.artistUserId, balance: amount, totalEarned: amount },
            }),
            this.db.economyTransaction.create({
                data: {
                    guildId,
                    userId: interaction.user.id,
                    amount: -amount,
                    type: 'radio_tip',
                    reason: `Tipped ${state.nowPlaying.artist} on Fuji FM`,
                },
            }),
            this.db.economyTransaction.create({
                data: {
                    guildId,
                    userId: state.nowPlaying.artistUserId,
                    amount,
                    type: 'radio_tip',
                    reason: `Received tip from ${interaction.user.displayName} on Fuji FM`,
                },
            }),
        ]);

        const embed = new EmbedBuilder()
            .setTitle('💰 Tip Sent!')
            .setDescription(`You tipped **${amount}** coins to **${state.nowPlaying.artist}** for "${state.nowPlaying.title}"`)
            .setColor(0xFFD700);

        await interaction.editReply({ embeds: [embed] });
        return true;
    }

    // ─── /like ───────────────────────────────────────────────────────────

    private async handleLikeCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guildId = interaction.guildId!;
        const state = this.radioStates.get(guildId);

        if (!state?.nowPlaying) {
            await interaction.editReply('⚠️ Nothing is playing right now.');
            return true;
        }

        // Add to favourites (upsert)
        const existing = await this.db.trackFavourite.findUnique({
            where: { userId_trackId: { userId: interaction.user.id, trackId: state.nowPlaying.trackId } },
        });

        if (existing) {
            await interaction.editReply('❤️ You already liked this track!');
            return true;
        }

        await this.db.trackFavourite.create({
            data: {
                userId: interaction.user.id,
                trackId: state.nowPlaying.trackId,
            },
        });

        await interaction.editReply(`❤️ Added **${state.nowPlaying.title}** to your favourites!`);
        return true;
    }

    // ─── /nowplaying ─────────────────────────────────────────────────────

    private async handleNowPlayingCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
        return await this.cmdNowPlaying(interaction, interaction.guildId!);
    }

    // ─── Voice State Update (Audio Ducking + Listener Tracking) ──────────

    async onVoiceStateUpdate(oldState: any, newState: any): Promise<void> {
        const guildId = newState.guild?.id || oldState.guild?.id;
        if (!guildId) return;

        const state = this.radioStates.get(guildId);
        if (!state?.connection) return;

        const settings = await this.getSettings(guildId);
        const radioChannelId = settings.voiceChannelId;
        if (!radioChannelId) return;

        const userId = newState.member?.id || oldState.member?.id;
        const botId = this.client.user?.id;
        if (!userId || userId === botId) return;

        // ── Track listeners joining/leaving the radio channel
        const joinedRadio = newState.channelId === radioChannelId;
        const leftRadio = oldState.channelId === radioChannelId && newState.channelId !== radioChannelId;

        if (joinedRadio) {
            state.listeners.add(userId);
        } else if (leftRadio) {
            state.listeners.delete(userId);
            this.listenerXpTicks.delete(`${guildId}:${userId}`);
        }

        // ── Audio ducking for host mode
        if (state.mode === 'host' && state.hostUserId && userId === state.hostUserId) {
            // Speaking status changes trigger ducking
            const wasSpeaking = oldState.streaming || oldState.selfVideo;
            const isSpeaking = newState.streaming || newState.selfVideo;

            // We use the speaking event on the receiver for more accurate ducking
            // For now, detect via selfMute changes
            if (newState.channelId === radioChannelId) {
                // Duck when host unmutes, unduck when mutes
                if (!newState.selfMute && oldState.selfMute && !state.ducked) {
                    state.ducked = true;
                    // Restart stream with duck volume baked into FFmpeg filter
                    if (state.nowPlaying && state.player) {
                        state.queue.unshift(state.nowPlaying);
                        state.nowPlaying = null;
                        state.killStream?.();
                        state.player.stop(false);
                    }
                } else if (newState.selfMute && !oldState.selfMute && state.ducked) {
                    state.ducked = false;
                    // Restart stream with full volume baked into FFmpeg filter
                    if (state.nowPlaying && state.player) {
                        state.queue.unshift(state.nowPlaying);
                        state.nowPlaying = null;
                        state.killStream?.();
                        state.player.stop(false);
                    }
                }
            }
        }
    }

    // ─── Audio Playback Engine ───────────────────────────────────────────

    private async playNextTrack(guildId: string): Promise<void> {
        const state = this.radioStates.get(guildId);
        if (!state?.player || !state.connection) return;

        const settings = await this.getSettings(guildId);

        // Record previous song in history
        if (state.nowPlaying) {
            await this.recordHistory(guildId, state.nowPlaying, state.listeners.size, false);
        }

        // Check if we need to inject an ad
        if (settings.adsEnabled && state.songsSinceAd >= settings.adFrequency) {
            const played = await this.playAd(guildId, state, settings);
            if (played) {
                state.songsSinceAd = 0;
                return; // Ad handler will trigger next track when done
            }
        }

        // Get next track from queue
        let next = state.queue.shift();

        // If queue is empty and in auto mode, repopulate
        if (!next && state.mode === 'auto') {
            await this.populateAutoQueue(guildId, settings);
            next = state.queue.shift();
        }

        if (!next) {
            this.logger.info(`[FujiRadio] No tracks available for ${guildId}, waiting...`);
            return;
        }

        try {
            // Stream audio via high-quality FFmpeg pipeline (explicit 48kHz stereo PCM + loudnorm)
            state.killStream?.();
            const { stream: audioStream, kill: killStream } = this.createHighQualityStream(
                next.url,
                state.ducked ? settings.duckVolume : state.volume,
            );
            state.killStream = killStream;
            const resource = createAudioResource(audioStream, {
                inputType: StreamType.Raw,
            });

            next.startedAt = Date.now();
            state.nowPlaying = next;
            state.songsSinceAd++;

            state.player.play(resource);

            // Update the persistent now-playing embed
            await this.updateNowPlayingEmbed(guildId, state, settings);

            // Record in DB queue
            await this.db.radioQueue.updateMany({
                where: { guildId, trackId: next.trackId, playedAt: null },
                data: { playedAt: new Date() },
            });

            this.logger.info(`[FujiRadio] Now playing: "${next.title}" by ${next.artist} in ${guildId}`);
        } catch (error) {
            this.logger.error(`[FujiRadio] Playback error: ${error}`);
            // Try next track
            setTimeout(() => this.playNextTrack(guildId), 2000);
        }
    }

    // ─── Ad Injection ────────────────────────────────────────────────────

    private async playAd(guildId: string, state: RadioState, settings: any): Promise<boolean> {
        // Find an active, approved ad with remaining plays
        const ad = await this.db.radioAdSlot.findFirst({
            where: { guildId, active: true, approved: true, playsLeft: { gt: 0 } },
            orderBy: { createdAt: 'asc' },
        });

        if (!ad) return false;

        if (ad?.adType === 'audio' && ad.audioUrl) {
            // Play uploaded audio ad
            try {
                const { stream: adStream, kill: killAdStream } = this.createHighQualityStream(ad.audioUrl, state.volume);
                state.killStream = killAdStream;
                const resource = createAudioResource(adStream, {
                    inputType: StreamType.Raw,
                });
                state.player!.play(resource);

                // Decrement plays
                await this.db.radioAdSlot.update({
                    where: { id: ad.id },
                    data: { playsLeft: { decrement: 1 } },
                });

                return true;
            } catch {
                return false;
            }
        }

        // For TTS ads, we'll use a simple embed notification in chat
        // (Full TTS engine integration deferred for future update)
        const settings2 = await this.getSettings(guildId);
        if (settings2.textChannelId) {
            try {
                const textChannel = await this.client.channels.fetch(settings2.textChannelId);
                if (textChannel && textChannel.isTextBased()) {
                    const adText = ad?.adText || settings.adTtsDefault;
                    const embed = new EmbedBuilder()
                        .setTitle('📢 Sponsored Message')
                        .setDescription(adText)
                        .setColor(0xFFD700)
                        .setFooter({ text: 'Fuji FM • Community Radio' });

                    await (textChannel as TextChannel).send({ embeds: [embed] });
                }
            } catch { /* ignore */ }
        }

        if (ad) {
            await this.db.radioAdSlot.update({
                where: { id: ad.id },
                data: { playsLeft: { decrement: 1 } },
            });
        }

        return false; // Didn't play audio, just showed embed
    }

    // ─── Auto Queue Population ───────────────────────────────────────────

    private async populateAutoQueue(guildId: string, settings: any): Promise<void> {
        const state = this.radioStates.get(guildId);
        if (!state) return;

        let tracks: any[] = [];
        const take = 20;

        switch (settings.autoSource) {
            case 'trending':
                tracks = await this.db.track.findMany({
                    where: { isPublic: true, status: 'active' },
                    orderBy: { playCount: 'desc' },
                    include: { profile: true },
                    take,
                });
                break;
            case 'newest':
                tracks = await this.db.track.findMany({
                    where: { isPublic: true, status: 'active' },
                    orderBy: { createdAt: 'desc' },
                    include: { profile: true },
                    take,
                });
                break;
            case 'genre':
                if (settings.autoGenreFilter) {
                    tracks = await this.db.track.findMany({
                        where: {
                            isPublic: true,
                            status: 'active',
                            genres: { some: { genre: { slug: settings.autoGenreFilter } } },
                        },
                        orderBy: { playCount: 'desc' },
                        include: { profile: true },
                        take,
                    });
                }
                break;
            case 'random':
            default:
                // Get random tracks by fetching more and shuffling
                tracks = await this.db.track.findMany({
                    where: { isPublic: true, status: 'active' },
                    include: { profile: true },
                    take: take * 2,
                });
                // Fisher-Yates shuffle
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }
                tracks = tracks.slice(0, take);
                break;
        }

        // Convert to NowPlaying entries
        for (const track of tracks) {
            state.queue.push({
                trackId: track.id,
                title: track.title,
                artist: track.profile?.displayName || track.profile?.username || 'Unknown',
                coverUrl: track.coverUrl,
                url: track.url,
                duration: track.duration,
                startedAt: 0,
                profileId: track.profileId,
                artistUserId: track.profile?.userId,
            });
        }

        this.logger.info(`[FujiRadio] Auto-populated ${tracks.length} tracks for ${guildId} (source: ${settings.autoSource})`);
    }

    // ─── Now Playing Embed ───────────────────────────────────────────────

    private buildNowPlayingEmbed(state: RadioState): EmbedBuilder {
        const np = state.nowPlaying!;
        const elapsed = Math.floor((Date.now() - np.startedAt) / 1000);
        const progress = np.duration > 0 ? Math.min(elapsed / np.duration, 1) : 0;
        const barLen = 20;
        const filled = Math.round(progress * barLen);
        const bar = '▓'.repeat(filled) + '░'.repeat(barLen - filled);

        const embed = new EmbedBuilder()
            .setTitle('📻 Now Playing on Fuji FM')
            .setDescription(`**${np.title}**\nby ${np.artist}`)
            .addFields(
                { name: 'Progress', value: `\`${bar}\` ${this.formatDuration(elapsed)}/${this.formatDuration(np.duration)}`, inline: false },
                { name: 'Listeners', value: `${state.listeners.size}`, inline: true },
                { name: 'Mode', value: state.mode === 'host' ? '🎙️ Live Host' : '🤖 Auto-Pilot', inline: true },
                { name: 'Queue', value: `${state.queue.length} tracks`, inline: true },
            )
            .setColor(0x2B8C71)
            .setFooter({ text: 'Use /tip to tip the artist • /like to save this track' });

        if (np.coverUrl) {
            embed.setThumbnail(np.coverUrl);
        }

        return embed;
    }

    private async updateNowPlayingEmbed(guildId: string, state: RadioState, settings: any): Promise<void> {
        if (!settings.textChannelId || !state.nowPlaying) return;

        try {
            const textChannel = await this.client.channels.fetch(settings.textChannelId);
            if (!textChannel || !textChannel.isTextBased()) return;

            const embed = this.buildNowPlayingEmbed(state);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('radio_like').setLabel('❤️ Like').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('radio_skip_vote').setLabel('⏭️ Skip').setStyle(ButtonStyle.Secondary),
            );

            // Try to edit existing persistent message
            if (settings.nowPlayingMessageId) {
                try {
                    const msg = await (textChannel as TextChannel).messages.fetch(settings.nowPlayingMessageId);
                    await msg.edit({ embeds: [embed], components: [row] });
                    return;
                } catch {
                    // Message deleted, create new one
                }
            }

            // Create new persistent message
            const msg = await (textChannel as TextChannel).send({ embeds: [embed], components: [row] });

            // Save message ID for future edits
            await this.db.radioSettings.update({
                where: { guildId },
                data: { nowPlayingMessageId: msg.id },
            });
        } catch (error) {
            this.logger.error(`[FujiRadio] Failed to update now-playing embed: ${error}`);
        }
    }

    // ─── History Recording ───────────────────────────────────────────────

    private async recordHistory(guildId: string, np: NowPlaying, listenerCount: number, skipped: boolean): Promise<void> {
        try {
            await this.db.radioHistory.create({
                data: {
                    guildId,
                    trackId: np.trackId,
                    trackTitle: np.title,
                    artistName: np.artist,
                    coverUrl: np.coverUrl,
                    duration: np.duration,
                    listenCount: listenerCount,
                    hostedBy: this.radioStates.get(guildId)?.hostUserId || null,
                },
            });

            // Also record a TrackPlay for stats
            await this.db.trackPlay.create({
                data: {
                    trackId: np.trackId,
                    userId: 'fuji-radio',
                    ipAddress: 'internal-radio',
                    durationPlayed: skipped ? Math.floor((Date.now() - np.startedAt) / 1000) : np.duration,
                },
            });

            // Increment play count
            await this.db.track.update({
                where: { id: np.trackId },
                data: { playCount: { increment: 1 } },
            });
        } catch (error) {
            this.logger.error(`[FujiRadio] History record error: ${error}`);
        }
    }

    // ─── Listener XP ────────────────────────────────────────────────────

    private async tickListenerXp(): Promise<void> {
        for (const [guildId, state] of this.radioStates) {
            if (!state.connection || state.listeners.size === 0) continue;

            const settings = await this.getSettings(guildId);
            if (!settings.listenerXpEnabled) continue;

            for (const userId of state.listeners) {
                try {
                    // Award leveling XP
                    await this.db.member.upsert({
                        where: { guildId_userId: { guildId, userId } },
                        update: {
                            totalXp: { increment: settings.listenerXpPerMinute },
                            xp: { increment: settings.listenerXpPerMinute },
                        },
                        create: {
                            guildId,
                            userId,
                            totalXp: settings.listenerXpPerMinute,
                            xp: settings.listenerXpPerMinute,
                        },
                    });
                } catch { /* ignore individual failures */ }
            }
        }
    }

    // ─── Settings ────────────────────────────────────────────────────────

    async getSettings(guildId: string) {
        let settings = await this.db.radioSettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await this.db.radioSettings.create({
                data: { guildId },
            });
        }
        return settings;
    }

    // ─── Public API Methods (for API routes and WebSocket) ───────────────

    getState(guildId: string): RadioState | undefined {
        return this.radioStates.get(guildId);
    }

    async skipTrack(guildId: string): Promise<boolean> {
        const state = this.radioStates.get(guildId);
        if (!state?.player) return false;
        state.player.stop();
        return true;
    }

    async addToQueue(guildId: string, trackId: string, addedBy?: string): Promise<NowPlaying | null> {
        const state = this.radioStates.get(guildId);
        if (!state) return null;

        const track = await this.db.track.findUnique({
            where: { id: trackId },
            include: { profile: true },
        });
        if (!track) return null;

        const entry: NowPlaying = {
            trackId: track.id,
            title: track.title,
            artist: track.profile?.displayName || track.profile?.username || 'Unknown',
            coverUrl: track.coverUrl,
            url: track.url,
            duration: track.duration,
            startedAt: 0,
            profileId: track.profileId,
            artistUserId: track.profile?.userId,
        };

        state.queue.push(entry);

        await this.db.radioQueue.create({
            data: {
                guildId,
                trackId: track.id,
                addedBy,
                position: state.queue.length,
            },
        });

        return entry;
    }

    async startAuto(guildId: string): Promise<boolean> {
        const settings = await this.getSettings(guildId);
        if (!settings.voiceChannelId) return false;

        const channel = await this.client.channels.fetch(settings.voiceChannelId).catch(() => null);
        if (!channel || channel.type !== ChannelType.GuildVoice) return false;

        const existing = this.radioStates.get(guildId);
        if (existing?.connection) return true; // already running

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId,
            adapterCreator: (channel as VoiceChannel).guild.voiceAdapterCreator as any,
            selfDeaf: false,
            selfMute: false,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

        const player = createAudioPlayer();
        connection.subscribe(player);

        const state: RadioState = {
            mode: 'auto',
            hostUserId: null,
            connection,
            player,
            nowPlaying: null,
            queue: [],
            volume: settings.defaultVolume,
            ducked: false,
            songsSinceAd: 0,
            paused: false,
            listeners: new Set(),
        };

        this.radioStates.set(guildId, state);

        connection.on(VoiceConnectionStatus.Disconnected as any, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                try { connection.destroy(); } catch { /* ignore */ }
                this.radioStates.delete(guildId);
                this.logger.info(`[FujiRadio] Disconnected from ${guildId}, attempting rejoin in 5s...`);
                setTimeout(() => {
                    this.startAuto(guildId).catch(err =>
                        this.logger.error(`[FujiRadio] Rejoin failed for ${guildId}: ${err}`)
                    );
                }, 5_000);
            }
        });

        player.on(AudioPlayerStatus.Idle, () => {
            this.playNextTrack(guildId).catch(err =>
                this.logger.error(`[FujiRadio] Auto-play error: ${err}`)
            );
        });

        await this.populateAutoQueue(guildId, settings);
        await this.playNextTrack(guildId);

        return true;
    }

    stopRadio(guildId: string): void {
        this.cleanupGuild(guildId);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private createHighQualityStream(url: string, volume: number): { stream: PassThrough; kill: () => void } {
        const passthrough = new PassThrough();
        let killed = false;
        const cmd = ffmpeg(url)
            .inputOptions(['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5'])
            .audioFrequency(48000)
            .audioChannels(2)
            .audioCodec('pcm_s16le')
            .format('s16le')
            .audioFilters([
                `volume=${Math.max(0.01, volume)}`,
                'loudnorm=I=-16:LRA=11:TP=-1.5',
            ])
            .on('error', (err: Error) => {
                if (!killed && !err.message.includes('SIGKILL') && !err.message.includes('killed')) {
                    this.logger.error(`[FujiRadio] FFmpeg stream error: ${err.message}`);
                }
                if (!passthrough.destroyed) passthrough.destroy();
            });
        cmd.pipe(passthrough, { end: true });
        return {
            stream: passthrough,
            kill: () => {
                killed = true;
                try { cmd.kill('SIGKILL'); } catch { /* ignored */ }
                if (!passthrough.destroyed) passthrough.destroy();
            },
        };
    }

    private cleanupGuild(guildId: string): void {
        const state = this.radioStates.get(guildId);
        if (state) {
            state.killStream?.();
            state.player?.stop(true);
            state.connection?.destroy();
        }
        this.radioStates.delete(guildId);
    }

    private formatDuration(secs: number): string {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
