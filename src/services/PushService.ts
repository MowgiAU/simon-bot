import * as admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

let app: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App | null {
    if (app) return app;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
        console.warn('[PushService] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
        return null;
    }
    try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.info('[PushService] Firebase Admin SDK initialised');
        return app;
    } catch (e) {
        console.error('[PushService] Failed to initialise Firebase Admin SDK:', e);
        return null;
    }
}

export interface PushPayload {
    title: string;
    body: string;
    /** Relative URL to navigate to when the notification is tapped, e.g. "/battles/abc123" */
    url?: string;
    /** Extra key/value data attached to the notification */
    data?: Record<string, string>;
    /** Android notification channel id */
    channelId?: string;
}

/** Keys on NotificationPreferences that map to push categories */
export type NotifPrefKey =
    | 'comments' | 'replies' | 'likes' | 'reposts' | 'follows' | 'messages'
    | 'followedUploads' | 'newTracksGlobal'
    | 'battleResults' | 'h2hUpdates'
    | 'newsNews' | 'newsGuide' | 'newsAnnouncement' | 'newsTutorial';

/**
 * Send a push notification to all registered devices for a given user.
 * Silently skips invalid/expired tokens and cleans them up from the DB.
 */
export async function sendPushToUser(
    db: PrismaClient,
    userId: string,
    payload: PushPayload,
): Promise<void> {
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) return;

    const tokens = await db.deviceToken.findMany({ where: { userId } });
    if (!tokens.length) return;

    const messaging = admin.messaging(firebaseApp);
    const staleTokens: string[] = [];

    await Promise.all(tokens.map(async ({ token }) => {
        try {
            await messaging.send({
                token,
                notification: {
                    title: payload.title,
                    body: payload.body,
                },
                data: {
                    ...(payload.url ? { url: payload.url } : {}),
                    ...(payload.data ?? {}),
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: payload.channelId || 'default',
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    },
                },
            });
            console.info(`[PushService] Sent "${payload.title}" to token …${token.slice(-8)}`);
        } catch (err: any) {
            if (
                err?.code === 'messaging/registration-token-not-registered' ||
                err?.code === 'messaging/invalid-registration-token'
            ) {
                console.warn(`[PushService] Stale token …${token.slice(-8)}, removing`);
                staleTokens.push(token);
            } else {
                console.error(`[PushService] FCM send failed for token …${token.slice(-8)}:`, err?.code || err?.message);
            }
        }
    }));

    if (staleTokens.length) {
        await db.deviceToken.deleteMany({ where: { token: { in: staleTokens } } });
    }
}

/**
 * Send a push notification only if the user has that preference enabled.
 * Creates the NotificationPreferences row with defaults on first use.
 */
export async function sendPushIfEnabled(
    db: PrismaClient,
    userId: string,
    prefKey: NotifPrefKey,
    payload: PushPayload,
): Promise<void> {
    try {
        const prefs = await db.notificationPreferences.upsert({
            where: { userId },
            create: { userId },
            update: {},
        });
        if (!prefs[prefKey]) return;
        await sendPushToUser(db, userId, payload);
    } catch {
        // Never throw — push is best-effort
    }
}

/**
 * Send a push notification to multiple users, respecting individual preferences.
 */
export async function sendPushToUsers(
    db: PrismaClient,
    userIds: string[],
    payload: PushPayload,
): Promise<void> {
    await Promise.all(userIds.map(userId => sendPushToUser(db, userId, payload)));
}

/**
 * Send a push notification to multiple users, each checked against their preferences.
 */
export async function sendPushToUsersIfEnabled(
    db: PrismaClient,
    userIds: string[],
    prefKey: NotifPrefKey,
    payload: PushPayload,
): Promise<void> {
    await Promise.all(userIds.map(userId => sendPushIfEnabled(db, userId, prefKey, payload)));
}
