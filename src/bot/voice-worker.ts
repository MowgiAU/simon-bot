/**
 * Voice Worker — standalone per-channel recording agent
 *
 * One PM2 process per Discord bot token. Each worker can hold one voice
 * channel at a time. Multiple workers coordinate via the voice_worker_locks
 * database table (composite PK prevents double-claiming).
 *
 * Required env vars (N = digit extracted from WORKER_ID, e.g. "voice-worker-3" → N=3):
 *   WORKER_ID              e.g. "voice-worker-1"
 *   VOICE_BOT_{N}_TOKEN    Discord bot token for this worker
 *   VOICE_BOT_{N}_CLIENT_ID  Discord application/client ID
 *   DATABASE_URL           Same Postgres DB as the main bot
 */

import dotenv from 'dotenv';
dotenv.config();

import {
    Client,
    GatewayIntentBits,
    Events,
    ChannelType,
    GuildMember,
    VoiceState,
} from 'discord.js';
import {
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus,
    VoiceConnection,
    EndBehaviorType,
    getVoiceConnection,
} from '@discordjs/voice';
import { PrismaClient } from '@prisma/client';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { R2Storage } from '../services/R2Storage.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const WORKER_ID = process.env.WORKER_ID;
if (!WORKER_ID) {
    console.error('[VoiceWorker] WORKER_ID env var is required');
    process.exit(1);
}

// "voice-worker-3" → "3"
const WORKER_INDEX = WORKER_ID.split('-').pop()!;
const TOKEN = process.env[`VOICE_BOT_${WORKER_INDEX}_TOKEN`];
const CLIENT_ID = process.env[`VOICE_BOT_${WORKER_INDEX}_CLIENT_ID`];

if (!TOKEN) {
    console.warn(`[${WORKER_ID}] VOICE_BOT_${WORKER_INDEX}_TOKEN not set — worker exiting cleanly`);
    process.exit(0); // exit 0 so PM2 doesn't restart-loop
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Globals ──────────────────────────────────────────────────────────────────

const log      = (msg: string)           => console.log(`[${WORKER_ID}] ${msg}`);
const logError = (msg: string, err?: any) => console.error(`[${WORKER_ID}] ERROR: ${msg}`, err ?? '');

const db     = new PrismaClient();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
    ],
});

const activeSessions = new Map<string, ActiveSession>(); // channelId → session
const tmpDir = path.join(os.tmpdir(), `fuji-voice-${WORKER_INDEX}`);

// ─── Channel Locking ──────────────────────────────────────────────────────────

/** Atomically claim a channel for this worker. Returns true on success. */
async function claimChannel(guildId: string, channelId: string): Promise<boolean> {
    try {
        await db.voiceWorkerLock.create({
            data: { guildId, channelId, workerId: WORKER_ID! },
        });
        return true;
    } catch (err: any) {
        if (err?.code === 'P2002') return false; // unique constraint — another worker claimed it
        throw err;
    }
}

async function releaseChannel(guildId: string, channelId: string): Promise<void> {
    try {
        await db.voiceWorkerLock.deleteMany({
            where: { guildId, channelId, workerId: WORKER_ID },
        });
    } catch { /* ok */ }
}

// ─── Voice Connection ─────────────────────────────────────────────────────────

async function createConnection(channelId: string, guildId: string, state: VoiceState): Promise<VoiceConnection> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const existing = getVoiceConnection(guildId);
        if (existing) {
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

        connection.on('error', (err) => logError('Connection error', err));

        connection.on(VoiceConnectionStatus.Disconnected as any, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                connection.destroy();
                activeSessions.delete(channelId);
            }
        });

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            return connection;
        } catch (err) {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
            if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 2000));
            else throw new Error(`Voice connection failed after ${maxAttempts} attempts`);
        }
    }

    throw new Error('Unreachable');
}

// ─── Per-User Recording ───────────────────────────────────────────────────────

async function startUserRecording(session: ActiveSession, member: GuildMember): Promise<void> {
    if (session.recordings.has(member.id)) return;

    const userId   = member.id;
    const userName = member.displayName;

    const opusStream = session.connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.Manual },
    });

    const tmpFile = path.join(tmpDir, `${session.sessionId}_${userId}_${Date.now()}.ogg`);

    const ffmpeg = spawn('ffmpeg', [
        '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0',
        '-c:a', 'libvorbis', '-b:a', '32k', '-ac', '1', '-ar', '48000',
        '-y', tmpFile,
    ], { stdio: ['pipe', 'ignore', 'ignore'] });

    const recording: UserRecording = {
        ffmpeg, filePath: tmpFile, userId, userName,
        startedAt: new Date(), bytesWritten: 0,
    };
    session.recordings.set(userId, recording);

    const prism = await import('prism-media');
    const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });

    opusStream.pipe(decoder).pipe(ffmpeg.stdin!).on('error', (err: Error) => {
        if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
            logError(`FFmpeg stdin error for ${userId}`, err);
        }
    });

    decoder.on('data', (chunk: Buffer) => { recording.bytesWritten += chunk.length; });

    log(`Started recording ${userName} in session ${session.sessionId}`);
}

