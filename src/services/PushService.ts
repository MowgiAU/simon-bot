import * as admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

let app: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App | null {
    if (app) return app;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) return null;
    try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
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
}

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
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    },
                },
            });
        } catch (err: any) {
            // FCM returns these codes for tokens that are permanently invalid
            if (
                err?.code === 'messaging/registration-token-not-registered' ||
                err?.code === 'messaging/invalid-registration-token'
            ) {
                staleTokens.push(token);
            }
        }
    }));

    if (staleTokens.length) {
        await db.deviceToken.deleteMany({ where: { token: { in: staleTokens } } });
    }
}

/**
 * Send a push notification to multiple users at once.
 */
export async function sendPushToUsers(
    db: PrismaClient,
    userIds: string[],
    payload: PushPayload,
): Promise<void> {
    await Promise.all(userIds.map(userId => sendPushToUser(db, userId, payload)));
}
