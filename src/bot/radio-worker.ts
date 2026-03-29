/**
 * Radio Worker — dedicated Discord client for Fuji FM radio playback
 *
 * Runs as a separate PM2 process so it can hold a persistent voice connection
 * in the radio channel without conflicting with the voice recording workers.
 *
 * Required env vars:
 *   RADIO_BOT_TOKEN     Discord bot token
 *   RADIO_BOT_CLIENT_ID Discord application/client ID
 *   DATABASE_URL        Same Postgres DB as the main bot
 *
 * NOTE: Full radio playback logic is not yet implemented in this worker.
 *       The FujiRadioPlugin on the main bot continues to handle radio while
 *       this worker is being prepared. Set RADIO_WORKER_ENABLED=true in .env
 *       once this worker is ready to take over.
 */

import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, Events } from 'discord.js';

const TOKEN     = process.env.RADIO_BOT_TOKEN;
const CLIENT_ID = process.env.RADIO_BOT_CLIENT_ID;

if (!TOKEN) {
    console.warn('[RadioWorker] RADIO_BOT_TOKEN not set — worker exiting cleanly');
    process.exit(0);
}

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
