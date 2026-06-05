import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

let currentToken: string | null = null;
let registered = false;

/**
 * Call once after the user is confirmed logged in.
 * Requests permission, registers the device with FCM, and sends the token to
 * the API. Safe to call multiple times — registers listeners only once.
 */
export async function registerPushNotifications(navigateFn: (path: string) => void): Promise<void> {
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

    // Notification received while app is in the foreground — Capacitor shows it
    // automatically based on presentationOptions in capacitor.config.ts
    PushNotifications.addListener('pushNotificationReceived', (_notification) => {
        // No extra handling needed — the OS displays it via presentationOptions
    });

    // User tapped a notification
    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const url: string | undefined = notification.data?.url;
        if (url) {
            // url is a relative path like "/battles/abc123"
            navigateFn(url);
        }
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
