import { 
    Client, 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalActionRowComponentBuilder
} from 'discord.js';
import { IPlugin, IPluginContext } from '../types/plugin';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { ProfileService } from '../../services/ProfileService';

export class MusicianProfilePlugin implements IPlugin {
    readonly id = 'musician-profiles';
    readonly name = 'Musician Profiles';
    readonly version = '1.0.0';
    readonly description = 'Create, edit and share your musician profile.';
    readonly author = 'Fuji Studio';
    readonly defaultEnabled = true;

    readonly requiredPermissions = [];
    readonly commands = ['profile'];
    readonly events = ['interactionCreate'];
    readonly dashboardSections = ['musician-profiles'];

    readonly configSchema = z.object({
        enabled: z.boolean().default(true),
        publicProfiles: z.boolean().default(true)
    });

    private db!: PrismaClient;
    private profileService!: ProfileService;
    private logger: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.db = context.db;
        this.profileService = new ProfileService(this.db);
        this.logger = context.logger;
        this.logger.info('Musician Profile Plugin initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('Musician Profile Plugin shutting down');
    }

    async handleInteraction(interaction: any): Promise<void> {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'profile') {
                const subcommand = interaction.options.getSubcommand();
                
                if (subcommand === 'view') {
                    await this.handleViewProfile(interaction);
                } else if (subcommand === 'edit') {
                    await this.handleEditProfile(interaction);
                }
            }
        }

        // Handle Modal Submissions
        if (interaction.isModalSubmit() && interaction.customId === 'profile_edit_modal') {
            await this.handleModalSubmit(interaction);
        }
    }

    private async handleViewProfile(interaction: ChatInputCommandInteraction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const profile = await this.profileService.getProfile(user.id);

        if (!profile) {
            return interaction.reply({ 
                content: `${user.username} hasn't set up a profile yet! ${user.id === interaction.user.id ? 'Use `/profile edit` to start.' : ''}`, 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${profile.displayName || profile.username}'s Musician Profile`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(profile.bio || 'No bio provided.')
            .addFields(
                { name: '🎹 Primary DAW', value: profile.primaryDAW || 'Unknown', inline: true },
                { name: '📍 Location', value: profile.location || 'Unknown', inline: true },
                { name: '🤝 Collab Status', value: profile.collabStatus ? '✅ Open' : '❌ Closed', inline: true }
            )
            .setColor('#5865F2')
            .setFooter({ text: 'Powered by Fuji Studio' });

        if (profile.genres.length > 0) {
            embed.addFields({ name: '🎵 Genres', value: profile.genres.map(g => g.genre.name).join(', ') });
        }

        // Public Link
        const publicUrl = `https://fujistudio.app/profile/${user.id}`;
        embed.addFields({ name: '🔗 Public Profile', value: `[View on Web](${publicUrl})` });

        await interaction.reply({ embeds: [embed] });
    }

    private async handleEditProfile(interaction: ChatInputCommandInteraction) {
        const modal = new ModalBuilder()
            .setCustomId('profile_edit_modal')
            .setTitle('Edit Musician Profile');

        const bioInput = new TextInputBuilder()
            .setCustomId('bio')
            .setLabel("Bio / About You")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe your musical journey...')
            .setRequired(false);

        const dawInput = new TextInputBuilder()
            .setCustomId('daw')
            .setLabel("Primary DAW")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ableton, FL Studio, Logic, etc.')
            .setRequired(false);

        const locationInput = new TextInputBuilder()
            .setCustomId('location')
            .setLabel("Location")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('City, Country')
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(bioInput),
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(dawInput),
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(locationInput)
        );

        await interaction.showModal(modal);
    }

    private async handleModalSubmit(interaction: any) {
        const bio = interaction.fields.getTextInputValue('bio');
        const daw = interaction.fields.getTextInputValue('daw');
        const location = interaction.fields.getTextInputValue('location');

        await this.profileService.updateProfile(interaction.user.id, {
            username: interaction.user.username,
            bio,
            primaryDAW: daw,
            location
        });

        await interaction.reply({ content: '✅ Profile updated! Use `/profile view` to see it.', ephemeral: true });
    }

    getSlashCommandJSON() {
        return new SlashCommandBuilder()
            .setName('profile')
            .setDescription('Manage your musician profile')
            .addSubcommand(sub => sub
                .setName('view')
                .setDescription('View a musician profile')
                .addUserOption(opt => opt.setName('user').setDescription('User to view')))
            .addSubcommand(sub => sub
                .setName('edit')
                .setDescription('Quickly edit your profile bio and DAW'))
            .toJSON();
    }
}
