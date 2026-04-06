/**
 * Radio Worker — standalone process (DEPRECATED)
 *
 * Radio playback is now handled by FujiRadioPlugin in the main bot process,
 * which creates its own dedicated Discord client using RADIO_BOT_TOKEN.
 *
 * This worker is kept for potential future use (e.g. sharded radio).
 * It will only run if RADIO_WORKER_ENABLED=true is explicitly set.
 */

import dotenv from 'dotenv';
dotenv.config();

const ENABLED = process.env.RADIO_WORKER_ENABLED === 'true';
if (!ENABLED) {
    console.log('[RadioWorker] RADIO_WORKER_ENABLED not set — radio is handled by FujiRadioPlugin. Exiting.');
    process.exit(0);
}

import { Client, GatewayIntentBits, Events } from 'discord.js';

const TOKEN = process.env.RADIO_BOT_TOKEN!;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.once(Events.ClientReady, () => {
    console.log(`[RadioWorker] Ready as ${client.user?.tag} — awaiting radio implementation`);
});

process.on('SIGINT',  () => { client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });

client.login(TOKEN).catch(err => {
    console.error('[RadioWorker] Login failed', err);
    process.exit(1);
});
