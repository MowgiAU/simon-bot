import {
    TextChannel,
    PermissionResolvable,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class AutoMessagesPlugin implements IPlugin {
    id = 'auto-messages';
    name = 'Auto Messages';
    description = 'Automatically sends a rotating list of messages to a channel on a configurable schedule.';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = ['SendMessages', 'ViewChannel'];
    commands: string[] = [];
    events: string[] = [];
    dashboardSections = ['auto-messages'];
    readonly defaultEnabled = true;

    configSchema = z.object({});

    private ticker?: ReturnType<typeof setInterval>;
    private context: IPluginContext | null = null;
    private logger = new Logger('AutoMessagesPlugin');

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.logger.info('Auto Messages Plugin initialized');

        // Tick every minute; debounced check handles per-guild timing
        this.ticker = setInterval(() => this.tick(), 60_000);
    }

    async shutdown(): Promise<void> {
        if (this.ticker) {
            clearInterval(this.ticker);
            this.ticker = undefined;
        }
    }

    private async tick(): Promise<void> {
        if (!this.context) return;
        const { db, client } = this.context;
        const now = new Date();

        let configs: any[];
        try {
            configs = await db.autoMessageConfig.findMany({
                where: { enabled: true, channelId: { not: null } },
                include: { messages: { orderBy: { position: 'asc' } } },
            });
        } catch {
            return; // DB not ready yet (e.g. migration pending)
        }

        for (const config of configs) {
            if (!config.messages.length) continue;

            const intervalMs = config.intervalMinutes * 60_000;
            const due = !config.lastSentAt
                || (now.getTime() - new Date(config.lastSentAt).getTime()) >= intervalMs;

            if (!due) continue;

            const msgIndex = config.currentIndex % config.messages.length;
            const entry = config.messages[msgIndex];

            try {
                const channel = await client.channels.fetch(config.channelId);
                if (!channel || !channel.isTextBased()) continue;

                await (channel as TextChannel).send(entry.content);

                await db.autoMessageConfig.update({
                    where: { id: config.id },
                    data: {
                        lastSentAt: now,
                        currentIndex: (msgIndex + 1) % config.messages.length,
                    },
                });
            } catch (err: any) {
                this.logger.warn(`AutoMessages: failed to send to channel ${config.channelId} in guild ${config.guildId}: ${err?.message}`);
            }
        }
    }
}
