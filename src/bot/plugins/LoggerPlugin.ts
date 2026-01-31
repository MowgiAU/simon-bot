import { 
    Message, 
    TextChannel, 
    PermissionResolvable, 
    EmbedBuilder, 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    ChannelType
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

export class LoggerPlugin implements IPlugin {
    id = 'logger';
    name = 'Log Manager';
    description = 'Centralized logging system with historical import capabilities';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = ['ViewAuditLog', 'ReadMessageHistory'];
    dashboardSections = ['logs-config']; // We'll assume the main 'logs' page handles viewing
    defaultEnabled = true;

    // Config: Map specific log types to specific output channels (for the future)
    configSchema = z.object({
        channels: z.record(z.string()).default({}), // e.g. { "mod": "12345", "voice": "67890" }
    });

    commands = [
        // We'll register a slash command definition here or in the init
        // For simplicity in this framework, we define the structure here for the manager to pick up
        // Note: The actual registration logic depends on how your PluginManager handles slash commands.
        // Assuming we need to handle interactionCreate for subcommands.
        'logger' 
    ];
    
    events = ['interactionCreate'];

    private context: IPluginContext | null = null;
    private logger = new Logger('LoggerPlugin');

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        
        // Register slash command manually if the framework doesn't do it automatically from a schema
        // For now, we will handle the logic in onInteractionCreate
    }

    async shutdown(): Promise<void> {}

    // Event Handler
    async onInteractionCreate(interaction: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'logger') return;

        if (interaction.options.getSubcommand() === 'import') {
            await this.handleImport(interaction);
        }
    }

    /**
     * Handles the historical import of logs from a channel
     */
    private async handleImport(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.context) return;
        
        // Check permissions
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.reply({ content: '❌ You need Administrator permissions to import logs.', ephemeral: true });
            return;
        }

        const channel = interaction.options.getChannel('channel') as TextChannel;
        const category = interaction.options.getString('category') || 'historical';
        
        if (!channel || channel.type !== ChannelType.GuildText) {
            await interaction.reply({ content: '❌ Invalid channel.', ephemeral: true });
            return;
        }

        await interaction.reply({ content: `⏳ Starting import of logs from ${channel} as category **${category}**. This may take a while...`, ephemeral: true });

        let processedCount = 0;
        let lastId: string | undefined = undefined;
        let hasMore = true;

        try {
            while (hasMore) {
                const messages = await channel.messages.fetch({ limit: 100, before: lastId });
                
                if (messages.size === 0) {
                    hasMore = false;
                    break;
                }

                const logPromises = messages.map(async (msg) => {
                    // Try to parse info from common bot formats (Dyno, etc)
                    // If parsing fails, we store the whole message content/embed as 'details'
                    
                    const logData = this.parseMessageToLog(msg);
                    
                    return this.context!.db.actionLog.create({
                        data: {
                            guildId: interaction.guildId!,
                            pluginId: 'logger-import',
                            action: category, // e.g., 'MOD', 'AUTOMOD'
                            executorId: logData.executorId || msg.author.id,
                            targetId: logData.targetId,
                            details: {
                                importedFrom: channel.id,
                                originalAuthor: msg.author.tag,
                                content: msg.content,
                                embeds: msg.embeds.map(e => e.toJSON()),
                                originalId: msg.id,
                                timestamp: msg.createdTimestamp,
                                parsedReason: logData.reason
                            },
                            createdAt: msg.createdAt // Preserve history!
                        }
                    });
                });

                await Promise.all(logPromises);

                lastId = messages.last()?.id;
                processedCount += messages.size;
                
                // Update every 500 messages
                if (processedCount % 500 === 0) {
                    await interaction.followUp({ content: `✅ Imported ${processedCount} logs so far...`, ephemeral: true });
                }
            }

            await interaction.followUp({ content: `🎉 **Import Complete!** imported ${processedCount} logs from ${channel} into category ${category}.`, ephemeral: true });

        } catch (error) {
            this.logger.error('Import failed', error);
            await interaction.followUp({ content: '❌ Import failed halfway. check bot logs.', ephemeral: true });
        }
    }

    /**
     * Attempt to extract meaningful IDs from Embeds (Dyno, Carl, etc)
     */
    private parseMessageToLog(msg: Message): { executorId?: string, targetId?: string, reason?: string } {
        const result: { executorId?: string, targetId?: string, reason?: string } = {};
        
        // Strategy: Look for IDs in footers or fields
        // Common pattern: "ID: 123456789" in Footer
        
        if (msg.embeds.length > 0) {
            const embed = msg.embeds[0];
            
            // Search footer for ID
            if (embed.footer?.text) {
                const idMatch = embed.footer.text.match(/ID:?\s*(\d{17,20})/i);
                if (idMatch) result.targetId = idMatch[1];
            }

            // Search description/fields for "Reason:"
            if (embed.description) {
                const reasonMatch = embed.description.match(/Reason:?\s*(.+)/i);
                if (reasonMatch) result.reason = reasonMatch[1];
            }
        }

        return result;
    }
}
