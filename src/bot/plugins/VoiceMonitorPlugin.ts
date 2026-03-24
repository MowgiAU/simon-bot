import {
    VoiceState,
    PermissionResolvable,
    GuildMember,
    ChannelType,
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    TextChannel,
} from 'discord.js';
import {
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus,
    VoiceConnection,
    EndBehaviorType,
    getVoiceConnection,
    generateDependencyReport,
} from '@discordjs/voice';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';
import { R2Storage } from '../../services/R2Storage.js';
import { Transform } from 'stream';
import { spawn, ChildProcess } from 'child_process';
import { pipeline } from 'stream/promises';
import path from 'path';
import fs from 'fs';
import os from 'os';

interface UserRecording {
    ffmpeg: ChildProcess;
    filePath: string;
    userId: string;
    userName: string;
    startedAt: Date;
    bytesWritten: number;
}

interface ActiveSession {
    sessionId: string;
    guildId: string;
    channelId: string;
    channelName: string;
    connection: VoiceConnection;
    recordings: Map<string, UserRecording>;
    startedAt: Date;
}

export class VoiceMonitorPlugin implements IPlugin {
    id = 'voice-monitor';
    name = 'Voice Monitor';
    description = 'Records voice channel audio per-user for moderation review';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = ['Connect', 'Speak', 'ManageChannels'];
    commands = ['voicemonitor', 'voicereport'];
    events = ['voiceStateUpdate', 'interactionCreate'];
    dashboardSections = ['voice-monitor'];
    defaultEnabled = true;

    configSchema = z.object({
        enabled: z.boolean().default(false),
        retentionDays: z.number().default(30),
    });

    private context: IPluginContext | null = null;
    private logger: Logger;
    private activeSessions: Map<string, ActiveSession> = new Map(); // channelId -> session
    private purgeInterval: ReturnType<typeof setInterval> | null = null;
    private tmpDir: string;

    constructor() {
        this.logger = new Logger('VoiceMonitorPlugin');
        this.tmpDir = path.join(os.tmpdir(), 'fuji-voice-monitor');
    }

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;

        // Ensure tmp dir exists
        if (!fs.existsSync(this.tmpDir)) {
            fs.mkdirSync(this.tmpDir, { recursive: true });
        }

        // Clean up any orphaned temp files from previous crashes
        this.cleanupTempFiles();

        // Start retention purge cron (every hour)
        this.purgeInterval = setInterval(() => this.purgeExpiredSegments(), 60 * 60 * 1000);

        // Close any orphaned sessions from DB (bot crashed while recording)
        await this.closeOrphanedSessions();

        // Log dependency report for voice diagnostics
        this.logger.info(`[VoiceMonitor] Dependency Report:\n${generateDependencyReport()}`);

