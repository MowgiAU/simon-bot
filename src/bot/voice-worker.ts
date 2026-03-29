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
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { R2Storage } from '../services/R2Storage.js';

const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegInstaller.path;

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

/** Check if any worker already owns this channel. */
async function isChannelClaimed(guildId: string, channelId: string): Promise<boolean> {
    const rows: any[] = await db.$queryRaw`
        SELECT "workerId" FROM voice_worker_locks
        WHERE "guildId" = ${guildId} AND "channelId" = ${channelId}
        LIMIT 1
    `;
    return rows.length > 0;
}

/** Check if a voice bot is already present in a voice channel. */
function hasBotInChannel(guildId: string, channelId: string): boolean {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return false;
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isVoiceBased()) return false;
    // Check if any bot (other than this worker, which hasn't joined yet) is in the channel
    return [...channel.members.values()].some(m => m.user.bot);
}

/** Atomically claim a channel for this worker. Returns true on success. */
async function claimChannel(guildId: string, channelId: string): Promise<boolean> {
    const affected = await db.$executeRaw`
        INSERT INTO voice_worker_locks ("guildId", "channelId", "workerId", "claimedAt")
        VALUES (${guildId}, ${channelId}, ${WORKER_ID}, NOW())
        ON CONFLICT ("guildId", "channelId") DO NOTHING
    `;
    if (affected > 0) {
        log(`Claimed channel ${channelId}`);
    }
    return affected > 0;
}

async function releaseChannel(guildId: string, channelId: string): Promise<void> {
    try {
        await db.$executeRaw`
            DELETE FROM voice_worker_locks
            WHERE "guildId" = ${guildId} AND "channelId" = ${channelId} AND "workerId" = ${WORKER_ID}
        `;
    } catch { /* ok */ }
}

// ─── Voice Connection ─────────────────────────────────────────────────────────

async function createConnection(channelId: string, guildId: string): Promise<VoiceConnection> {
    // Pre-flight: check bot permissions in the channel
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error(`Guild ${guildId} not in cache`);
    const channel = guild.channels.cache.get(channelId);
    const me = guild.members.me;
    if (channel && me) {
        const perms = channel.permissionsFor(me);
        if (!perms?.has('Connect') || !perms?.has('ViewChannel')) {
            throw new Error(`Missing permissions in #${channel.name} — CONNECT=${perms?.has('Connect')} VIEW=${perms?.has('ViewChannel')}`);
        }
    }

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
            adapterCreator: guild.voiceAdapterCreator as any,
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
            await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
            return connection;
        } catch (err) {
            const status = connection.state.status;
            log(`Voice connection attempt ${attempt}/${maxAttempts} failed — stuck in status: ${status}`);
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
            if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 2000));
            else throw new Error(`Voice connection failed after ${maxAttempts} attempts (last status: ${status})`);
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

    let opusPackets = 0;
    opusStream.on('data', () => { opusPackets++; });
    // Log after 5 seconds whether we're receiving any opus packets
    setTimeout(() => {
        log(`Recording check for ${userName}: ${opusPackets} opus packets received in first 5s`);
    }, 5000);

    const tmpFile = path.join(tmpDir, `${session.sessionId}_${userId}_${Date.now()}.ogg`);

    const ffmpeg = spawn(FFMPEG_PATH, [
        '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0',
        '-c:a', 'libvorbis', '-b:a', '32k', '-ac', '1', '-ar', '48000',
        '-y', tmpFile,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    // Handle spawn errors gracefully (e.g. ffmpeg binary not found)
    ffmpeg.on('error', (err) => {
        logError(`FFmpeg spawn error for ${userName}`, err);
        session.recordings.delete(userId);
    });

    // Capture FFmpeg errors
    let ffmpegStderr = '';
    ffmpeg.stderr?.on('data', (chunk: Buffer) => { ffmpegStderr += chunk.toString(); });
    ffmpeg.on('close', (code) => {
        if (code !== 0 && ffmpegStderr) logError(`FFmpeg exited ${code} for ${userName}: ${ffmpegStderr.slice(-200)}`);
    });

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

    if (!fs.existsSync(recording.filePath)) {
        log(`No file found for ${recording.userName} — no audio was received`);
        return;
    }

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
    } else {
        log(`Empty recording file for ${recording.userName} (${recording.bytesWritten} bytes decoded, file=${stat.size})`);
    }

    try { fs.unlinkSync(recording.filePath); } catch { /* ok */ }
}

