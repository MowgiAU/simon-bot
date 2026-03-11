import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { Logger } from '../utils/logger';
import * as mm from 'music-metadata';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'logs', 'fujiscanner.log');

/**
 * FujiScanner: Indexes audio files from the secondary Storage Guild into our metadata database.
 */
export class FujiScanner {
  private prisma: PrismaClient;
  private logger = new Logger('FujiScanner', { logFile: LOG_FILE });
  private token: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.token = process.env.DISCORD_TOKEN || '';
  }

  /**
   * Helper method to handle Discord API requests with rate limiting and retries.
   */
  private async request(url: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, {
          headers: { Authorization: `Bot ${this.token}` }
        });
        return response.data;
      } catch (error: any) {
        const status = error.response?.status;
        if ((status === 429 || status === 503) && i < retries - 1) {
          const retryAfter = error.response?.headers['retry-after'] 
            ? parseInt(error.response.headers['retry-after']) * 1000 
            : 5000;
          this.logger.warn(`Rate limited or service unavailable (${status}). Retrying in ${retryAfter}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise(r => setTimeout(r, retryAfter));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Main entry point to scan and index a Storage Guild.
   */
  async scanGuild(guildId: string) {
    this.logger.info(`Starting scan for Storage Guild: ${guildId}`);
    
    try {
      // 1. Fetch all channels in the guild
      const allChannels = await this.request(`https://discord.com/api/v10/guilds/${guildId}/channels`);
      
      const forumChannels = allChannels.filter((c: any) => c.type === 15); // Type 15 is FORUM
      
      this.logger.info(`Found ${forumChannels.length} forum channels to scan.`);

      for (const forum of forumChannels) {
        // Find the category this forum belongs to
        const category = allChannels.find((c: any) => c.id === forum.parent_id);
        const categoryName = category ? category.name : 'Uncategorized';
        
        await this.scanForum(guildId, forum.id, forum.name, categoryName);
      }
      
      this.logger.info('Full guild scan complete.');
    } catch (e: any) {
      this.logger.error(`Guild scan failed: ${e.message}`);
    }
  }

  /**
   * Scans a forum channel by iterating through its threads (Sample Packs).
   * forumName = "Kicks", categoryName = "Drums"
   */
  private async scanForum(guildId: string, forumId: string, forumName: string, categoryName: string) {
    this.logger.info(`Scanning forum: ${categoryName} > ${forumName} (${forumId})`);

    // Fetch active threads in the guild (Discord returns all active threads for the guild)
    const threadsData = await this.request(`https://discord.com/api/v10/guilds/${guildId}/threads/active`);

    const forumThreads = threadsData.threads.filter((t: any) => t.parent_id === forumId);

    for (let i = 0; i < forumThreads.length; i++) {
      const thread = forumThreads[i];
      // Index the thread as a pack, including the category and forum name in metadata/tags
      const packName = `${categoryName} | ${forumName} | ${thread.name}`;
      await this.scanChannel(guildId, thread.id, packName, [categoryName, forumName]); 
      
      // Delay 2000ms between each thread (sample pack)
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  /**
   * Scans an individual thread/channel (Sample Pack) for audio attachments.
   */
  private async scanChannel(guildId: string, channelId: string, channelName: string, parentTags: string[] = []) {
    this.logger.info(`Scanning sample thread: ${channelName} (${channelId})`);
    
    // 1. Ensure SamplePack exists in DB
    const pack = await this.prisma.samplePack.upsert({
      where: { channelId },
      update: { name: channelName },
      create: { 
        guildId, 
        channelId, 
        name: channelName,
        description: `Source: ${parentTags.join(' > ')}`
      }
    });

    let lastMessageId: string | null = null;
    let totalIndexed = 0;

    // 2. Paginate through channel messages
    while (true) {
      const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${lastMessageId ? `&before=${lastMessageId}` : ''}`;
      const messages = await this.request(url);

      if (messages.length === 0) break;

      for (const msg of messages) {
        for (const attachment of msg.attachments) {
          if (this.isAudioFile(attachment.filename)) {
            const indexed = await this.indexSample(pack.id, msg.id, attachment, parentTags);
            if (indexed) totalIndexed++;

            // Wait 1000ms after indexing each attachment
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        lastMessageId = msg.id;
      }
      
      if (messages.length < 100) break;
    }

    this.logger.info(`Finished ${channelName}. Indexed ${totalIndexed} samples.`);
  }

  /**
   * Core logic to index a single sample attachment.
   */
  async indexSample(packId: string, messageId: string, attachment: any, parentTags: string[] = []) {
    try {
      this.logger.info(`Starting indexing for sample: ${attachment.filename}`);
      // Skip if already indexed and identical
      const existing = await this.prisma.sampleMetadata.findUnique({
        where: { attachmentId: attachment.id }
      });
      if (existing) {
        this.logger.info(`Sample ${attachment.filename} already indexed, skipping.`);
        return false;
      }

      this.logger.info(`Indexing: ${attachment.filename}`);

      // Extract BPM and Key from filename
      const bpmMatch = attachment.filename.match(/(\d{2,3})\s*(?:bpm|BPM)/);
      const bpm = bpmMatch ? parseInt(bpmMatch[1]) : null;

      // Basic Key detection (A-G followed by optional #/b and maj/min/m)
      const keyMatch = attachment.filename.match(/(\s|_|^)([A-G](?:#|b|#m|bm|m|maj|min)?)(?:\s|_|\.|$)/i);
      const key = keyMatch ? keyMatch[2].toUpperCase() : null;

      // Parse metadata
      let duration: number | null = null;
      try {
        const metadataResp = await axios.get(attachment.url, { responseType: 'arraybuffer' });
        const metadata = await mm.parseBuffer(Buffer.from(metadataResp.data), attachment.content_type);
        duration = metadata.format.duration || null;
      } catch (err) {
        this.logger.warn(`Could not parse duration for ${attachment.filename}`);
      }

      await this.prisma.sampleMetadata.create({
        data: {
          packId,
          messageId,
          attachmentId: attachment.id,
          filename: attachment.filename,
          filesize: attachment.size,
          mimetype: attachment.content_type || 'audio/mpeg',
          duration: duration,
          bpm: bpm,
          key: key,
          tags: [...parentTags.map(t => t.toLowerCase()), ...this.generateTags(attachment.filename)]
        }
      });

      this.logger.info(`Successfully indexed sample: ${attachment.filename}`);
      return true;
    } catch (e: any) {
      this.logger.error(`Failed to index sample ${attachment.filename}: ${e.message}`);
      return false;
    }
  }

  private isAudioFile(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    return ['wav', 'mp3', 'flac', 'ogg'].includes(ext || '');
  }

  private generateTags(filename: string): string[] {
    // Basic automatic tagging based on filename
    return filename.toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(' ')
      .filter(t => t.length > 2);
  }
}
