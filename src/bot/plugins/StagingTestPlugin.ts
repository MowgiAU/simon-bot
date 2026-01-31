import { Client, Message, PermissionResolvable, GatewayIntentBits, MessageFlags } from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';

export class StagingTestPlugin implements IPlugin {
  readonly id = 'staging-test';
  readonly name = 'Staging Test';
  readonly version = '1.0.0';
  readonly description = 'A test plugin to verify staging environment';
  readonly author = 'Fuji Studio Team';
  
  readonly requiredPermissions: PermissionResolvable[] = ['SendMessages', 'ViewChannel'];
  readonly commands: string[] = ['staging'];
  readonly events: string[] = ['messageCreate'];
  readonly dashboardSections: string[] = ['staging-test'];
  readonly defaultEnabled: boolean = true;
  
  readonly configSchema = z.object({
      enabled: z.boolean().default(true)
  });
  
  private logger: any;

  async initialize(context: IPluginContext): Promise<void> {
    this.logger = context.logger;
    this.logger.info('Staging Test Plugin initialized');

    context.client.on('messageCreate', this.handleMessage.bind(this));
  }
  
  async shutdown(): Promise<void> {
      this.logger?.info('Staging Shutdown');
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;

    if (message.content === '!staging') {
      try {
        await message.reply({
            content: `✅ Staging Environment Active!\nBot: ${message.client.user?.tag}\nTime: ${new Date().toISOString()}`,
        });
        this.logger.info(`Staging test command used by ${message.author.tag}`);
      } catch (err) {
          this.logger.error('Failed to reply to staging command', err);
      }
    }
  }

  async stop(): Promise<void> {
    this.logger?.info('Staging Test Plugin stopped');
  }
}
