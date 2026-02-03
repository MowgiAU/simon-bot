import { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    Events, 
    REST, 
    Routes,
    SlashCommandBuilder
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';
import { PluginManager } from './core/PluginManager';
import { PluginLoader } from './utils/PluginLoader';
import { WordFilterPlugin } from './plugins/WordFilterPlugin';
import { StatsPlugin } from './plugins/StatsPlugin';
import { LoggerPlugin } from './plugins/LoggerPlugin';
import { StagingTestPlugin } from './plugins/StagingTestPlugin';
import { ModerationPlugin } from './plugins/ModerationPlugin';
import { EconomyPlugin } from './plugins/EconomyPlugin';
import { ProductionFeedbackPlugin } from './plugins/ProductionFeedbackPlugin';
import { WelcomeGatePlugin } from './plugins/WelcomeGatePlugin';

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
      this.pluginManager.register(new WordFilterPlugin());
      this.pluginManager.register(new StatsPlugin());
      this.pluginManager.register(new LoggerPlugin());
      this.pluginManager.register(new StagingTestPlugin());
      this.pluginManager.register(new ModerationPlugin());
      this.pluginManager.register(new EconomyPlugin());
      this.pluginManager.register(new ProductionFeedbackPlugin());
      this.pluginManager.register(new WelcomeGatePlugin());

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
            logAction: async (data) => {
                try {
                    await this.db.actionLog.create({
                        data: {
                            pluginId: plugin.id,
                            guildId: data.guildId,
                            action: data.actionType,
                            executorId: data.executorId,
                            targetId: data.targetId,
                            details: data.details || {},
                        }
                    });
                } catch (err) {
                    this.logger.error(`Failed to log action for plugin ${plugin.id}`, err);
                }
            }
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
   * Start the identity update loop
   */
  private startIdentityLoop() {
    // Run immediately
    this.updateIdentity();
    // Then every 30 seconds
    setInterval(() => this.updateIdentity(), 30000);
  }

  private async updateIdentity() {
      try {
          const settings = await this.db.botSettings.findUnique({
              where: { botId: process.env.DISCORD_CLIENT_ID || 'global' }
          });

          if (!settings) return;

          // Update Presence
          const { status, activityType, activityText } = settings;
          
          this.logger.info(`Updating presence: ${status} - ${activityType} ${activityText}`);

          let type = 0; // Playing
          switch (activityType) {
              case 'PLAYING': type = 0; break;
              case 'WATCHING': type = 3; break;
              case 'LISTENING': type = 2; break;
              case 'COMPETING': type = 5; break;
              case 'CUSTOM': type = 4; break;
          }

          this.client.user?.setPresence({
              status: status as any,
              activities: activityText ? [{ name: activityText, type }] : []
          });

          // Update Global User (Rate-limited: 2 requests per hour)
          if (settings.username && settings.username !== this.client.user?.username) {
             this.logger.info(`Updating username to: ${settings.username}`);
             await this.client.user?.setUsername(settings.username);
          }
          
          if (settings.avatarUrl && settings.avatarUrl !== this.client.user?.displayAvatarURL()) {
             // Basic check, might re-upload if URL string is different but image is same. 
             // Ideally we shouldn't do this often.
             this.logger.info(`Updating avatar to: ${settings.avatarUrl}`);
             // check if it is a valid url
             try {
                await this.client.user?.setAvatar(settings.avatarUrl);
             } catch (avatarError) {
                this.logger.error('Failed to set avatar (invalid URL or rate limit)', avatarError);
             }
          }
      } catch (e) {
          this.logger.error('Failed to update bot identity', e);
      }
  }

  /**
   * Setup Discord event listeners
   */
  private setupEventListeners(): void {
    this.client.on(Events.ClientReady, async () => {
      this.logger.info(`Bot ready as ${this.client.user?.tag}`);
      await this.syncGuilds();
      
      // Register slash commands to ALL joined guilds
      this.logger.info(`Registering slash commands for ${this.client.guilds.cache.size} guilds to database...`);
      
      if (this.client.guilds.cache.size === 0) {
        this.logger.warn('No guilds found to register commands to, skipping registration');
      }

      for (const [id, guild] of this.client.guilds.cache) {
          try { 
              await this.registerSlashCommands(id);
              this.logger.info(`Registered commands for ${guild.name}`);
          } catch (e) {
              this.logger.error(`Failed to register commands for ${guild.name}`, e);
          }
      }

      // Start Bot Identity Manager
      this.startIdentityLoop();
    });

    this.client.on('interactionCreate', async interaction => {
       // Handle DM/No-Guild interactions
       if (!interaction.guildId) {
           if (interaction.isRepliable()) {
               try {
                   await interaction.reply({ content: 'I can only be used in servers!', ephemeral: true });
               } catch (e) {
                   // Ignore if already replied or missing permissions
               }
           }
           return;
       }

       const plugins = this.pluginManager.getEnabled();
       
       // Handle plugins in parallel to prevent timeouts
       await Promise.all(plugins.map(async (plugin) => {
         if (plugin.events.includes('interactionCreate')) {
           // Check if enabled for this guild
           const isEnabled = await this.isPluginEnabled(interaction.guildId!, plugin.id);
           // debug log
           if (interaction.isChatInputCommand() && interaction.commandName === 'setup-welcome' && plugin.id === 'welcome-gate') {
               this.logger.info(`WelcomeGate check: enabled=${isEnabled}, guild=${interaction.guildId}`);
           }

           if (!isEnabled) return;

           const p = plugin as any;
           if (typeof p.onInteractionCreate === 'function') {
             try {
                await p.onInteractionCreate(interaction);
             } catch (error) {
                this.logger.error(`Error in plugin ${plugin.id} interaction handler`, error);
             }
           }
         }
       }));
    });

    this.client.on('messageCreate', async message => {
      if (message.author.bot) return;

      const plugins = this.pluginManager.getEnabled();
      for (const plugin of plugins) {
        if (plugin.events.includes('messageCreate')) {
            // Check guild plugin status
            if (message.guildId) {
                const isEnabled = await this.isPluginEnabled(message.guildId, plugin.id);
                if (!isEnabled) continue;
            }

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
            const guildId = newState.guild.id;
            const isEnabled = await this.isPluginEnabled(guildId, plugin.id);
            if (!isEnabled) continue;

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

    this.client.on('messageReactionAdd', async (reaction, user) => {
      // Partial handling is done in the plugin or here, but djs usually requires fetching if partials are enabled in options
      if (user.bot) return;

      const plugins = this.pluginManager.getEnabled();
      for (const plugin of plugins) {
        if (plugin.events.includes('messageReactionAdd')) {
            // Check guild plugin status
            if (reaction.message.guildId) {
                const isEnabled = await this.isPluginEnabled(reaction.message.guildId, plugin.id);
                if (!isEnabled) continue;
            }

          const p = plugin as any;
          if (typeof p.onMessageReactionAdd === 'function') {
            try {
              await p.onMessageReactionAdd(reaction, user);
            } catch (error) {
              this.logger.error(`Error in plugin ${plugin.id} reaction handler`, error);
            }
          }
        }
      }
    });

    this.client.on('threadCreate', async (thread, newlyCreated) => {
      const plugins = this.pluginManager.getEnabled();
      for (const plugin of plugins) {
        if (plugin.events.includes('threadCreate')) {
            const isEnabled = await this.isPluginEnabled(thread.guildId, plugin.id);
            if (!isEnabled) continue;

          const p = plugin as any;
          if (typeof p.onThreadCreate === 'function') {
            try {
              await p.onThreadCreate(thread, newlyCreated);
            } catch (error) {
              this.logger.error(`Error in plugin ${plugin.id} thread handler`, error);
            }
          }
        }
      }
    });

    this.client.on('guildBanAdd', async (ban) => {
      const plugins = this.pluginManager.getEnabled();
      for (const plugin of plugins) {
        if (plugin.events.includes('guildBanAdd')) {
            const isEnabled = await this.isPluginEnabled(ban.guild.id, plugin.id);
            if (!isEnabled) continue;

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

  private pluginCache = new Map<string, boolean>();

  private async isPluginEnabled(guildId: string, pluginId: string): Promise<boolean> {
      const key = `${guildId}:${pluginId}`;
      if (this.pluginCache.has(key)) return this.pluginCache.get(key)!;

      try {
          const setting = await this.db.pluginSettings.findUnique({
              where: { guildId_pluginId: { guildId, pluginId } }
          });
          // Default to TRUE if no setting found
          const enabled = setting ? setting.enabled : true;
          
          this.pluginCache.set(key, enabled);
          setTimeout(() => this.pluginCache.delete(key), 30000); // 30s cache
          
          return enabled;
      } catch (e) {
          return true; 
      }
  }

  /**
   * Register Slash Commands
   */
  private async registerSlashCommands(targetGuildId?: string): Promise<void> {
    const commands: any[] = [];
    
    // Logger Plugin Command
    // Technically, plugins should export their command definitions
    // But for this quick fix we will hardcode the known commands or ask plugins for them
    // Ideally: this.pluginManager.getEnabled().forEach(p => commands.push(...p.commands))
    
    // 1. Logger Command
    const loggerCommand = new SlashCommandBuilder()
        .setName('logger')
        .setDescription('Logger plugin commands')
        .addSubcommand(sub => 
            sub
                .setName('import')
                .setDescription('Import historical logs from a text channel')
                .addChannelOption(opt => 
                    opt.setName('channel')
                        .setDescription('The channel to scrape logs from')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('The category to assign these logs (MOD, AUTOMOD, etc)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Moderation', value: 'MOD' },
                            { name: 'AutoMod', value: 'AUTOMOD' },
                            { name: 'Roles', value: 'ROLE' },
                            { name: 'Profanity', value: 'PROFANITY' },
                            { name: 'Piracy', value: 'PIRACY' },
                            { name: 'Links', value: 'LINK' }
                        )
                )
        );

    commands.push(loggerCommand.toJSON());

    // 2. Moderation Commands
    const kickCommand = new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user')
        .setDefaultMemberPermissions(0x0000000000000002) // KICK_MEMBERS
        .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick').setRequired(false));

    const banCommand = new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user')
        .setDefaultMemberPermissions(0x0000000000000004) // BAN_MEMBERS
        .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1d, 7d). Leave empty for permanent.').setRequired(false))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban').setRequired(false));

    const timeoutCommand = new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user')
        .setDefaultMemberPermissions(0x0000010000000000) // MODERATE_MEMBERS
        .addUserOption(opt => opt.setName('user').setDescription('User to timeout').setRequired(true))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout').setRequired(false));

    const purgeCommand = new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages')
        .setDefaultMemberPermissions(0x0000000000002000) // MANAGE_MESSAGES
        .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to delete').setRequired(true).setMinValue(1).setMaxValue(100));

    commands.push(kickCommand.toJSON());
    commands.push(banCommand.toJSON());
    commands.push(timeoutCommand.toJSON());
    commands.push(purgeCommand.toJSON());

    // 3. Economy Commands
    const walletCommand = new SlashCommandBuilder()
        .setName('wallet')
        .setDescription('Check your or another user\'s balance')
        .addUserOption(opt => opt.setName('user').setDescription('User to check'));

    const wealthCommand = new SlashCommandBuilder()
        .setName('wealth')
        .setDescription('View the richest users');

    const marketCommand = new SlashCommandBuilder()
        .setName('market')
        .setDescription('View items available in the shop');
    
    const buyCommand = new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an item from the shop')
        .addStringOption(opt => opt.setName('item').setRequired(true).setAutocomplete(true).setDescription('The name of the item to buy'));

    commands.push(walletCommand.toJSON());
    commands.push(wealthCommand.toJSON());
    commands.push(marketCommand.toJSON());
    commands.push(buyCommand.toJSON());

    // 4. Welcome Gate
    const setupWelcomeCommand = new SlashCommandBuilder()
        .setName('setup-welcome')
        .setDescription('Create the verification panel')
        .setDefaultMemberPermissions(0x10) // Manage Channels
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send panel to (default: current)'))
        .addStringOption(opt => opt.setName('title').setDescription('Embed Title'))
        .addStringOption(opt => opt.setName('description').setDescription('Embed Description'));

    commands.push(setupWelcomeCommand.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    const guildId = targetGuildId || process.env.GUILD_ID;

    if (!guildId) {
        this.logger.error('No GUILD_ID specified in .env, skipping slash command registration');
        return;
    }

    try {
        this.logger.info(`Started refreshing application (/) commands for guild: ${guildId}`);
        
        await rest.put(
            Routes.applicationGuildCommands(this.client.user!.id, guildId),
            { body: commands },
        );

        this.logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
        this.logger.error('Failed to register slash commands', error);
    }
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
