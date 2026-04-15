import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

/**
 * ProfileStylesPlugin
 *
 * Allows admins to grant enhanced visual styles to specific users on their
 * public profile pages. Styles are applied client-side (CSS gradients, glow
 * effects, animations) and are fully manageable via the dashboard.
 *
 * No bot commands; this plugin exists purely to register itself with the
 * plugin system and expose its dashboard section.
 */
export class ProfileStylesPlugin implements IPlugin {
    readonly id = 'profile-styles';
    readonly name = 'Enhanced Profile Styles';
    readonly version = '1.0.0';
    readonly description = 'Grant specific users gradient text, glow effects, and animations on their public profile page — like Discord Enhanced Role Styles, but on the website.';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [];
    readonly commands: string[] = [];
    readonly events: string[] = [];
    readonly dashboardSections = ['profile-styles'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({});

    private db!: PrismaClient;
    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.db = context.db;
        this.logger = context.logger;
        this.logger.info('ProfileStyles Plugin initialized');
    }

    async shutdown(): Promise<void> {}
}
