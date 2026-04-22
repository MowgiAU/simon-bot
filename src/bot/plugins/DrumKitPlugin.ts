import { PermissionResolvable } from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';

/**
 * Drum Kit Generator
 * ─────────────────
 * Dashboard-only tool: procedurally synthesises royalty-free drum samples
 * (kick / snare / hat / perc) entirely in the browser. No Discord commands or
 * events — this plugin shell exists only to register the dashboard section.
 */
export class DrumKitPlugin implements IPlugin {
    readonly id = 'drum-kit';
    readonly name = 'Drum Kit Generator';
    readonly version = '1.0.0';
    readonly description = 'Procedurally synthesised, royalty-free drum kit samples (browser-side).';
    readonly author = 'Fuji Studio Team';

    readonly requiredPermissions: PermissionResolvable[] = [];
    readonly commands: string[] = [];
    readonly events: string[] = [];
    readonly dashboardSections: string[] = ['drum-kit'];
    readonly defaultEnabled: boolean = true;

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
    });

    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.logger = context.logger;
        this.logger.info('Drum Kit Generator plugin initialized (dashboard-only)');
    }

    async shutdown(): Promise<void> {
        this.logger?.info('Drum Kit Generator plugin shut down');
    }
}