// ─── Session Management ───────────────────────────────────────────────────────

async function startSession(guildId: string, channelId: string): Promise<void> {
    const guild = client.guilds.cache.get(guildId);
    const channelObj = guild?.channels.cache.get(channelId);
    const channelName = channelObj?.name ?? channelId;

    try {
        const connection = await createConnection(channelId, guildId);

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

        // Record everyone currently in the channel
        if (channelObj && channelObj.isVoiceBased()) {
            for (const [, member] of channelObj.members) {
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
            // Skip if a bot is already in the channel or another worker owns it
            if (hasBotInChannel(guildId, newChannelId)) return;
            if (await isChannelClaimed(guildId, newChannelId)) return;
            const claimed = await claimChannel(guildId, newChannelId);
            if (!claimed) return;
            await startSession(guildId, newChannelId);
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
                if (hasBotInChannel(guildId, newChannelId)) return;
                if (await isChannelClaimed(guildId, newChannelId)) return;
                const claimed = await claimChannel(guildId, newChannelId);
                if (claimed) await startSession(guildId, newChannelId);
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

// ─── Startup Scan — pick up channels that already have users ──────────────────

async function scanExistingVoiceChannels(): Promise<void> {
    for (const [, guild] of client.guilds.cache) {
        const guildId = guild.id;

        // Check if voice monitoring is enabled for this guild
        const settings = await db.voiceMonitorSettings.findUnique({ where: { guildId } });
        if (!settings?.enabled) continue;

        const monitoredChannels = (settings.monitoredChannelIds as string[]) ?? [];

        // Skip radio channel
        const radioSettings = await db.radioSettings.findUnique({ where: { guildId } }).catch(() => null);
        const radioChannelId = radioSettings?.voiceChannelId ?? null;

        for (const [, channel] of guild.channels.cache) {
            if (!channel.isVoiceBased() || channel.type !== ChannelType.GuildVoice) continue;
            if (channel.id === radioChannelId) continue;
            if (monitoredChannels.length > 0 && !monitoredChannels.includes(channel.id)) continue;

            const humans = [...channel.members.values()].filter(m => !m.user.bot);
            if (humans.length === 0) continue;

            // Skip if a bot is already in the channel or it's already claimed
            const bots = [...channel.members.values()].filter(m => m.user.bot);
            if (bots.length > 0) {
                log(`Startup scan: skipping #${channel.name} — bot already present (${bots.map(b => b.user.tag).join(', ')})`);
                continue;
            }
            if (await isChannelClaimed(guildId, channel.id)) continue;
            const claimed = await claimChannel(guildId, channel.id);
            if (!claimed) continue;

            log(`Startup scan: found ${humans.length} user(s) in #${channel.name}, starting session`);
            await startSession(guildId, channel.id);
        }
    }
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
    // NOTE: Only clear THIS worker's locks, not all locks.
    // Other workers may be healthy and holding valid locks.
    try {
        const r = await db.$executeRaw`
            DELETE FROM voice_worker_locks WHERE "workerId" = ${WORKER_ID}
        `;
        if (r > 0) log(`Released ${r} stale lock(s) from previous run`);
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

    client.once(Events.ClientReady, async () => {
        log(`Ready as ${client.user?.tag}`);
        log(`In ${client.guilds.cache.size} guild(s): ${[...client.guilds.cache.values()].map(g => `${g.name} (${g.id})`).join(', ')}`);

        // Scan for voice channels that already have users in them
        await scanExistingVoiceChannels();
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
