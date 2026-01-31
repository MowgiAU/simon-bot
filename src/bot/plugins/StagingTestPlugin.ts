import { Client, Message } from 'discord.js';
import { IPlugin, PluginContext } from '../core/IPlugin';
import { PrismaClient } from '@prisma/client';

export class StagingTestPlugin implements IPlugin {
  readonly id = 'staging-test';
  readonly name = 'Staging Test';
  readonly version = '1.0.0';
  readonly description = 'A test plugin to verify staging environment';
  
  private logger: any;

  async initialize(context: PluginContext): Promise<void> {
    this.logger = context.logger;
    this.logger.info('Staging Test Plugin initialized');

    context.client.on('messageCreate', this.handleMessage.bind(this));
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;

    if (message.content === '!staging') {
      await message.reply({
        content: `✅ Staging Environment Active!\nBot: ${message.client.user?.tag}\nTime: ${new Date().toISOString()}`,
      });
      this.logger.info(`Staging test command used by ${message.author.tag}`);
    }
  }

  async stop(): Promise<void> {
    this.logger?.info('Staging Test Plugin stopped');
  }
}
