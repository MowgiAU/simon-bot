import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';
import { PluginManager } from './core/PluginManager';
import { PluginLoader } from './utils/PluginLoader';
import WordFilterPlugin from './plugins/WordFilterPlugin';
import StatsPlugin from './plugins/StatsPlugin';

dotenv.config();

/**
 * SimonBot - Main Discord bot class
 * 
 * Responsibilities:
 * - Initialize Discord client
 * - Load and manage plugins
 * - Connect to database
 * - Setup event listeners
 * - Expose API for plugins
 */
export class SimonBot {
  private client: Client;
  private db: PrismaClient;
  private pluginManager: PluginManager;
  private pluginLoader: PluginLoader;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('SimonBot');
    
    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildMembers,
      ],
    });

    // Initialize database
    this.db = new PrismaClient();

    // Initialize plugin system
    this.pluginManager = new PluginManager();
    this.pluginLoader = new PluginLoader();
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    try {
      // Connect to database
      await this.db.$connect();
      this.logger.info('Connected to database');

      // Initialize default guild and word filter settings on startup
      await this.initializeDefaults();

      // Load plugins
      const plugins = await this.pluginLoader.loadPlugins();
      
      // For now, manually register the word filter plugin
      this.pluginManager.register(WordFilterPlugin);
      this.pluginManager.register(StatsPlugin);

      // Initialize enabled plugins
      for (const plugin of this.pluginManager.getEnabled()) {
        try {
          await plugin.initialize({
            logger: this.logger,
            config: new Map(),
            db: this.db,
            client: this.client,
            api: {
              baseUrl: process.env.API_URL || 'http://localhost:3001',
              token: process.env.DISCORD_TOKEN || '',
            },
          });
        } catch (error) {
          this.logger.error(`Failed to initialize plugin ${plugin.id}`, error);
        }
      }

      // Setup Discord event listeners
      this.setupEventListeners();

      // Login to Discord
      await this.client.login(process.env.DISCORD_TOKEN);
      this.logger.info('Bot logged in to Discord');
    } catch (error) {
      this.logger.error('Failed to start bot', error);
      process.exit(1);
    }
  }

  /**
   * Initialize default guild and settings
   */
  private async initializeDefaults(): Promise<void> {
    try {
      const guildId = 'default-guild';

      // Create or update default guild
      await this.db.guild.upsert({
        where: { id: guildId },
        update: {},
        create: { id: guildId, name: 'Default Guild' },
      });

      // Create or update default word filter settings
      await this.db.filterSettings.upsert({
        where: { guildId },
        update: {},
        create: {
          guildId,
          enabled: true,
          repostEnabled: true,
          excludedChannels: [],
          excludedRoles: [],
        },
      });

      this.logger.info('Initialized default guild and word filter settings');
    } catch (error) {
      this.logger.error('Failed to initialize defaults', error);
    }
  }

  /**
   * Setup Discord event listeners
   */
  private setupEventListeners(): void {
    this.client.on(Events.ClientReady, async () => {
      this.logger.info(`Bot ready as ${this.client.user?.tag}`);
      await this.syncGuilds();
    });

    this.client.on('messageCreate', async message => {
      if (message.author.bot) return;

      const plugins = this.pluginManager.getEnabled();
      for (const plugin of plugins) {
        if (plugin.events.includes('messageCreate')) {
          // Require specific typing or cast to any to access dynamic methods
          const p = plugin as any;
          
          try {
            // Support both standard naming and legacy onMessage
            if (typeof p.onMessageCreate === 'function') {
                await p.onMessageCreate(message);
            } else if (typeof p.onMessage === 'function') {
                await p.onMessage(message);
            }
          } catch (error) {
            this.logger.error(`Error in plugin ${plugin.id} message handler`, error);
          }
        }
      }
    });

    this.client.on('voiceStateUpdate', async (oldState, newState) => {
      const plugins = this.pluginManager.getEnabled();
      for (const plugin of plugins) {
        if (plugin.events.includes('voiceStateUpdate')) {
          const p = plugin as any;
          if (typeof p.onVoiceStateUpdate === 'function') {
            try {
              await p.onVoiceStateUpdate(oldState, newState);
            } catch (error) {
              this.logger.error(`Error in plugin ${plugin.id} voice handler`, error);
            }
          }
        }
      }
    });

    this.client.on('guildBanAdd', async (ban) => {
      const plugins = this.pluginManager.getEnabled();
      for (const plugin of plugins) {
        if (plugin.events.includes('guildBanAdd')) {
          const p = plugin as any;
          if (typeof p.onGuildBanAdd === 'function') {
            try {
              await p.onGuildBanAdd(ban);
            } catch (error) {
              this.logger.error(`Error in plugin ${plugin.id} ban handler`, error);
            }
          }
        }
      }
    });

    this.client.on('guildCreate', async guild => {
      this.logger.info(`Joined guild: ${guild.name} (${guild.id})`);

      // Create guild record in database
      try {
        await this.db.guild.upsert({
          where: { id: guild.id },
          update: {},
          create: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
          },
        });

        // Create default filter settings
        await this.db.filterSettings.upsert({
          where: { guildId: guild.id },
          update: {},
          create: {
            guildId: guild.id,
            enabled: true,
            repostEnabled: true,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to setup guild ${guild.id}`, error);
      }
    });

    this.client.on('error', error => {
      this.logger.error('Discord client error', error);
    });
  }

  /**
   * Sync all guilds the bot is in to the database
   */
  private async syncGuilds(): Promise<void> {
    this.logger.info(`Syncing ${this.client.guilds.cache.size} guilds to database...`);
    
    for (const [id, guild] of this.client.guilds.cache) {
      try {
        // Create or update guild record
        await this.db.guild.upsert({
          where: { id: guild.id },
          update: {
            name: guild.name,
            icon: guild.iconURL(),
          },
          create: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
          },
        });

        // Ensure filter settings exist
        await this.db.filterSettings.upsert({
          where: { guildId: guild.id },
          update: {},
          create: {
            guildId: guild.id,
            enabled: true,
            repostEnabled: true,
          },
        });
        
        this.logger.info(`Synced guild: ${guild.name} (${guild.id})`);
      } catch (error) {
        this.logger.error(`Failed to sync guild ${guild.id}`, error);
      }
    }
  }

  /**
   * Shutdown bot gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down bot...');

    // Disable all plugins
    for (const plugin of this.pluginManager.getEnabled()) {
      try {
        await plugin.shutdown();
      } catch (error) {
        this.logger.error(`Failed to shutdown plugin ${plugin.id}`, error);
      }
    }

    // Disconnect from Discord
    this.client.destroy();

    // Disconnect from database
    await this.db.$disconnect();

    this.logger.info('Bot shutdown complete');
  }

  // Getters for external access
  getClient() {
    return this.client;
  }

  getDB() {
    return this.db;
  }

  getPluginManager() {
    return this.pluginManager;
  }
}

// Run the bot
const bot = new SimonBot();
bot.start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await bot.shutdown();
  process.exit(0);
});