async function stopUserRecording(session: ActiveSession, userId: string): Promise<void> {
    const recording = session.recordings.get(userId);
    if (!recording) return;

    session.recordings.delete(userId);

    try { session.connection.receiver.subscriptions.get(userId)?.destroy(); } catch { /* ok */ }
    try { recording.ffmpeg.stdin?.end(); } catch { /* ok */ }

    // Wait for FFmpeg to finish (max 10s)
    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => { recording.ffmpeg.kill('SIGKILL'); resolve(); }, 10_000);
        recording.ffmpeg.on('close', () => { clearTimeout(timeout); resolve(); });
    });

    if (!fs.existsSync(recording.filePath)) return;

    const stat = fs.statSync(recording.filePath);
    if (stat.size > 0) {
        const durationMs = Date.now() - recording.startedAt.getTime();
        const r2Key = `voice/${session.guildId}/${session.sessionId}/${userId}_${recording.startedAt.getTime()}.ogg`;

        try {
            if (R2Storage.isConfigured()) {
                const buffer = fs.readFileSync(recording.filePath);
                const r2Url  = await R2Storage.uploadBuffer(r2Key, buffer, 'audio/ogg');
                await db.voiceSegment.create({
                    data: {
                        sessionId: session.sessionId,
                        userId, userName: recording.userName,
                        r2Key, r2Url, durationMs,
                        fileSize: stat.size,
                        startedAt: recording.startedAt,
                        endedAt: new Date(),
                    },
                });
                log(`Uploaded segment for ${recording.userName}: ${r2Key} (${(stat.size / 1024).toFixed(1)}KB)`);
            } else {
                log(`R2 not configured — segment for ${recording.userName} not uploaded`);
            }
        } catch (err) {
            logError(`Failed to upload segment for ${userId}`, err);
        }
    }

    try { fs.unlinkSync(recording.filePath); } catch { /* ok */ }
}

// ─── Session Management ───────────────────────────────────────────────────────

async function startSession(state: VoiceState): Promise<void> {
    const channelId   = state.channelId!;
    const guildId     = state.guild.id;
    const channelName = state.channel?.name ?? channelId;

    try {
        const connection = await createConnection(channelId, guildId, state);

        const dbSession = await db.voiceSession.create({
            data: { guildId, channelId, channelName, workerId: WORKER_ID },
        });

        const session: ActiveSession = {
            sessionId:   dbSession.id,
            guildId, channelId, channelName,
            connection,
            recordings: new Map(),
            startedAt: new Date(),
        };
        activeSessions.set(channelId, session);

        log(`Started session in #${channelName}`);

        // Record everyone currently in the channel (re-fetch after connect for accuracy)
        const channel = state.guild.channels.cache.get(channelId);
        if (channel && channel.isVoiceBased()) {
            for (const [, member] of channel.members) {
                if (!member.user.bot) await startUserRecording(session, member);
            }
        }
    } catch (err) {
        logError(`Failed to start session in ${channelId}`, err);
        await releaseChannel(guildId, channelId);
    }
}

async function stopSession(channelId: string): Promise<void> {
    const session = activeSessions.get(channelId);
    if (!session) return;

    activeSessions.delete(channelId);

    for (const userId of [...session.recordings.keys()]) {
        await stopUserRecording(session, userId);
    }

    try { session.connection.destroy(); } catch { /* ok */ }

    try {
        await db.voiceSession.update({
            where: { id: session.sessionId },
            data:  { endedAt: new Date() },
        });
    } catch (err) {
        logError(`Failed to close session ${session.sessionId}`, err);
    }

    await releaseChannel(session.guildId, channelId);
    log(`Ended session in #${session.channelName}`);
}

// ─── Voice State Handler ──────────────────────────────────────────────────────

