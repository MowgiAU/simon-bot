import {
    Client,
    EmbedBuilder,
    TextChannel,
    PermissionResolvable,
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const JOB_POLL_MS = 30_000;      // drain the outbound Reddit job queue
const THREAD_POLL_MS = 60_000;   // materialise due recurring threads
const MIRROR_POLL_MS = 30_000;   // push inbound Reddit events into Discord

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 30_000; // matches Devvit's own fetch ceiling
const EMBED_COLOR = 0xff4500;      // Reddit orange

/**
 * Bridges Fuji Studio and a subreddit via a Devvit app.
 *
 * All scheduling lives here rather than in devvit.json, because Devvit's cron
 * config is static and would need an app redeploy per schedule change. The
 * Devvit app is a thin executor: we push it one job at a time and it talks to
 * Reddit on our behalf.
 */
export class RedditBridgePlugin implements IPlugin {
    readonly id = 'reddit';
    readonly name = 'Reddit Bridge';
    readonly version = '1.0.0';
    readonly description = 'Posts scheduled threads and Fuji content to Reddit via a Devvit app, and mirrors subreddit activity back into Discord.';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = false;

    readonly requiredPermissions: PermissionResolvable[] = [];
    readonly commands: string[] = [];
    readonly events: string[] = [];
    readonly dashboardSections = ['reddit'];

    readonly configSchema = z.object({
        enabled: z.boolean().default(false),
        subreddit: z.string().optional(),
        mirrorChannelId: z.string().optional(),
        modAlertChannelId: z.string().optional(),
    });

    private db!: PrismaClient;
    private client!: Client;
    private logger: any;
    private jobTimer: ReturnType<typeof setInterval> | null = null;
    private threadTimer: ReturnType<typeof setInterval> | null = null;
    private mirrorTimer: ReturnType<typeof setInterval> | null = null;
    private siteBase = process.env.DASHBOARD_ORIGIN?.replace(/\/$/, '') || 'https://fujistud.io';

    async initialize(context: IPluginContext): Promise<void> {
        this.db = context.db;
        this.client = context.client;
        this.logger = context.logger;
        this.logger.info('Reddit Bridge Plugin initialized');

        this.jobTimer = setInterval(() => this.drainJobs(), JOB_POLL_MS);
        this.threadTimer = setInterval(() => this.runDueThreads(), THREAD_POLL_MS);
        this.mirrorTimer = setInterval(() => this.mirrorEvents(), MIRROR_POLL_MS);

        // Warm start so the first tick isn't a full interval away
        setTimeout(() => this.drainJobs(), 15_000);
        setTimeout(() => this.runDueThreads(), 20_000);
        setTimeout(() => this.mirrorEvents(), 25_000);
    }

    async shutdown(): Promise<void> {
        for (const t of [this.jobTimer, this.threadTimer, this.mirrorTimer]) {
            if (t) clearInterval(t);
        }
        this.jobTimer = null;
        this.threadTimer = null;
        this.mirrorTimer = null;
    }

    // ─── Settings ──────────────────────────────────────────────────────────────

    private async getSettings(guildId: string, subreddit: string) {
        return this.db.redditSettings.findUnique({
            where: { guildId_subreddit: { guildId, subreddit } },
        });
    }

    // ─── Outbound: drain the job queue ─────────────────────────────────────────

    private async drainJobs(): Promise<void> {
        try {
            const now = new Date();
            const pending = await this.db.redditJob.findMany({
                where: { status: 'pending', scheduledFor: { lte: now } },
                orderBy: { scheduledFor: 'asc' },
                take: 10,
            });

            for (const job of pending) {
                // Claim before the network call so a slow run cannot double-post.
                const claimed = await this.db.redditJob.updateMany({
                    where: { id: job.id, status: 'pending' },
                    data: { status: 'claimed', claimedAt: new Date(), attempts: { increment: 1 } },
                });
                if (claimed.count === 0) continue; // another tick got there first

                await this.executeJob({ ...job, attempts: job.attempts + 1 });
            }
        } catch (err: any) {
            this.logger.warn(`[Reddit] drainJobs error: ${err.message}`);
        }
    }

    private async executeJob(job: {
        id: string;
        guildId: string;
        subreddit: string;
        kind: string;
        payload: any;
        attempts: number;
    }): Promise<void> {
        const settings = await this.getSettings(job.guildId, job.subreddit);

        if (!settings?.enabled || !settings.devvitEndpointBase || !settings.devvitToken) {
            await this.failJob(job, 'Reddit bridge is not configured or is disabled', false);
            return;
        }

        const url = `${settings.devvitEndpointBase.replace(/\/$/, '')}/external/jobs/run`;

        try {
            const res = await axios.post(
                url,
                { job: { id: job.id, kind: job.kind, subreddit: job.subreddit, payload: job.payload } },
                {
                    headers: {
                        Authorization: `bearer ${settings.devvitToken}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: REQUEST_TIMEOUT_MS,
                    validateStatus: () => true,
                }
            );

            const body = res.data ?? {};

            if (res.status >= 200 && res.status < 300 && body.ok) {
                await this.db.redditJob.update({
                    where: { id: job.id },
                    data: {
                        status: 'done',
                        lastError: null,
                        redditId: body.redditId ?? null,
                        permalink: body.permalink ?? null,
                    },
                });
                await this.onJobSucceeded(job, body);
                this.logger.info(`[Reddit] Job ${job.id} (${job.kind}) completed -> ${body.permalink ?? body.redditId ?? 'ok'}`);
                return;
            }

            // Devvit rate limits at ~5 req/s; 429s and 5xx are worth another go.
            const retryable = body.retryable !== false && (res.status === 429 || res.status >= 500);
            await this.failJob(job, body.error || `Devvit responded ${res.status}`, retryable);
        } catch (err: any) {
            // Network/timeout failures are always worth retrying.
            await this.failJob(job, err.message || 'Request to Devvit failed', true);
        }
    }

    private async failJob(
        job: { id: string; kind: string; attempts: number },
        error: string,
        retryable: boolean
    ): Promise<void> {
        const giveUp = !retryable || job.attempts >= MAX_ATTEMPTS;

        if (giveUp) {
            await this.db.redditJob.update({
                where: { id: job.id },
                data: { status: 'failed', lastError: error },
            });
            this.logger.warn(`[Reddit] Job ${job.id} (${job.kind}) failed permanently: ${error}`);
            return;
        }

        // Exponential backoff: 1m, 2m, 4m, 8m — capped at 15m
        const delayMs = Math.min(60_000 * Math.pow(2, job.attempts - 1), 15 * 60_000);
        await this.db.redditJob.update({
            where: { id: job.id },
            data: {
                status: 'pending',
                lastError: error,
                scheduledFor: new Date(Date.now() + delayMs),
            },
        });
        this.logger.warn(`[Reddit] Job ${job.id} (${job.kind}) failed (attempt ${job.attempts}), retrying in ${Math.round(delayMs / 1000)}s: ${error}`);
    }

    /**
     * A successful submit_post for a recurring thread has to write the new post
     * back onto the thread row, so the next run can unsticky/lock it and link to it.
     */
    private async onJobSucceeded(
        job: { id: string; kind: string; payload: any },
        body: { redditId?: string; permalink?: string }
    ): Promise<void> {
        const threadId = job.payload?.threadId;
        if (job.kind !== 'submit_post' || !threadId || !body.redditId) return;

        await this.db.redditScheduledThread.update({
            where: { id: threadId },
            data: {
                lastPostId: body.redditId,
                lastPermalink: body.permalink ?? null,
            },
        }).catch((err: any) =>
            this.logger.warn(`[Reddit] Could not record post for thread ${threadId}: ${err.message}`)
        );
    }

    // ─── Outbound: recurring threads ───────────────────────────────────────────

    private async runDueThreads(): Promise<void> {
        try {
            const now = new Date();
            const due = await this.db.redditScheduledThread.findMany({
                where: { enabled: true, nextRunAt: { lte: now } },
                orderBy: { nextRunAt: 'asc' },
                take: 10,
            });

            for (const thread of due) {
                // Advance the schedule first — a template that throws must not
                // wedge the thread into posting on every single tick.
                const nextRunAt = new Date(now.getTime() + thread.intervalMinutes * 60_000);
                await this.db.redditScheduledThread.update({
                    where: { id: thread.id },
                    data: { nextRunAt, lastPostedAt: now },
                });

                await this.enqueueThreadJobs(thread).catch((err: any) =>
                    this.logger.warn(`[Reddit] Failed to queue thread "${thread.name}": ${err.message}`)
                );
            }
        } catch (err: any) {
            this.logger.warn(`[Reddit] runDueThreads error: ${err.message}`);
        }
    }

    private async enqueueThreadJobs(thread: any): Promise<void> {
        const settings = await this.getSettings(thread.guildId, thread.subreddit);
        if (!settings?.enabled) return;

        const title = await this.renderTemplate(thread.title, thread);
        const body = await this.renderTemplate(thread.bodyTemplate, thread);

        // Retire the previous thread before the new one goes up.
        if (thread.lastPostId) {
            if (thread.unstickyPrevious && thread.sticky) {
                await this.enqueue(thread, 'unsticky', { postId: thread.lastPostId });
            }
            if (thread.lockPrevious) {
                await this.enqueue(thread, 'lock', { postId: thread.lastPostId });
            }
        }

        await this.enqueue(thread, 'submit_post', {
            threadId: thread.id,
            title,
            text: body,
            flairId: thread.flairId ?? undefined,
            flairText: thread.flairText ?? undefined,
            sticky: thread.sticky,
            stickySlot: thread.stickySlot,
            distinguish: thread.distinguish,
        });

        this.logger.info(`[Reddit] Queued recurring thread "${thread.name}" for r/${thread.subreddit}`);
    }

    private async enqueue(
        thread: { guildId: string; subreddit: string; id: string },
        kind: string,
        payload: any
    ): Promise<void> {
        await this.db.redditJob.create({
            data: {
                guildId: thread.guildId,
                subreddit: thread.subreddit,
                kind,
                payload,
                threadId: thread.id,
            },
        });
    }

    // ─── Template rendering ────────────────────────────────────────────────────

    /**
     * Resolves {{token}} placeholders. Tokens that need a DB read are only
     * fetched when the template actually mentions them.
     */
    private async renderTemplate(template: string, thread: any): Promise<string> {
        let out = template;
        const has = (token: string) => out.includes(`{{${token}}}`);

        const now = new Date();

        if (has('date')) {
            out = out.replace(/\{\{date\}\}/g, now.toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
            }));
        }

        if (has('week')) {
            out = out.replace(/\{\{week\}\}/g, String(isoWeekNumber(now)));
        }

        if (has('prevThreadUrl')) {
            const url = thread.lastPermalink
                ? `https://www.reddit.com${thread.lastPermalink}`
                : '';
            out = out.replace(/\{\{prevThreadUrl\}\}/g, url);
        }

        if (has('topTracks')) {
            out = out.replace(/\{\{topTracks\}\}/g, await this.renderTopTracks());
        }

        if (has('activeBattle')) {
            out = out.replace(/\{\{activeBattle\}\}/g, await this.renderActiveBattle(thread.guildId));
        }

        return out;
    }

    private async renderTopTracks(limit = 10): Promise<string> {
        try {
            const snapshot = await this.db.chartSnapshot.findFirst({
                where: { period: 'weekly' },
                orderBy: { takenAt: 'desc' },
                include: {
                    entries: { orderBy: { position: 'asc' }, take: limit },
                },
            });
            if (!snapshot || snapshot.entries.length === 0) return '_No chart data yet._';

            const tracks = await this.db.track.findMany({
                where: { id: { in: snapshot.entries.map((e: any) => e.trackId) } },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    profile: { select: { username: true, displayName: true } },
                },
            });
            const byId = new Map(tracks.map((t: any) => [t.id, t]));

            const lines = snapshot.entries.map((entry: any) => {
                const track: any = byId.get(entry.trackId);
                if (!track) return null;
                const artist = track.profile?.displayName || track.profile?.username || 'Unknown';
                const path = track.slug
                    ? `/profile/${track.profile?.username}/${track.slug}`
                    : `/profile/${track.profile?.username}/${track.id}`;
                return `${entry.position}. [${track.title}](${this.siteBase}${path}) — ${artist}`;
            }).filter(Boolean);

            return lines.length ? lines.join('\n') : '_No chart data yet._';
        } catch (err: any) {
            this.logger.warn(`[Reddit] renderTopTracks failed: ${err.message}`);
            return '_Chart unavailable._';
        }
    }

    private async renderActiveBattle(guildId: string): Promise<string> {
        try {
            const battle = await this.db.beatBattle.findFirst({
                where: { guildId, status: { in: ['active', 'voting'] }, deletedAt: null, isTest: false },
                orderBy: { createdAt: 'desc' },
            });
            if (!battle) return '_No battle running right now._';

            const url = `${this.siteBase}/battles/${battle.slug || battle.id}`;
            const deadline = battle.status === 'voting' ? battle.votingEnd : battle.submissionEnd;
            const when = deadline
                ? ` — ${battle.status === 'voting' ? 'voting' : 'entries'} close ${deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
                : '';

            return `**[${battle.title}](${url})**${when}`;
        } catch (err: any) {
            this.logger.warn(`[Reddit] renderActiveBattle failed: ${err.message}`);
            return '';
        }
    }

    // ─── Inbound: mirror Reddit events into Discord ────────────────────────────

    private async mirrorEvents(): Promise<void> {
        try {
            const pending = await this.db.redditEvent.findMany({
                where: { mirroredAt: null },
                orderBy: { createdAt: 'asc' },
                take: 20,
            });

            for (const event of pending) {
                // Stamp first — a failed send must not become a repeating post.
                await this.db.redditEvent.update({
                    where: { id: event.id },
                    data: { mirroredAt: new Date() },
                });

                await this.postEventEmbed(event).catch((err: any) =>
                    this.logger.warn(`[Reddit] Failed to mirror event ${event.id}: ${err.message}`)
                );
            }
        } catch (err: any) {
            this.logger.warn(`[Reddit] mirrorEvents error: ${err.message}`);
        }
    }

    private async postEventEmbed(event: any): Promise<void> {
        const settings = await this.getSettings(event.guildId, event.subreddit);
        if (!settings?.enabled) return;

        const isModEvent = event.kind === 'mod-action';
        const channelId = isModEvent
            ? (settings.modAlertChannelId || settings.mirrorChannelId)
            : settings.mirrorChannelId;
        if (!channelId) return;

        // An empty flair allowlist means "mirror everything".
        if (!isModEvent && settings.mirrorFlairs.length > 0) {
            if (!event.flair || !settings.mirrorFlairs.includes(event.flair)) return;
        }

        const channel = this.client.channels.cache.get(channelId) as TextChannel | undefined;
        if (!channel || !channel.isTextBased()) {
            this.logger.warn(`[Reddit] Channel ${channelId} not found or not text-based for guild ${event.guildId}`);
            return;
        }

        const url = event.permalink ? `https://www.reddit.com${event.permalink}` : null;

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setAuthor({ name: labelForKind(event.kind) })
            .setFooter({ text: `r/${event.subreddit}${event.author ? ` • u/${event.author}` : ''}` })
            .setTimestamp(event.createdAt);

        if (event.title) embed.setTitle(truncate(event.title, 250));
        if (url) embed.setURL(url);
        if (event.body) embed.setDescription(truncate(event.body, 1800));
        if (event.flair) embed.addFields({ name: 'Flair', value: event.flair, inline: true });

        await channel.send({ embeds: [embed] });
        this.logger.info(`[Reddit] Mirrored ${event.kind} ${event.redditId} to channel ${channelId}`);
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function labelForKind(kind: string): string {
    switch (kind) {
        case 'post-create': return 'New Reddit post';
        case 'post-flair': return 'Post flair changed';
        case 'comment-create': return 'New Reddit comment';
        case 'mod-action': return 'Reddit mod action';
        default: return 'Reddit activity';
    }
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** ISO-8601 week number, so {{week}} lines up with how the community counts weeks. */
function isoWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Thursday of the current week determines the year
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
