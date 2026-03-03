
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';
import { Guild, GuildMember, PermissionResolvable } from 'discord.js';
import { z } from 'zod';

export default class CommunityProgressionPlugin implements IPlugin {
    readonly id = 'community-progression';
    readonly name = 'Community Progression';
    readonly description = 'Handles server leveling, XP, and role rewards';
    readonly version = '1.0.0';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = true;

    readonly requiredPermissions: PermissionResolvable[] = ['ManageRoles'];
    readonly commands: string[] = ['level', 'rank', 'top'];
    readonly events: string[] = ['messageCreate'];
    readonly dashboardSections: string[] = ['settings', 'rewards'];
    readonly configSchema = z.object({
        xpPerMessage: z.number().default(15),
        cooldown: z.number().default(60),
    });

    private logger = new Logger('CommunityProgressionPlugin');
    private context?: IPluginContext;

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.logger.info('Community Progression Plugin initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('Community Progression Plugin shutting down');
    }
}