async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guildId = newState.guild.id;
    const member  = (newState.member ?? oldState.member) as GuildMember | null;
    if (!member || member.user.bot) return;

    // Load monitoring settings — skip if disabled
    const settings = await db.voiceMonitorSettings.findUnique({ where: { guildId } });
    if (!settings?.enabled) return;

    const monitoredChannels = (settings.monitoredChannelIds as string[]) ?? [];
    const excludedRoles     = (settings.excludedRoleIds     as string[]) ?? [];

    if (excludedRoles.length > 0 && member.roles.cache.some(r => excludedRoles.includes(r.id))) return;

    // Skip radio channel
    const radioSettings  = await db.radioSettings.findUnique({ where: { guildId } }).catch(() => null);
    const radioChannelId = radioSettings?.voiceChannelId ?? null;

    const shouldMonitor = (chId: string): boolean => {
        if (chId === radioChannelId) return false;
        if (monitoredChannels.length > 0 && !monitoredChannels.includes(chId)) return false;
        const ch = newState.guild.channels.cache.get(chId);
        return !!ch && ch.type === ChannelType.GuildVoice;
    };

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // ── User joined a channel ───────────────────────────────────────────────
    if (!oldChannelId && newChannelId && shouldMonitor(newChannelId)) {
        const session = activeSessions.get(newChannelId);
        if (session) {
            await startUserRecording(session, member);
        } else {
            const claimed = await claimChannel(guildId, newChannelId);
            if (!claimed) return; // another worker got it
            await startSession(newState);
        }
        return;
    }

    // ── User left a channel ─────────────────────────────────────────────────
    if (oldChannelId && !newChannelId && shouldMonitor(oldChannelId)) {
        const session = activeSessions.get(oldChannelId);
        if (!session) return; // we don't own this channel

        await stopUserRecording(session, member.id);

        const channel   = oldState.guild.channels.cache.get(oldChannelId);
        const remaining = channel?.isVoiceBased()
            ? [...channel.members.values()].filter(m => !m.user.bot)
            : [];

        if (remaining.length === 0) await stopSession(oldChannelId);
        return;
    }

    // ── User moved between channels ─────────────────────────────────────────
    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
        // Handle leave
        if (shouldMonitor(oldChannelId)) {
            const session = activeSessions.get(oldChannelId);
            if (session) {
                await stopUserRecording(session, member.id);
                const channel   = oldState.guild.channels.cache.get(oldChannelId);
                const remaining = channel?.isVoiceBased()
                    ? [...channel.members.values()].filter(m => !m.user.bot)
                    : [];
                if (remaining.length === 0) await stopSession(oldChannelId);
            }
        }

        // Handle join
        if (shouldMonitor(newChannelId)) {
            const session = activeSessions.get(newChannelId);
            if (session) {
                await startUserRecording(session, member);
            } else {
                const claimed = await claimChannel(guildId, newChannelId);
                if (claimed) await startSession(newState);
            }
        }
    }
}

// ─── Flush Loop (save in-progress recordings every 5 min) ─────────────────────

function startFlushLoop(): void {
    setInterval(async () => {
        for (const session of activeSessions.values()) {
            for (const userId of [...session.recordings.keys()]) {
                try {
                    const guildObj = client.guilds.cache.get(session.guildId);
                    const mem      = guildObj?.members.cache.get(userId);
                    await stopUserRecording(session, userId);
                    if (mem && mem.voice?.channelId === session.channelId) {
                        await startUserRecording(session, mem);
                    }
                } catch (err) {
                    logError(`Flush failed for ${userId}`, err);
                }
            }
        }
    }, 5 * 60 * 1000);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // Clean up any orphaned temp files from a previous crash
    try {
        const files = fs.readdirSync(tmpDir);
        for (const f of files) { try { fs.unlinkSync(path.join(tmpDir, f)); } catch { /* ok */ } }
        if (files.length > 0) log(`Cleaned ${files.length} orphaned temp files`);
    } catch { /* ok */ }

    await db.$connect();

    // Release stale locks held by this worker before it crashed
    try {
        const r = await db.voiceWorkerLock.deleteMany({ where: { workerId: WORKER_ID } });
        if (r.count > 0) log(`Released ${r.count} stale lock(s) from previous crash`);
    } catch { /* ok */ }

    // Mark orphaned sessions as closed
    try {
        const r = await db.voiceSession.updateMany({
            where: { workerId: WORKER_ID, endedAt: null },
            data:  { endedAt: new Date() },
        });
        if (r.count > 0) log(`Closed ${r.count} orphaned session(s)`);
    } catch { /* ok */ }

    startFlushLoop();

    client.once(Events.ClientReady, () => {
        log(`Ready as ${client.user?.tag}`);
    });

    client.on('voiceStateUpdate', async (oldState, newState) => {
        try {
            await handleVoiceStateUpdate(oldState, newState);
        } catch (err) {
            logError('voiceStateUpdate handler error', err);
        }
    });

    await client.login(TOKEN);
}

// ─── Shutdown ─────────────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
    log('Shutting down…');
    for (const channelId of [...activeSessions.keys()]) await stopSession(channelId);
    await db.$disconnect();
    process.exit(0);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

boot().catch(err => {
    logError('Fatal boot error', err);
    process.exit(1);
});
