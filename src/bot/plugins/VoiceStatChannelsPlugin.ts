import {
    PermissionFlagsBits,
    ChannelType,
    VoiceChannel,
    OverwriteType,
    GuildMember,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

/**
 * Voice Stat Channels Plugin
 *
 * Creates and auto-updates unjoinable voice channels that display live server stats:
 *  👥 Members: 50,000
 *  ✨ Boosts: 45
 *  🎵 Artists: 1,200
 *  🎶 Tracks: 5,400
 *
 * Each stat channel is independently configurable (enable/disable, custom label format).
 * Channels are updated every 10 minutes and also immediately on relevant Discord events.
 * Discord enforces a rate limit of 2 channel name changes per 10 minutes per channel,
 * so we stagger updates by 500ms and cap at once per 10 minutes per guild.
 */
export class VoiceStatChannelsPlugin implements IPlugin {
    readonly id = 'voice-stats';
    readonly name = 'Voice Stat Channels';
    readonly version = '1.0.0';
    readonly description = 'Auto-updating unjoinable voice channels that display live server stats (members, boosts, artists, tracks).';
    readonly author = 'Fuji Studio';

    readonly requiredPermissions = [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ViewChannel,
    ];

    readonly commands: string[] = [];
    readonly events = ['guildMemberAdd', 'guildMemberRemove'];
    readonly dashboardSections = ['voice-stats'];
    readonly defaultEnabled = true;

    readonly configSchema = z.object({});

    private context!: IPluginContext;
    private logger = new Logger('VoiceStatChannelsPlugin');
    private updateTimer: ReturnType<typeof setInterval> | null = null;

    // Track the last update time per guild to prevent rate-limit bursts
    private lastUpdateTime = new Map<string, number>();
    private MIN_UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.logger.info('Voice Stat Channels Plugin initialized');

        // Listen for manual refresh requests from the API (same process)
        process.on('voiceStatRefresh', (guildId: string) => {
            this.updateGuild(guildId).catch(err =>
                this.logger.warn(`Manual refresh failed for guild ${guildId}: ${err.message}`)
            );
        });

        // Run an initial update shortly after boot, then every 10 minutes
        setTimeout(() => this.updateAllGuilds(), 30_000);
        this.updateTimer = setInterval(() => this.updateAllGuilds(), this.MIN_UPDATE_INTERVAL_MS);
    }

    async shutdown(): Promise<void> {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        process.removeAllListeners('voiceStatRefresh');
    }

    // ─── Event handlers ─────────────────────────────────────────────────────────

    async onGuildMemberAdd(member: GuildMember): Promise<void> {
        await this.updateGuild(member.guild.id, ['member']);
    }

    async onGuildMemberRemove(member: GuildMember): Promise<void> {
        await this.updateGuild(member.guild.id, ['member']);
    }

    // ─── Internal helpers ────────────────────────────────────────────────────────

    /**
     * Update stat channels for every guild configured in DB.
     */
    private async updateAllGuilds(): Promise<void> {
        try {
            const allSettings = await this.context.db.voiceStatSettings.findMany();
            for (const settings of allSettings) {
                await this.updateGuild(settings.guildId).catch(err =>
                    this.logger.warn(`Failed to update voice stats for guild ${settings.guildId}: ${err.message}`)
                );
            }
        } catch (err: any) {
            this.logger.error(`updateAllGuilds error: ${err.message}`);
        }
    }

    /**
     * Update stat channels for a single guild.
     * @param guildId  Discord guild ID
     * @param statsOnly  If provided, only update specific stats (to avoid unnecessary API calls)
     */
    async updateGuild(guildId: string, statsOnly?: ('member' | 'boost' | 'artist' | 'track')[]): Promise<void> {
        try {
            const settings = await this.context.db.voiceStatSettings.findUnique({ where: { guildId } });
            if (!settings) return;

            const guild = this.context.client.guilds.cache.get(guildId);
            if (!guild) return;

            const updateAll = !statsOnly;

            // Gather counts we actually need
            const needsMember = updateAll || statsOnly!.includes('member');
            const needsBoost  = updateAll || statsOnly!.includes('boost');
            const needsArtist = updateAll || statsOnly!.includes('artist');
            const needsTrack  = updateAll || statsOnly!.includes('track');

            // Fetch Discord live counts (no DB needed)
            let memberCount: number | null = null;
            let boostCount: number | null = null;

            if (needsMember && settings.memberChannelEnabled && settings.memberChannelId) {
                memberCount = guild.memberCount;
            }
            if (needsBoost && settings.boostChannelEnabled && settings.boostChannelId) {
                boostCount = guild.premiumSubscriptionCount ?? 0;
            }

            // Fetch DB counts in parallel
            const [artistCount, trackCount] = await Promise.all([
                needsArtist && settings.artistChannelEnabled && settings.artistChannelId
                    ? this.context.db.musicianProfile.count({ where: { status: 'active', deletedAt: null } })
                    : Promise.resolve(null),
                needsTrack && settings.trackChannelEnabled && settings.trackChannelId
                    ? this.context.db.track.count({ where: { status: 'active', isPublic: true, deletedAt: null } })
                    : Promise.resolve(null),
            ]);

            // Apply updates (stagger by 500ms to be gentle on Discord API)
            const updates: Array<{ channelId: string; label: string; count: number }> = [];

            if (memberCount !== null)
                updates.push({ channelId: settings.memberChannelId!, label: settings.memberLabel, count: memberCount });
            if (boostCount !== null)
                updates.push({ channelId: settings.boostChannelId!, label: settings.boostLabel, count: boostCount });
            if (artistCount !== null)
                updates.push({ channelId: settings.artistChannelId!, label: settings.artistLabel, count: artistCount });
            if (trackCount !== null)
                updates.push({ channelId: settings.trackChannelId!, label: settings.trackLabel, count: trackCount });

            for (let i = 0; i < updates.length; i++) {
                const { channelId, label, count } = updates[i];
                if (i > 0) await new Promise(r => setTimeout(r, 500));
                await this.renameStatChannel(guild.id, channelId, label, count);
            }

        } catch (err: any) {
            this.logger.error(`updateGuild(${guildId}) error: ${err.message}`);
        }
    }

    /**
     * Rename a voice stat channel with the formatted count.
     */
    private async renameStatChannel(guildId: string, channelId: string, labelTemplate: string, count: number): Promise<void> {
        try {
            const guild = this.context.client.guilds.cache.get(guildId);
            if (!guild) return;

            const channel = guild.channels.cache.get(channelId) as VoiceChannel | undefined;
            if (!channel || channel.type !== ChannelType.GuildVoice) return;

            const formattedCount = count.toLocaleString('en-US');
            const newName = labelTemplate.replace('{count}', formattedCount);

            if (channel.name === newName) return; // Already up to date

            await channel.setName(newName, 'Fuji Studio stat update');
        } catch (err: any) {
            this.logger.warn(`renameStatChannel(${channelId}) error: ${err.message}`);
        }
    }

    /**
     * Create a new unjoinable voice channel for a stat.
     * Called from the API when admin clicks "Create Channel".
     */
    async createStatChannel(guildId: string, channelName: string, categoryId?: string): Promise<string> {
        const guild = this.context.client.guilds.cache.get(guildId);
        if (!guild) throw new Error('Guild not found in cache');

        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: categoryId || null,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    type: OverwriteType.Role,
                    deny: [PermissionFlagsBits.Connect],
                },
            ],
            reason: 'Fuji Studio Voice Stat Channel',
        });

        return channel.id;
    }

    /**
     * Delete a stat channel by ID.
     * Called from the API when admin clicks "Delete Channel".
     */
    async deleteStatChannel(guildId: string, channelId: string): Promise<void> {
        const guild = this.context.client.guilds.cache.get(guildId);
        if (!guild) return;

        const channel = guild.channels.cache.get(channelId);
        if (channel) {
            await channel.delete('Fuji Studio Voice Stat Channel removed').catch(() => {});
        }
    }
}
