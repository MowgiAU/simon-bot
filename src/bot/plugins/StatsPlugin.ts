import { Message, VoiceState, GuildBan } from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class StatsPlugin implements IPlugin {
  id = 'stats';
  name = 'Server Statistics';
  description = 'Tracks server activity, messages, voice time, and bans';
  version = '1.0.0';
  author = 'Fuji Studio Team';
  
  requiredPermissions = [];
  commands = [];
  events = ['messageCreate', 'voiceStateUpdate', 'guildBanAdd', 'guildMemberAdd', 'guildMemberRemove'];
  dashboardSections = ['server-stats'];
  defaultEnabled = true;
  
  configSchema = z.object({});

  private context: IPluginContext | null = null;
  private logger: Logger;
  private voiceSessions = new Map<string, { startTime: number; guildId: string }>(); // userId -> session info

  constructor() {
    this.logger = new Logger('StatsPlugin');
  }

  async initialize(context: IPluginContext): Promise<void> {
    this.context = context;
    this.logger.info('Stats plugin initialized');
    
    // Scan for existing voice states on startup
    // This catches users who are already in voice when the bot starts
    if (this.context.client?.guilds) {
        this.context.client.guilds.cache.forEach(guild => {
            guild.voiceStates.cache.forEach(state => {
                if (state.channelId && state.id && state.guild.id) {
                    this.voiceSessions.set(state.id, { startTime: Date.now(), guildId: state.guild.id });
                }
            });
        });
        this.logger.info(`Restored ${this.voiceSessions.size} active voice sessions from scan`);
    } else {
        // Client might not be ready yet? Usually initialize is called after ready if we wait for it, 
        // but in SimonBot.start(), initialize happens BEFORE 'ready' event for some reason?
        // Let's check index.ts ordering locally.
        // Actually, this.client.login is called AFTER initialize in index.ts.
        // So guilds.cache is empty here.
        // We need to listen for 'ready' event.
        if (this.context.client) {
            this.context.client.on('ready', () => {
                this.scanVoiceChannels();
            });
        }
    }
  }

  private scanVoiceChannels() {
      if (!this.context?.client) return;
      this.logger.info('Scanning voice channels for existing sessions...');
      let count = 0;
      this.context.client.guilds.cache.forEach(guild => {
          guild.voiceStates.cache.forEach(state => {
              // Ensure they are actually in a channel and not a bot
              if (state.channelId && state.member && !state.member.user.bot) {
                  // Only track if not already tracked (though unlikely on startup)
                  if (!this.voiceSessions.has(state.id)) {
                      this.voiceSessions.set(state.id, { startTime: Date.now(), guildId: state.guild.id });
                      count++;
                  }
              }
          });
      });
      this.logger.info(`Initialized tracking for ${count} users in voice channels.`);
  }

  async shutdown(): Promise<void> {
    this.logger.info('Stats plugin shutting down, saving pending voice sessions...');
    await this.savePendingSessions();
  }

  private async savePendingSessions() {
      if (!this.context) return;
      const today = this.getToday();
      const now = Date.now();
      const promises = [];

      for (const [userId, session] of this.voiceSessions.entries()) {
          const durationMs = now - session.startTime;
          const durationMinutes = Math.floor(durationMs / 1000 / 60);
          
          if (durationMinutes > 0) {
              // We need the guildId for the session. 
              const guildId = session.guildId;
              
              if (guildId) {
                  promises.push(this.context.db.serverStats.upsert({
                      where: { guildId_date: { guildId, date: today } },
                      update: { voiceMinutes: { increment: durationMinutes } },
                      create: { guildId, date: today, voiceMinutes: durationMinutes, memberCount: 0 } // memberCount 0 is safe, upsert will update real count later
                  }).catch((err: any) => this.logger.error(`Error saving shutdown stats for ${userId}`, err)));
              }
          }
      }
      
      await Promise.all(promises);
      this.voiceSessions.clear();
      this.logger.info('Saved pending voice stats.');
  }

  private findUserGuild(userId: string): string | null {
      if (!this.context || !this.context.client) return null;
      // This is expensive but necessary if we don't store guildId in the session map.
      // Alternatively, we could change voiceSessions to store { startTime: number, guildId: string }
      // Iterating all guilds is okay for shutdown.
      for (const guild of this.context.client.guilds.cache.values()) {
        if (guild.voiceStates.cache.has(userId)) return guild.id;
      }
      return null;
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
            // Need to cast to any or check type because we changed the Map value type
            const session = this.voiceSessions.get(userId) as any; 
            // Handle both old (number) and new ({startTime, guildId}) formats during transition if needed
            // But since we are restarting, memory is fresh.
            const startTime = session.startTime || session; 
            
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
         this.voiceSessions.set(userId, { startTime: Date.now(), guildId });
    }
  }

  async onGuildBanAdd(ban: GuildBan): Promise<void> {
      if (!this.context) return;
      const today = this.getToday();
      try {
          await this.context.db.serverStats.upsert({
              where: { guildId_date: { guildId: ban.guild.id, date: today } },
              update: { newBans: { increment: 1 }, memberCount: ban.guild.memberCount },
              create: { guildId: ban.guild.id, date: today, newBans: 1, memberCount: ban.guild.memberCount }
          });
      } catch (err) {
          this.logger.error('Error tracking ban', err);
      }
  }

  async onGuildMemberAdd(member: any): Promise<void> {
      if (!this.context) return;
      const today = this.getToday();
      try {
          await this.context.db.serverStats.upsert({
              where: { guildId_date: { guildId: member.guild.id, date: today } },
              update: { newMembers: { increment: 1 }, memberCount: member.guild.memberCount },
              create: { guildId: member.guild.id, date: today, newMembers: 1, memberCount: member.guild.memberCount }
          });
      } catch (err) {
          this.logger.error('Error tracking join', err);
      }
  }

  async onGuildMemberRemove(member: any): Promise<void> {
      if (!this.context) return;
      const today = this.getToday();
      try {
          await this.context.db.serverStats.upsert({
              where: { guildId_date: { guildId: member.guild.id, date: today } },
              update: { memberCount: member.guild.memberCount },
              create: { guildId: member.guild.id, date: today, memberCount: member.guild.memberCount }
          });
      } catch (err) {
          this.logger.error('Error tracking leave', err);
      }
  }
}

export default new StatsPlugin();
