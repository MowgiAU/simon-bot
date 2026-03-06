import { Client, ChannelType } from 'discord.js';
import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * FujiGenerator: A one-time utility to scaffold the entire Fuji Studio Storage Guild
 * based on a tiered text file (Category > Forum > Thread).
 */
export class FujiGenerator {
  private logger = new Logger('FujiGenerator');
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Reads a text file and generates the structure in the specified guild.
   * File format: "Category > Forum > Thread"
   */
  async generateFromList(guildId: string, filePath: string) {
    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) throw new Error('Guild not found');

    this.logger.info(`Starting scaffold for guild: ${guild.name}`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && l.includes('>'));

    // Temporary caches to avoid re-creating existing parents
    const categories = new Map<string, any>(); // Name -> CategoryChannel
    const forums = new Map<string, any>();     // CategoryName:ForumName -> ForumChannel

    for (const line of lines) {
      const parts = line.split('>').map(p => p.trim());
      if (parts.length < 3) continue;

      const [catName, forumName, threadName] = parts;

      try {
        // 1. Handle Category
        let category = categories.get(catName);
        if (!category) {
          // Check if category already exists in guild
          category = guild.channels.cache.find(c => c.name === catName && c.type === ChannelType.GuildCategory);
          if (!category) {
            this.logger.info(`Creating Category: ${catName}`);
            category = await guild.channels.create({
              name: catName,
              type: ChannelType.GuildCategory,
            });
          }
          categories.set(catName, category);
        }

        // 2. Handle Forum
        const forumKey = `${catName}:${forumName}`;
        let forum = forums.get(forumKey);
        if (!forum) {
          // Check if forum exists under this category
          forum = guild.channels.cache.find(c => c.name.toLowerCase() === forumName.toLowerCase().replace(/ /g, '-') && c.parent_id === category.id);
          if (!forum) {
            this.logger.info(`Creating Forum: ${forumName} in ${catName}`);
            forum = await guild.channels.create({
              name: forumName,
              type: ChannelType.GuildForum,
              parent: category.id,
              topic: `Cloud storage for ${catName} > ${forumName}`
            });
          }
          forums.set(forumKey, forum);
        }

        // 3. Handle Thread
        // Check if thread exists in forum
        const existingThreads = await forum.threads.fetch();
        const thread = existingThreads.threads.find(t => t.name === threadName);

        if (!thread) {
          this.logger.info(`Creating Thread: ${threadName} in ${forumName}`);
          await forum.threads.create({
            name: threadName,
            message: { content: `📦 **${threadName}**\nUpload your ${catName.toLowerCase()} ${forumName.toLowerCase()} samples here.` },
          });
        }

        // Increased delay to 2.5 seconds to avoid Discord rate limits during mass channel creation
        await new Promise(r => setTimeout(r, 2500));

      } catch (err: any) {
        this.logger.error(`Failed to create structure for "${line}": ${err.message}`);
      }
    }

    this.logger.info('Scaffolding complete!');
  }
}
