import { Message, VoiceState, GuildBan } from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class StatsPlugin implements IPlugin {
  id = 'stats';
  name = 'Server Statistics';
  description = 'Tracks server activity, messages, voice time, and bans';
  version = '1.0.0';
  author = 'Simon Bot Team';
  
  requiredPermissions = [];
  commands = [];
  events = ['messageCreate', 'voiceStateUpdate', 'guildBanAdd'];
  dashboardSections = ['server-stats'];
  defaultEnabled = true;
  
  configSchema = z.object({});

  private context: IPluginContext | null = null;
  private logger: Logger;
  private voiceSessions = new Map<string, number>(); // userId -> startTime

  constructor() {
    this.logger = new Logger('StatsPlugin');
  }

  async initialize(context: IPluginContext): Promise<void> {
    this.context = context;
    this.logger.info('Stats plugin initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Stats plugin shut down');
  }

  private getToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async onMessageCreate(message: Message): Promise<void> {
    if (!this.context || message.author.bot || !message.guild) return;

    try {
      const today = this.getToday();
      
      // Update Channel Stats
      await this.context.db.channelStats.upsert({
        where: {
          guildId_channelId_date: {
            guildId: message.guildId,
            channelId: message.channelId,
            date: today
          }
        },
        update: {
            messages: { increment: 1 },
            channelName: (message.channel as any).name || 'Unknown'
        },
        create: {
            guildId: message.guildId,
            channelId: message.channelId,
            channelName: (message.channel as any).name || 'Unknown',
            date: today,
            messages: 1
        }
      });

      // Update Server Stats
      await this.context.db.serverStats.upsert({
        where: {
            guildId_date: {
                guildId: message.guildId,
                date: today
            }
        },
        update: {
            messageCount: { increment: 1 },
            memberCount: message.guild.memberCount // Update just in case
        },
        create: {
            guildId: message.guildId,
            date: today,
            messageCount: 1,
            memberCount: message.guild.memberCount
        }
      });
      
      // Update Member Last Active
      await this.context.db.member.upsert({
          where: {
              guildId_userId: {
                  guildId: message.guildId,
                  userId: message.author.id
              }
          },
          update: {
              lastActiveAt: new Date(),
              userId: message.author.id // ensure stored
          },
          create: {
              guildId: message.guildId,
              userId: message.author.id,
              lastActiveAt: new Date()
          }
      });

    } catch (error) {
      this.logger.error('Error tracking message stats', error);
    }
  }

  async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (!this.context) return;
    const userId = newState.id;
    const guildId = newState.guild.id;
    
    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
        this.voiceSessions.set(userId, Date.now());
    }
    
    // User left or switched
    if (this.voiceSessions.has(userId)) {
        // Calculate duration if they left or we just want to checkpoint on switch
        // For simplicity: if they left the guild voice entirely or switched channels, just log the session.
        // A switch is Leave(Old) + Join(New). `voiceStateUpdate` fires once for the switch, 
        // with both oldState.channelId AND newState.channelId present.
        
        let shouldLog = false;
        if (!newState.channelId) shouldLog = true; // Left voice entirely
        if (newState.channelId && newState.channelId !== oldState.channelId) shouldLog = true; // Switched

        if (shouldLog) {
            const startTime = this.voiceSessions.get(userId)!;
            const durationMs = Date.now() - startTime;
            const durationMinutes = Math.floor(durationMs / 1000 / 60);

            if (durationMinutes > 0) {
                const today = this.getToday();
                try {
                    await this.context.db.serverStats.upsert({
                        where: { guildId_date: { guildId, date: today } },
                        update: { voiceMinutes: { increment: durationMinutes } },
                        create: { guildId, date: today, voiceMinutes: durationMinutes, memberCount: newState.guild.memberCount }
                    });
                } catch (err) {
                    this.logger.error('Error saving voice stats', err);
                }
            }
            this.voiceSessions.delete(userId);
        }
    }
    
    // If they are in a channel (new join or switched into), start tracking new session
    if (newState.channelId && (!oldState.channelId || oldState.channelId !== newState.channelId)) {
         this.voiceSessions.set(userId, Date.now());
    }
  }

  async onGuildBanAdd(ban: GuildBan): Promise<void> {
      if (!this.context) return;
      const today = this.getToday();
      try {
          await this.context.db.serverStats.upsert({
              where: { guildId_date: { guildId: ban.guild.id, date: today } },
              update: { newBans: { increment: 1 } },
              create: { guildId: ban.guild.id, date: today, newBans: 1, memberCount: ban.guild.memberCount }
          });
      } catch (err) {
          this.logger.error('Error tracking ban', err);
      }
  }
}

export default new StatsPlugin();
