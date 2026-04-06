import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';

/**
 * PrivateMessagesPlugin – Dashboard-only plugin that provides
 * admin oversight and management of the encrypted private messaging system.
 * No Discord slash commands or events — everything runs through the API / dashboard.
 */
export class PrivateMessagesPlugin implements IPlugin {
    readonly id = 'private-messages';
    readonly name = 'Private Messages';
    readonly version = '1.0.0';
    readonly description = 'Admin dashboard for monitoring and managing encrypted user-to-user private messages.';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [];
    readonly commands: string[] = [];
    readonly events: string[] = [];
    readonly dashboardSections = ['private-messages'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({});

    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.logger = context.logger;
        this.logger.info('Private Messages Plugin initialized');
    }

    async shutdown(): Promise<void> {}
}
