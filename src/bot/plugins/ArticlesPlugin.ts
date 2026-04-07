import type { IPlugin, IPluginContext } from '../types/plugin.js';
import { z } from 'zod';

/**
 * Articles Plugin — Lets staff create news articles, guides, and announcements
 * that appear on the front page. Supports rich content with embeds for tracks,
 * profiles, videos, and social inserts. All articles require admin approval.
 */
export class ArticlesPlugin implements IPlugin {
    readonly id = 'articles';
    readonly name = 'Articles';
    readonly description = 'Staff-authored news, guides, and announcements with rich content editor and front-page integration';
    readonly version = '1.0.0';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions: bigint[] = [];
    readonly commands: string[] = [];
    readonly events: string[] = [];
    readonly dashboardSections = ['articles'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({});

    private context!: IPluginContext;
    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.logger = context.logger;
        this.logger.info('[ArticlesPlugin] Initialized — article management is API/dashboard-driven');
    }

    async shutdown(): Promise<void> {
        this.logger.info('[ArticlesPlugin] Shutdown');
    }

    registerCommands() {
        return [];
    }
}
