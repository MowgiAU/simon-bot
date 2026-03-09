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

    let creationCount = 0;

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
            creationCount++;
          }
          categories.set(catName, category);
        }

        // 2. Handle Forum
        const forumKey = `${catName}:${forumName}`;
        let forum = forums.get(forumKey);
        if (!forum) {
          // Check if forum exists under this category
          const normalizedForumName = forumName.toLowerCase().replace(/ /g, '-');
          forum = guild.channels.cache.find(c => 
            (c.name.toLowerCase() === forumName.toLowerCase() || c.name.toLowerCase() === normalizedForumName) 
            && c.parentId === category.id 
            && c.type === ChannelType.GuildForum
          );

          if (!forum) {
            this.logger.info(`Creating Forum: ${forumName} in ${catName}`);
            forum = await guild.channels.create({
              name: forumName,
              type: ChannelType.GuildForum,
              parent: category.id,
              topic: `Cloud storage for ${catName} > ${forumName}`
            });
            creationCount++;
          }
          forums.set(forumKey, forum);
        }

        // 3. Handle Thread
        // Fetch threads to ensure cache is hot
        const threadManager = forum.threads;
        const existingThreads = await threadManager.fetchActive();
        const archivedThreads = await threadManager.fetchArchived();
        
        let thread = existingThreads.threads.find((t: any) => t.name.toLowerCase() === threadName.toLowerCase());
        if (!thread) {
            thread = archivedThreads.threads.find((t: any) => t.name.toLowerCase() === threadName.toLowerCase());
        }

        if (!thread) {
          this.logger.info(`Creating Thread: ${threadName} in ${forumName}`);
          await forum.threads.create({
            name: threadName,
            autoArchiveDuration: 10080, // 1 week
            message: { content: `📦 **${threadName}**\nUpload your ${catName.toLowerCase()} ${forumName.toLowerCase()} samples here.` },
          });
          creationCount++;
        }

        // Rate Limit Handling Logic
        if (creationCount >= 10) {
          this.logger.info('Created 10 items. Resting for 2 minutes to respect Discord Rate Limits...');
          await new Promise(r => setTimeout(r, 120000)); // 2 minute rest
          creationCount = 0; // Reset counter
        } else {
          // Normal delay between items
          await new Promise(r => setTimeout(r, 3000));
        }

      } catch (err: any) {
        this.logger.error(`Failed to create structure for "${line}": ${err.message}`);
      }
    }

    this.logger.info('Scaffolding complete!');
  }
}
