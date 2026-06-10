import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

let currentToken: string | null = null;
let registered = false;
let listenersInitialised = false;
let navigateFn: ((path: string) => void) | null = null;
let pendingUrl: string | null = null;

const CHANNELS = [
    { id: 'social',   name: 'Social',          description: 'Likes, comments, follows, reposts, replies, messages', importance: 3 },
    { id: 'feed',     name: 'Feed',             description: 'New tracks from artists you follow', importance: 3 },
    { id: 'battles',  name: 'Battles',          description: 'Beat Battle and 1v1 updates', importance: 4 },
    { id: 'news',     name: 'News & Articles',  description: 'Published articles and announcements', importance: 3 },
    { id: 'messages', name: 'Direct Messages',  description: 'Private messages', importance: 4 },
    { id: 'default',  name: 'General',          description: 'General notifications', importance: 3 },
] as const;

async function createNotificationChannels(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
        for (const ch of CHANNELS) {
            await PushNotifications.createChannel({
                id: ch.id,
                name: ch.name,
                description: ch.description,
                importance: ch.importance,
                sound: 'default',
                vibration: true,
                visibility: 1,
            });
        }
    } catch {
        // Channel creation is best-effort — older Android versions may not support it
    }
}

function goToUrl(url: string): void {
    if (navigateFn) {
        navigateFn(url);
    } else {
        // Router/AuthProvider not ready yet (e.g. cold start) — replay once available
        pendingUrl = url;
    }
}

/**
 * Registers the push-notification-tap listener as early as possible (app
 * mount, before login completes). This must happen ASAP so a "tap to open"
 * action delivered on cold start isn't missed. Safe to call multiple times.
 */
export function initPushNotificationListeners(navigate: (path: string) => void): void {
    navigateFn = navigate;
    if (pendingUrl) {
        const url = pendingUrl;
        pendingUrl = null;
        navigate(url);
    }

    if (!Capacitor.isNativePlatform() || listenersInitialised) return;
    listenersInitialised = true;

    // Notification received while app is in the foreground — Capacitor shows it
    // automatically based on presentationOptions in capacitor.config.ts
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.info('[Push] Received in foreground:', JSON.stringify(notification));
    });

    // User tapped a notification (cold start, background, or foreground)
    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        console.info('[Push] Tapped:', JSON.stringify(notification));
        const url: string | undefined = notification.data?.url;
        if (url) {
            // url is a relative path like "/battles/abc123"
            goToUrl(url);
        }
    });
}

/**
 * Call once after the user is confirmed logged in.
 * Requests permission, registers the device with FCM, and sends the token to
 * the API. Safe to call multiple times — registers only once.
 */
export async function registerPushNotifications(navigate: (path: string) => void): Promise<void> {
    initPushNotificationListeners(navigate);

    if (!Capacitor.isNativePlatform()) return;
    if (registered) return;
    registered = true;

    const permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
        const result = await PushNotifications.requestPermissions();
        if (result.receive !== 'granted') return;
    } else if (permStatus.receive !== 'granted') {
        return;
    }

    await createNotificationChannels();
    await PushNotifications.register();

    PushNotifications.addListener('registration', async ({ value: token }) => {
        if (token === currentToken) return;
        currentToken = token;
        try {
            await fetch('/api/push/register', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, platform: 'android' }),
            });
        } catch { /* ignore — will retry on next app open */ }
    });

    PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Registration error:', err.error);
    });
}

/**
 * Call on logout — removes the token from the API so no notifications are
 * delivered to this device after sign-out.
 */
export async function unregisterPushNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform() || !currentToken) return;
    try {
        await fetch('/api/push/unregister', {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: currentToken }),
        });
    } catch { /* best-effort */ }
    currentToken = null;
    registered = false;
}
