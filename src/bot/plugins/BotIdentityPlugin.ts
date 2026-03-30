import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class BotIdentityPlugin implements IPlugin {
    readonly id = 'bot-identity';
    readonly name = 'Bot Identity';
    readonly description = 'Configure the bot display name, avatar, status, and activity text';
    readonly defaultEnabled = true;
    readonly commands: string[] = [];
    readonly dashboardSections = ['bot-identity'];

    private logger!: Logger;

    async initialize(context: IPluginContext) {
        this.logger = context.logger;
        this.logger.info('Bot Identity Plugin initialized');
    }

    registerCommands() {
        return [];
    }
}
