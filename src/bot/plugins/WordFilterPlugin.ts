import { Message, TextChannel, Webhook, PermissionResolvable } from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

/**
 * WordFilterPlugin - First plugin for Fuji Studio
 * 
 * Functionality:
 * - Detects filtered words in user messages
 * - Deletes original message
 * - Reposts message with word replaced using user's avatar/nickname
 * - Configurable word groups with word or emoji replacements
 * - Excludable channels and roles
 * 
 * Dashboard sections:
 * - Settings: Enable/disable, repost setting, excluded channels/roles
 * - WordGroups: CRUD operations for word groups
 */
export class WordFilterPlugin implements IPlugin {
  id = 'word-filter';
  name = 'Word Filter';
  description = 'Filter inappropriate words and repost with replacements';
  version = '1.0.0';
  author = 'Fuji Studio Team';
  
  requiredPermissions: PermissionResolvable[] = ['ManageMessages', 'SendMessages'];
  commands = ['filter'];
  events = ['messageCreate'];
  dashboardSections = ['word-filter-settings', 'word-filter-groups'];
  defaultEnabled = true;
  
  configSchema = z.object({
    enabled: z.boolean().default(true),
    repostEnabled: z.boolean().default(true),
    excludedChannels: z.array(z.string()).default([]),
    excludedRoles: z.array(z.string()).default([]),
  });

  private context: IPluginContext | null = null;
  private logger: Logger;
  private messageHandler: ((msg: Message) => Promise<void>) | null = null;

  constructor() {
    this.logger = new Logger('WordFilterPlugin');
  }

  /**
   * Initialize plugin - called when bot starts
   */
  async initialize(context: IPluginContext): Promise<void> {
    this.context = context;
    this.logger.info('Word Filter plugin initialized');
  }

  /**
   * Cleanup plugin - called when bot shuts down or plugin disabled
   */
  async shutdown(): Promise<void> {
    this.logger.info('Word Filter plugin shut down');
  }

  /**
   * Message handler - detect and filter words
   * This would be called by the bot's message event dispatcher
   */
  async onMessage(message: Message): Promise<void> {
    if (!this.context || message.author.bot) return;
    if (!message.guild) return;

    // Get filter settings from database
    let settings = await this.context.db.filterSettings.findUnique({
      where: { guildId: message.guildId },
      include: { wordGroups: { include: { words: true } } },
    });

    // If settings don't exist yet, create them
    if (!settings) {
      try {
        await this.context.db.guild.upsert({
          where: { id: message.guildId },
          update: {},
          create: { id: message.guildId, name: message.guild.name },
        });
        settings = await this.context.db.filterSettings.create({
          data: {
            guildId: message.guildId,
            enabled: true,
            repostEnabled: true,
            excludedChannels: [],
            excludedRoles: [],
          },
          include: { wordGroups: { include: { words: true } } },
        });
        this.logger.info(`Created filter settings for guild ${message.guild.name}`);
      } catch (error) {
        this.logger.error('Failed to create filter settings', error);
        return;
      }
    }
    if (!settings.enabled) return;
    if (this.isExcluded(message, settings)) return;
    
    const { filtered, content, triggers } = this.processMessageContent(message.content, settings.wordGroups);
    
    if (!filtered) return;
    
    try {
      if (message.deletable) {
        await message.delete();
      }
      if (settings.repostEnabled) {
        await this.repostMessage(message, content);
      }
      
      this.logger.info(`Filtered message from ${message.author.username} in ${message.guild.name}`);
      
      // Log action to DB
      if (this.context) {
          await this.context.logAction({
              guildId: message.guild.id,
              actionType: 'message_filtered',
              executorId: message.author.id,
              targetId: message.channelId,
              details: {
                  channelName: (message.channel as any).name || 'unknown',
                  triggers: triggers,
                  filteredContent: content,
                  originalContent: message.content,
                  authorTag: message.author.tag
              }
          });
      }

    } catch (error) {
      this.logger.error('Failed to process filtered message', error);
    }
  }

  /**
   * Check if message channel/role is excluded from filtering
   */
  private isExcluded(message: Message, settings: any): boolean {
    // Check channel exclusion
    if (settings.excludedChannels.includes(message.channelId)) {
      return true;
    }

    // Check role exclusion
    if (message.member) {
      return settings.excludedRoles.some((roleId: string) =>
        message.member?.roles.cache.has(roleId)
      );
    }

    return false;
  }

  /**
   * Process message content and apply all filters
   */
  private processMessageContent(originalContent: string, wordGroups: any[]): { filtered: boolean, content: string, triggers: string[] } {
    let newContent = originalContent;
    let filtered = false;
    const triggers: string[] = [];

    for (const group of wordGroups) {
      if (group.enabled === false) continue; // Skip disabled groups

      const replacement = group.replacementText || (group.useEmoji ? group.replacementEmoji : null);
      const replacementStr = replacement || '***';

      for (const word of group.words) {
        const escapedWord = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match word boundary + word + optionally (s|es) + word boundary
        // This catches plurals (lime->limes, box->boxes) but avoids substring matches (Hi->This)
        const regex = new RegExp(`\\b${escapedWord}(?:s|es)?\\b`, 'gi');
        
        const matches = newContent.match(regex);
        if (matches && matches.length > 0) {
          newContent = newContent.replace(regex, replacementStr);
          filtered = true;
          triggers.push(...matches);
        }
      }
    }

    return { filtered, content: newContent, triggers: [...new Set(triggers)] };
  }

  /**
   * Repost message with filtered word replaced
   */
  private async repostMessage(message: Message, content: string): Promise<void> {
    if (!this.context || !message.guild) return;
    
    const nickname = message.member?.nickname || message.author.username;
    const avatar = message.author.avatarURL();
    
    // Only use webhook if channel is a TextChannel
    if (message.channel.type !== 0) return;
    
    const textChannel = message.channel as TextChannel;
    const webhooks = await textChannel.fetchWebhooks();
    let webhook = webhooks.find((w: Webhook) => w.owner?.id === message.client.user?.id);
    
    if (!webhook) {
      webhook = await textChannel.createWebhook({
        name: 'Fuji Studio Filter',
        avatar: message.client.user?.avatarURL(),
      });
    }
    
    await webhook.send({
      content: content,
      username: nickname,
      avatarURL: avatar || undefined,
    });
  }
}

export default new WordFilterPlugin();