        this.logger.info('Voice Monitor plugin initialized');
    }

    async shutdown(): Promise<void> {
        if (this.purgeInterval) {
            clearInterval(this.purgeInterval);
            this.purgeInterval = null;
        }

        // Stop all active recordings
        for (const [channelId, session] of this.activeSessions) {
            await this.stopSession(channelId);
        }

        this.logger.info('Voice Monitor plugin shut down');
    }

    // ─── Event Handlers ─────────────────────────────────────────────────

    async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
        this.logger.info(`[VoiceMonitor] onVoiceStateUpdate called: user=${newState.member?.user?.tag} oldChannel=${oldState.channelId} newChannel=${newState.channelId}`);
        if (!this.context) {
            this.logger.warn('[VoiceMonitor] No context, skipping');
            return;
        }
        const guildId = newState.guild.id;

        // Check if voice monitor is enabled for this guild
        const settings = await this.getSettings(guildId);
        this.logger.info(`[VoiceMonitor] Settings for guild ${guildId}: ${JSON.stringify(settings ? { enabled: settings.enabled, monitoredChannelIds: settings.monitoredChannelIds } : null)}`);
        if (!settings?.enabled) {
            this.logger.info(`[VoiceMonitor] Voice monitor not enabled for guild ${guildId}, skipping`);
            return;
        }

        const member = newState.member;
        if (!member || member.user.bot) return;

        // Check if user has excluded role
        if (settings.excludedRoleIds.length > 0) {
            const hasExcludedRole = member.roles.cache.some(r => settings.excludedRoleIds.includes(r.id));
            if (hasExcludedRole) return;
        }

        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;

        // User joined a voice channel
        if (!oldChannelId && newChannelId) {
            await this.handleUserJoin(newState, settings);
        }
        // User left a voice channel
        else if (oldChannelId && !newChannelId) {
            await this.handleUserLeave(oldState, member);
        }
        // User moved channels
        else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
            await this.handleUserLeave(oldState, member);
            await this.handleUserJoin(newState, settings);
        }
    }

    async onInteractionCreate(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.context || !interaction.isChatInputCommand()) return;
        if (!interaction.guildId) return;

        switch (interaction.commandName) {
            case 'voicemonitor':
                await this.handleVoiceMonitorCommand(interaction);
                break;
            case 'voicereport':
                await this.handleVoiceReportCommand(interaction);
                break;
        }
    }

    // ─── Voice Join / Leave Logic ────────────────────────────────────────

    private async handleUserJoin(state: VoiceState, settings: any): Promise<void> {
        if (!this.context || !state.channel || !state.member) return;
        const channelId = state.channelId!;
        const guildId = state.guild.id;

        // Check if this channel should be monitored
        const monitoredChannels = settings?.monitoredChannelIds || [];
        if (monitoredChannels.length > 0 && !monitoredChannels.includes(channelId)) {
            this.logger.info(`Voice channel #${state.channel.name} (${channelId}) not in monitored list, skipping session creation`);
            return;
        }
        this.logger.info(`Voice channel #${state.channel.name} (${channelId}) is monitored, creating session. Monitored channels: ${monitoredChannels.length === 0 ? 'ALL' : monitoredChannels.join(', ')}`);


        // Only monitor voice channels (not stage)
        if (state.channel.type !== ChannelType.GuildVoice) return;

        let session = this.activeSessions.get(channelId);

        // If no active session, create one and join the channel
        if (!session) {
            // Set up raw event diagnostics (declared outside try so catch can clean up)
            const client = this.context.client as any;
            const rawHandler = (packet: any) => {
                if (packet.t === 'VOICE_SERVER_UPDATE' && packet.d?.guild_id === guildId) {
                    this.logger.info(`[VoiceMonitor] VOICE_SERVER_UPDATE received: endpoint=${packet.d?.endpoint}, token_present=${!!packet.d?.token}`);
                }
                if (packet.t === 'VOICE_STATE_UPDATE' && packet.d?.guild_id === guildId && packet.d?.user_id === client.user?.id) {
                    this.logger.info(`[VoiceMonitor] VOICE_STATE_UPDATE (bot): session_id=${packet.d?.session_id}, channel_id=${packet.d?.channel_id}`);
                }
            };
            client.on('raw', rawHandler);

            try {
                this.logger.info(`[VoiceMonitor] Attempting to join voice channel ${channelId} in guild ${guildId}...`);

                const connection = await this.createVoiceConnection(channelId, guildId, state);

                // Clean up raw handler after connection established
                client.removeListener('raw', rawHandler);

                this.logger.info(`[VoiceMonitor] Successfully connected to voice channel ${channelId}`);

                // Create DB session
                const dbSession = await this.context.db.voiceSession.create({
                    data: {
                        guildId,
                        channelId,
                        channelName: state.channel.name,
                    },
                });

                session = {
                    sessionId: dbSession.id,
                    guildId,
                    channelId,
                    channelName: state.channel.name,
                    connection,
                    recordings: new Map(),
                    startedAt: new Date(),
                };
                this.activeSessions.set(channelId, session);

                this.logger.info(`Started voice session in #${state.channel.name} (${guildId})`);
            } catch (err) {
                client.removeListener('raw', rawHandler);
                this.logger.error(`Failed to join voice channel ${channelId}`, err);
                return;
            }
        }

        // Start recording this user
        await this.startUserRecording(session, state.member);
    }

    private async handleUserLeave(state: VoiceState, member: GuildMember): Promise<void> {
        const channelId = state.channelId;
        if (!channelId) return;

        const session = this.activeSessions.get(channelId);
        if (!session) return;

        // Stop recording this user
        await this.stopUserRecording(session, member.id);

        // If no more non-bot users in channel, end the session
        const channel = state.channel;
        if (channel) {
            const nonBotMembers = channel.members.filter(m => !m.user.bot);
            if (nonBotMembers.size === 0) {
                await this.stopSession(channelId);
            }
        }
    }

    // ─── Per-User Recording ──────────────────────────────────────────────

    /**
     * Create a voice connection with retry logic and proper state management.
     */
    private async createVoiceConnection(channelId: string, guildId: string, state: VoiceState): Promise<VoiceConnection> {
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            this.logger.info(`[VoiceMonitor] Connection attempt ${attempt}/${maxAttempts} for channel ${channelId}`);

            // Destroy any existing connection for this guild to avoid conflicts
            const existing = getVoiceConnection(guildId);
            if (existing) {
                this.logger.info(`[VoiceMonitor] Destroying existing connection for guild ${guildId}`);
                existing.destroy();
                await new Promise(r => setTimeout(r, 1000));
            }

            const connection = joinVoiceChannel({
                channelId,
                guildId,
                adapterCreator: state.guild.voiceAdapterCreator as any,
                selfDeaf: false,
                selfMute: true,
            });

            // Hook into networking to capture voice WS events
            // VoiceWebSocket is an EventEmitter with 'open', 'close', 'packet', 'error', 'debug' events
            const hookVoiceWs = (ws: any) => {
                if (!ws || ws._vmHooked) return;
                ws._vmHooked = true;

                ws.on('open', () => {
                    this.logger.info(`[VoiceMonitor] Voice WS OPEN`);
                });
                ws.on('packet', (packet: any) => {
                    this.logger.info(`[VoiceMonitor] Voice WS recv: op=${packet?.op} d=${JSON.stringify(packet?.d)?.substring(0, 500)}`);
                });
                ws.on('close', (closeEvent: any) => {
                    this.logger.warn(`[VoiceMonitor] Voice WS CLOSE: code=${closeEvent?.code}, reason=${closeEvent?.reason}, wasClean=${closeEvent?.wasClean}`);
                });
                ws.on('error', (error: any) => {
                    this.logger.error(`[VoiceMonitor] Voice WS ERROR: ${error?.message || error}`);
                });
                ws.on('debug', (msg: any) => {
                    this.logger.info(`[VoiceMonitor] Voice WS DEBUG: ${msg}`);
                });
            };

            const hookNetworking = (networking: any) => {
                if (networking._voiceMonitorHooked) return;
                networking._voiceMonitorHooked = true;

                // Hook WS in current state
                if (networking.state?.ws) hookVoiceWs(networking.state.ws);

                networking.on('stateChange', (oldNS: any, newNS: any) => {
                    this.logger.info(`[VoiceMonitor] Networking state: ${oldNS.code} -> ${newNS.code}`);
                    // Hook WS whenever a new one appears
                    if (newNS.ws) hookVoiceWs(newNS.ws);
                });
            };

            connection.on('stateChange', (oldS: any, newS: any) => {
                this.logger.info(`[VoiceMonitor] Connection state: ${oldS.status} -> ${newS.status}`);
                if (newS.networking) hookNetworking(newS.networking);
            });

            connection.on('error', (error) => {
                this.logger.error(`[VoiceMonitor] Connection error`, error);
            });

            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

                // Set up disconnect handler
                connection.on(VoiceConnectionStatus.Disconnected as any, async () => {
                    this.logger.warn(`[VoiceMonitor] Connection disconnected in channel ${channelId}`);
                    try {
                        await Promise.race([
                            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                    } catch {
                        connection.destroy();
                        this.activeSessions.delete(channelId);
                    }
                });

                return connection;
            } catch (err) {
                this.logger.warn(`[VoiceMonitor] Attempt ${attempt} failed, status: ${connection.state.status}`);
                if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                    connection.destroy();
                }
                if (attempt < maxAttempts) {
                    const delay = attempt * 2000;
                    this.logger.info(`[VoiceMonitor] Waiting ${delay}ms before retry...`);
                    await new Promise(r => setTimeout(r, delay));
                } else {
                    throw new Error(`Voice connection failed after ${maxAttempts} attempts`);
                }
            }
        }

        throw new Error('Unreachable');
    }

    private async startUserRecording(session: ActiveSession, member: GuildMember): Promise<void> {
        if (!this.context || session.recordings.has(member.id)) return;

        const receiver = session.connection.receiver;
        const userId = member.id;
        const userName = member.displayName;

        const opusStream = receiver.subscribe(userId, {
            end: { behavior: EndBehaviorType.Manual },
        });

        // Temp file for FFmpeg output
        const tmpFile = path.join(this.tmpDir, `${session.sessionId}_${userId}_${Date.now()}.ogg`);

        // Spawn FFmpeg: Discord Opus → OGG Vorbis (32kbps mono 48kHz)
        const ffmpeg = spawn('ffmpeg', [
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-i', 'pipe:0',
            '-c:a', 'libvorbis',
            '-b:a', '32k',
            '-ac', '1',
            '-ar', '48000',
            '-y',
            tmpFile,
        ], { stdio: ['pipe', 'ignore', 'ignore'] });

        const recording: UserRecording = {
            ffmpeg,
            filePath: tmpFile,
            userId,
            userName,
            startedAt: new Date(),
            bytesWritten: 0,
        };

        session.recordings.set(userId, recording);

        // Decode Opus to PCM and pipe to FFmpeg
        const prism = await import('prism-media');
        const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });

        opusStream.pipe(decoder).pipe(ffmpeg.stdin!).on('error', (err: Error) => {
            // Ignore EPIPE — happens when FFmpeg closes normally
            if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
                this.logger.error(`FFmpeg stdin error for user ${userId}`, err);
            }
        });

        // Track bytes written
        decoder.on('data', (chunk: Buffer) => {
            recording.bytesWritten += chunk.length;
        });

        ffmpeg.on('close', () => {
            // FFmpeg process finished — file is ready for upload
        });

        this.logger.info(`Started recording user ${userName} (${userId}) in session ${session.sessionId}`);
    }

    private async stopUserRecording(session: ActiveSession, userId: string): Promise<void> {
        const recording = session.recordings.get(userId);
        if (!recording) return;

        session.recordings.delete(userId);

        // Unsubscribe from the user's audio stream
        try {
            session.connection.receiver.subscriptions.get(userId)?.destroy();
        } catch { /* already gone */ }

        // Close FFmpeg stdin to let it finish encoding
        try {
            recording.ffmpeg.stdin?.end();
        } catch { /* already closed */ }

        // Wait for FFmpeg to finish (max 10s)
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                recording.ffmpeg.kill('SIGKILL');
                resolve();
            }, 10_000);

            recording.ffmpeg.on('close', () => {
                clearTimeout(timeout);
                resolve();
            });
        });

        // Upload to R2 if file exists and has content
        if (fs.existsSync(recording.filePath)) {
            const stat = fs.statSync(recording.filePath);
            if (stat.size > 0 && this.context) {
                const durationMs = Date.now() - recording.startedAt.getTime();
                const r2Key = `voice/${session.guildId}/${session.sessionId}/${userId}_${recording.startedAt.getTime()}.ogg`;

                try {
                    if (R2Storage.isConfigured()) {
                        const buffer = fs.readFileSync(recording.filePath);
                        const r2Url = await R2Storage.uploadBuffer(r2Key, buffer, 'audio/ogg');

                        await this.context.db.voiceSegment.create({
                            data: {
                                sessionId: session.sessionId,
                                userId,
                                userName: recording.userName,
                                r2Key,
                                r2Url,
                                durationMs,
                                fileSize: stat.size,
                                startedAt: recording.startedAt,
                                endedAt: new Date(),
                            },
                        });

                        this.logger.info(`Uploaded voice segment for ${recording.userName}: ${r2Key} (${(stat.size / 1024).toFixed(1)}KB)`);
                    } else {
                        this.logger.warn('R2 not configured — voice segment not uploaded');
                    }
                } catch (err) {
                    this.logger.error(`Failed to upload voice segment for ${userId}`, err);
                }
            }

            // Clean up temp file
            try { fs.unlinkSync(recording.filePath); } catch { /* ok */ }
        }
    }

    // ─── Session Management ──────────────────────────────────────────────

    private async stopSession(channelId: string): Promise<void> {
        const session = this.activeSessions.get(channelId);
        if (!session) return;

        this.activeSessions.delete(channelId);

        // Stop all user recordings
        const userIds = [...session.recordings.keys()];
        for (const userId of userIds) {
            await this.stopUserRecording(session, userId);
        }

        // Disconnect from voice
        try {
            session.connection.destroy();
        } catch { /* already disconnected */ }

        // Update DB session
        if (this.context) {
            try {
                await this.context.db.voiceSession.update({
                    where: { id: session.sessionId },
                    data: { endedAt: new Date() },
                });
            } catch (err) {
                this.logger.error(`Failed to close session ${session.sessionId}`, err);
            }
        }

        this.logger.info(`Ended voice session in #${session.channelName} (${session.guildId})`);
    }

    // ─── Slash Commands ──────────────────────────────────────────────────

    private async handleVoiceMonitorCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.context || !interaction.guildId) return;

        const member = interaction.member as GuildMember;
        if (!member.permissions.has('ManageGuild')) {
            await interaction.reply({ content: 'You need **Manage Server** permission to use this command.', ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'enable') {
            const settings = await this.upsertSettings(interaction.guildId, { enabled: true });

            // Send one-time notice if not yet sent
            if (!settings.noticeSent) {
                await this.sendRecordingNotice(interaction.guildId, settings);
            }

            await interaction.reply({ content: 'Voice monitoring **enabled**.', ephemeral: true });
        } else if (sub === 'disable') {
            await this.upsertSettings(interaction.guildId, { enabled: false });

            // Stop all active sessions in this guild
            for (const [channelId, session] of this.activeSessions) {
                if (session.guildId === interaction.guildId) {
                    await this.stopSession(channelId);
                }
            }

            await interaction.reply({ content: 'Voice monitoring **disabled**. All active recordings stopped.', ephemeral: true });
        } else if (sub === 'status') {
            const settings = await this.getSettings(interaction.guildId);
            const activeSessions = [...this.activeSessions.values()].filter(s => s.guildId === interaction.guildId);
            const totalRecording = activeSessions.reduce((sum, s) => sum + s.recordings.size, 0);

            const embed = new EmbedBuilder()
                .setTitle('Voice Monitor Status')
                .setColor(settings?.enabled ? 0x10B981 : 0xEF4444)
                .addFields(
                    { name: 'Enabled', value: settings?.enabled ? 'Yes' : 'No', inline: true },
                    { name: 'Retention', value: `${settings?.retentionDays ?? 30} days`, inline: true },
                    { name: 'Active Sessions', value: `${activeSessions.length}`, inline: true },
                    { name: 'Users Recording', value: `${totalRecording}`, inline: true },
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (sub === 'notice') {
            const channelOption = interaction.options.getChannel('channel');
            if (channelOption) {
                await this.upsertSettings(interaction.guildId, {
                    noticeChannelId: channelOption.id,
                    noticeSent: false,
                    noticeMessageId: null,
                });
                await this.sendRecordingNotice(interaction.guildId, await this.getSettings(interaction.guildId));
                await interaction.reply({ content: `Recording notice sent to <#${channelOption.id}>.`, ephemeral: true });
            } else {
                await interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
            }
        }
    }

    private async handleVoiceReportCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.context || !interaction.guildId) return;

        const reason = interaction.options.getString('reason', true);
        const targetUser = interaction.options.getUser('user');

        // Find the most recent session involving the reporter or target
        const recentSession = await this.context.db.voiceSession.findFirst({
            where: {
                guildId: interaction.guildId,
                endedAt: { not: null },
            },
            orderBy: { endedAt: 'desc' },
        });

        const report = await this.context.db.voiceReport.create({
            data: {
                guildId: interaction.guildId,
                sessionId: recentSession?.id ?? null,
                reporterId: interaction.user.id,
                reporterName: interaction.user.displayName,
                targetId: targetUser?.id ?? null,
                targetName: targetUser?.displayName ?? null,
                reason,
            },
        });

        await this.context.logAction({
            guildId: interaction.guildId,
            actionType: 'VOICE_REPORT_CREATED',
            executorId: interaction.user.id,
            targetId: targetUser?.id,
            details: { reportId: report.id, reason },
        });

        await interaction.reply({
            content: `Voice report submitted (ID: \`${report.id.slice(0, 8)}\`). Staff will review the recording.`,
            ephemeral: true,
        });
    }

    // ─── One-Time Recording Notice ───────────────────────────────────────

    private async sendRecordingNotice(guildId: string, settings: any): Promise<void> {
        if (!this.context || !settings?.noticeChannelId) return;

        try {
            const guild = this.context.client.guilds.cache.get(guildId);
            if (!guild) return;

            const channel = guild.channels.cache.get(settings.noticeChannelId) as TextChannel;
            if (!channel || channel.type !== ChannelType.GuildText) return;

            const embed = new EmbedBuilder()
                .setTitle('🎙️ Voice Channel Recording Notice')
                .setColor(0x10B981)
                .setDescription(
                    'For the safety and moderation of our community, voice channels in this server may be recorded.\n\n' +
                    '**What is recorded:**\n' +
                    '• Audio from voice channels is recorded per-user for moderation purposes\n' +
                    '• Recordings are automatically deleted after the retention period\n\n' +
                    '**What is NOT recorded:**\n' +
                    '• Screen shares and video are never captured\n' +
                    '• No recordings are shared outside of moderation staff\n\n' +
                    '**Your rights:**\n' +
                    '• You may request deletion of your recordings by contacting a moderator\n' +
                    '• By joining a voice channel, you acknowledge this recording policy\n\n' +
                    '*This notice is posted once when voice monitoring is enabled.*'
                )
                .setFooter({ text: 'Fuji Studio Voice Monitor' })
                .setTimestamp();

            const msg = await channel.send({ embeds: [embed] });

            await this.upsertSettings(guildId, {
                noticeSent: true,
                noticeMessageId: msg.id,
            });

            this.logger.info(`Sent recording notice in guild ${guildId}, channel ${settings.noticeChannelId}`);
        } catch (err) {
            this.logger.error(`Failed to send recording notice for guild ${guildId}`, err);
        }
    }

    // ─── Settings Helpers ────────────────────────────────────────────────

    private async getSettings(guildId: string) {
        if (!this.context) return null;
        const settings = await this.context.db.voiceMonitorSettings.findUnique({ where: { guildId } });
        if (!settings) return null;
        // Normalize arrays to prevent null/undefined issues
        return {
            ...settings,
            monitoredChannelIds: settings.monitoredChannelIds || [],
            excludedRoleIds: settings.excludedRoleIds || []
        };
    }

    private async upsertSettings(guildId: string, data: Record<string, any>) {
        if (!this.context) return null;

        // Ensure guild exists
        await this.context.db.guild.upsert({
            where: { id: guildId },
            update: {},
            create: { id: guildId, name: 'Unknown' },
        });

        return this.context.db.voiceMonitorSettings.upsert({
            where: { guildId },
            update: data,
            create: {
                guildId,
                enabled: false,
                retentionDays: 30,
                ...data,
            },
        });
    }

    // ─── Retention Purge ─────────────────────────────────────────────────

    private async purgeExpiredSegments(): Promise<void> {
        if (!this.context) return;

        try {
            // Get all guilds with voice monitor settings
            const allSettings = await this.context.db.voiceMonitorSettings.findMany();

            for (const settings of allSettings) {
                const cutoff = new Date(Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000);

                const expiredSegments = await this.context.db.voiceSegment.findMany({
                    where: {
                        session: { guildId: settings.guildId },
                        startedAt: { lt: cutoff },
                    },
                });

                if (expiredSegments.length === 0) continue;

                // Delete from R2
                for (const segment of expiredSegments) {
                    try {
                        await R2Storage.deleteObject(segment.r2Key);
                    } catch (err) {
                        this.logger.error(`Failed to delete R2 object ${segment.r2Key}`, err);
                    }
                }

                // Delete from DB
                await this.context.db.voiceSegment.deleteMany({
                    where: {
                        id: { in: expiredSegments.map((s: { id: string }) => s.id) },
                    },
                });

                // Also delete sessions with no segments
                await this.context.db.voiceSession.deleteMany({
                    where: {
                        guildId: settings.guildId,
                        endedAt: { not: null },
                        segments: { none: {} },
                    },
                });

                this.logger.info(`Purged ${expiredSegments.length} expired voice segments for guild ${settings.guildId}`);
            }
        } catch (err) {
            this.logger.error('Error during voice segment purge', err);
        }
    }

    // ─── Cleanup Helpers ─────────────────────────────────────────────────

    private cleanupTempFiles(): void {
        try {
            if (!fs.existsSync(this.tmpDir)) return;
            const files = fs.readdirSync(this.tmpDir);
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(this.tmpDir, file));
                } catch { /* ok */ }
            }
            if (files.length > 0) {
                this.logger.info(`Cleaned up ${files.length} orphaned temp files`);
            }
        } catch (err) {
            this.logger.error('Failed to cleanup temp files', err);
        }
    }

    private async closeOrphanedSessions(): Promise<void> {
        if (!this.context) return;
        try {
            const result = await this.context.db.voiceSession.updateMany({
                where: { endedAt: null },
                data: { endedAt: new Date() },
            });
            if (result.count > 0) {
                this.logger.info(`Closed ${result.count} orphaned voice sessions`);
            }
        } catch (err) {
            this.logger.error('Failed to close orphaned sessions', err);
        }
    }

    // ─── Slash Command Registration ──────────────────────────────────────

}
