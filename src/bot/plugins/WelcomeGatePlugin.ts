import { 
    Client, 
    GuildMember, 
    PermissionFlagsBits,
    EmbedBuilder,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    Interaction,
    ButtonInteraction,
    ModalSubmitInteraction,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    Colors,
    Message,
    VoiceState
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export class WelcomeGatePlugin implements IPlugin {
    readonly id = 'welcome-gate';
    readonly name = 'Welcome Gate';
    readonly version = '1.0.0';
    readonly description = 'Verification system with questions and role gating';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.MoveMembers
    ];

    readonly commands = ['setup-welcome'];
    readonly events = ['interactionCreate', 'guildMemberAdd', 'messageCreate', 'voiceStateUpdate'];
    readonly dashboardSections = ['welcome-gate']; // Future dashboard page
    readonly defaultEnabled = true;

    // Config schema for validation
    readonly configSchema = z.object({
        enabled: z.boolean().default(false),
        welcomeChannelId: z.string().optional(),
        unverifiedRoleId: z.string().optional(),
        verifiedRoleId: z.string().optional(),
        modalTitle: z.string().default('Server Verification'),
        questions: z.array(z.string()).default([])
    });

    private client!: Client;
    private db!: PrismaClient;
    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.logger.info('Welcome Gate Plugin initialized');
        
        // Ensure settings exist for all guilds
        await this.initializeSettings();
    }

    async shutdown(): Promise<void> {
        this.logger.info('Welcome Gate Plugin shutting down');
    }

    private async initializeSettings() {
        const guilds = this.client.guilds.cache;
        for (const [id] of guilds) {
            try {
                const exists = await this.db.welcomeGateSettings.findUnique({ where: { guildId: id } });
                if (!exists) {
                    await this.db.welcomeGateSettings.create({
                        data: { guildId: id }
                    });
                }
            } catch (e) {
                this.logger.error(`Failed to init welcome settings for ${id}`, e);
            }
        }
    }

    // --- Event Handlers ---

    // 1. Assign Unverified Role on Join
    async onGuildMemberAdd(member: GuildMember) {
        try {
            const settings = await this.db.welcomeGateSettings.findUnique({
                where: { guildId: member.guild.id }
            });

            if (!settings || !settings.enabled || !settings.unverifiedRoleId) return;

            const role = member.guild.roles.cache.get(settings.unverifiedRoleId);
            if (role) {
                await member.roles.add(role);
                this.logger.info(`Assigned unverified role to ${member.user.tag} in ${member.guild.name}`);
            }
        } catch (e) {
            this.logger.error('Error assigning unverified role', e);
        }
    }

    // 2. Handle Interactions
    async onInteractionCreate(interaction: Interaction) {
        if (interaction.isButton()) {
            await this.handleButton(interaction);
        } else if (interaction.isModalSubmit()) {
            await this.handleModalSubmit(interaction);
        } else if (interaction.isChatInputCommand()) {
             if (interaction.commandName === 'setup-welcome') {
                 await this.handleSetupCommand(interaction);
             }
        }
    }

    private async handleButton(interaction: ButtonInteraction) {
        if (interaction.customId !== 'welcome_verify_btn') return;

        const settings = await this.db.welcomeGateSettings.findUnique({
            where: { guildId: interaction.guildId! }
        });

        if (!settings || !settings.enabled) {
            return interaction.reply({ content: 'Verification is currently disabled.', ephemeral: true });
        }

        // Check if user already has verified role
        if (settings.verifiedRoleId && (interaction.member as GuildMember).roles.cache.has(settings.verifiedRoleId)) {
            return interaction.reply({ content: 'You are already verified!', ephemeral: true });
        }

        const questions = settings.questions && settings.questions.length > 0 
            ? settings.questions 
            : ['Why do you want to join?']; // Default fallback

        // Create Modal
        const modal = new ModalBuilder()
            .setCustomId('welcome_verify_modal')
            .setTitle(settings.modalTitle || 'Verification');

        // Limit to 5 questions due to Discord API limits on modal rows
        const inputs = questions.slice(0, 5).map((q, index) => {
            const input = new TextInputBuilder()
                .setCustomId(`q_${index}`)
                .setLabel(q.substring(0, 45)) // Label max length is 45
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
            
            return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
        });

        modal.addComponents(inputs);

        await interaction.showModal(modal);
    }

    private async handleModalSubmit(interaction: ModalSubmitInteraction) {
        if (interaction.customId !== 'welcome_verify_modal') return;

        await interaction.deferReply({ ephemeral: true });

        const settings = await this.db.welcomeGateSettings.findUnique({
            where: { guildId: interaction.guildId! }
        });

        if (!settings) return;

        // Validate that user answered "Yes" to all questions
        const invalidAnswer = interaction.fields.fields.some((field: any) => field.value.trim().toLowerCase() !== 'yes');
        if (invalidAnswer) {
            await interaction.editReply({ content: 'Verification failed. You must type "Yes" in all response boxes to be verified.' });
            return;
        }

        const member = interaction.member as GuildMember;

        // Perform Role Swap
        try {
            // Add Verified Role
            if (settings.verifiedRoleId) {
                await member.roles.add(settings.verifiedRoleId);
            }

            // Remove Unverified Role
            if (settings.unverifiedRoleId) {
                await member.roles.remove(settings.unverifiedRoleId);
            }

            // (Optional) Here you could log the answers to a log channel
            // const answers = interaction.fields.fields.map(f => `**${f.customId}**: ${f.value}`).join('\n');
            
            await interaction.editReply({ content: 'Verification successful! specific access has been granted.' });

        } catch (e) {
            this.logger.error('Verification role update failed', e);
            await interaction.editReply({ content: 'Something went wrong while updating your roles. Please contact an admin.' });
        }
    }

    // 3. Setup Command
    private async handleSetupCommand(interaction: ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: 'Missing Permissions', ephemeral: true });
        }

        try {
            const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel;

            const embed = new EmbedBuilder()
                .setTitle(interaction.options.getString('title') || 'Verify to gain access')
                .setDescription(interaction.options.getString('description') || 'Please read the rules and click the button below to verify yourself and gain access to the rest of the server.')
                .setColor(Colors.Green);

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('welcome_verify_btn')
                        .setLabel('Verify')
                        .setStyle(ButtonStyle.Success)
                );

            await channel.send({ embeds: [embed], components: [row] });
            
            // Update settings with the channel ID
            await this.db.welcomeGateSettings.update({
                where: { guildId: interaction.guildId! },
                data: { welcomeChannelId: channel.id }
            });

            await interaction.reply({ content: `Verification panel sent to ${channel}`, ephemeral: true });
        } catch (error: any) {
            this.logger.error('Error in setup-welcome command', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `Failed to send panel: ${error.message}. Check bot permissions in that channel.`, ephemeral: true });
            } else {
                await interaction.followUp({ content: `Failed to send panel: ${error.message}`, ephemeral: true });
            }
        }
    }

    // 4. Message Handling (Delete if unverified)
    async onMessageCreate(message: Message) {
        if (!message.guild || message.author.bot) return;

        try {
            const settings = await this.db.welcomeGateSettings.findUnique({
                where: { guildId: message.guild.id }
            });

            if (!settings || !settings.enabled || !settings.unverifiedRoleId) return;

            // Check if user has unverified role
            if (message.member?.roles.cache.has(settings.unverifiedRoleId)) {
                
                // Allow messages in the welcome channel so they can verify!
                if (settings.welcomeChannelId && message.channelId === settings.welcomeChannelId) {
                    return; 
                }

                // Delete message
                if (message.deletable) {
                    await message.delete();
                    
                    // DM User
                    try {
                        const embed = new EmbedBuilder()
                            .setTitle('Verification Required')
                            .setDescription(`Your message in **${message.guild.name}** was deleted because you are not verified yet.\nPlease go to the welcome channel and complete the verification process.`)
                            .setColor(Colors.Red);
                        
                        await message.author.send({ embeds: [embed] });
                    } catch (e) {
                         // DMs might be closed, ignore
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error in welcome gate message handler', error);
        }
    }

    // 5. Voice Handling (Disconnect if unverified)
    async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        // Only care about joins or moves (when channel is present)
        if (!newState.channelId || !newState.guild) return;

        try {
            const settings = await this.db.welcomeGateSettings.findUnique({
                where: { guildId: newState.guild.id }
            });

            if (!settings || !settings.enabled || !settings.unverifiedRoleId) return;

            // Check if user has unverified role
            if (newState.member?.roles.cache.has(settings.unverifiedRoleId)) {
                 // Disconnect
                 await newState.disconnect('User not verified');
                 
                 // DM User
                 try {
                     const embed = new EmbedBuilder()
                        .setTitle('Access Denied')
                        .setDescription(`You were disconnected from the voice channel in **${newState.guild.name}** because you are not verified.`)
                        .setColor(Colors.Red);
                    await newState.member.send({ embeds: [embed] });
                 } catch (e) {}
            }
        } catch (error) {
            this.logger.error('Error in voice gate handler', error);
        }
    }
}
