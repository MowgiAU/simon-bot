import {
    Message,
    PermissionResolvable,
    EmbedBuilder,
    TextChannel,
    GuildMember,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

interface MuzzleSettings {
    enabled: boolean;
    messageLimit: number;
    windowSeconds: number;
    muzzleDurationMinutes: number;
    muzzleRoleId: string | null;
    logChannelId: string | null;
}

export class MuzzlePlugin implements IPlugin {
    id = 'muzzle';
    name = 'Muzzle';
    description = 'Automatically assigns a muzzle role to users who send messages too quickly.';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = ['ManageRoles'];
    commands: string[] = [];
    events: string[] = ['messageCreate'];
    dashboardSections = ['muzzle'];
    defaultEnabled = false;

    configSchema = z.object({});

    private context: IPluginContext | null = null;
    private logger = new Logger('MuzzlePlugin');

    // Per-guild, per-user message timestamps (sliding window)
    private tracker = new Map<string, Map<string, number[]>>();

    // Active muzzles: `guildId:userId` → timeout handle (for auto-unmuzzle)
    private activeMuzzles = new Map<string, ReturnType<typeof setTimeout>>();

    // Settings cache per guild (30-second TTL)
    private settingsCache = new Map<string, { settings: MuzzleSettings | null; expiresAt: number }>();

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.logger.info('Muzzle Plugin initialized');

        // Periodic cleanup of stale tracker entries
        setInterval(() => {
            const now = Date.now();
            for (const [guildId, users] of this.tracker) {
                for (const [userId, timestamps] of users) {
                    const fresh = timestamps.filter(t => now - t < 60_000);
                    if (fresh.length === 0) users.delete(userId);
                    else users.set(userId, fresh);
                }
                if (users.size === 0) this.tracker.delete(guildId);
            }
        }, 60_000);
    }

    async shutdown(): Promise<void> {
        for (const handle of this.activeMuzzles.values()) clearTimeout(handle);
        this.activeMuzzles.clear();
        this.tracker.clear();
        this.settingsCache.clear();
    }

    async onMessageCreate(msg: Message): Promise<void> {
        if (msg.author.bot || !msg.guild || !msg.content) return;
        if (!this.context) return;

        const settings = await this.getSettings(msg.guild.id);
        if (!settings?.enabled || !settings.muzzleRoleId) return;

        const guildId = msg.guild.id;
        const userId = msg.author.id;
        const muzzleKey = `${guildId}:${userId}`;

        // Skip users already muzzled
        const member = msg.member;
        if (!member) return;
        if (member.roles.cache.has(settings.muzzleRoleId)) return;

        // Track message timestamps in sliding window
        if (!this.tracker.has(guildId)) this.tracker.set(guildId, new Map());
        const guildTracker = this.tracker.get(guildId)!;

        const now = Date.now();
        const windowMs = settings.windowSeconds * 1000;
        const timestamps = (guildTracker.get(userId) ?? []).filter(t => now - t < windowMs);
        timestamps.push(now);
        guildTracker.set(userId, timestamps);

        if (timestamps.length < settings.messageLimit) return;

        // Threshold exceeded — apply muzzle role
        guildTracker.delete(userId); // reset counter
        await this.applyMuzzle(member, settings, muzzleKey, msg.channel as TextChannel);
    }

    private async applyMuzzle(
        member: GuildMember,
        settings: MuzzleSettings,
        muzzleKey: string,
        triggerChannel: TextChannel,
    ): Promise<void> {
        if (!settings.muzzleRoleId) return;

        try {
            await member.roles.add(settings.muzzleRoleId, 'Muzzle: sent too many messages too quickly');
            this.logger.info(`Muzzled ${member.user.tag} in guild ${member.guild.id} for ${settings.muzzleDurationMinutes}m`);
        } catch (err: any) {
            this.logger.error(`Failed to apply muzzle role: ${err.message}`);
            return;
        }

        const durationMs = settings.muzzleDurationMinutes * 60 * 1000;

        // Cancel any existing unmuzzle timer
        if (this.activeMuzzles.has(muzzleKey)) clearTimeout(this.activeMuzzles.get(muzzleKey)!);

        // Schedule auto-unmuzzle
        const handle = setTimeout(async () => {
            this.activeMuzzles.delete(muzzleKey);
            try {
                await member.roles.remove(settings.muzzleRoleId!, 'Muzzle: duration expired');
                this.logger.info(`Unmuzzled ${member.user.tag} in guild ${member.guild.id}`);
            } catch { /* member may have left */ }
        }, durationMs);
        this.activeMuzzles.set(muzzleKey, handle);

        // Log to channel if configured
        if (settings.logChannelId) {
            try {
                const logChannel = member.guild.channels.cache.get(settings.logChannelId) as TextChannel | null;
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔇 User Muzzled')
                        .setColor(0xF59E0B)
                        .addFields(
                            { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
                            { name: 'Duration', value: `${settings.muzzleDurationMinutes} minute${settings.muzzleDurationMinutes !== 1 ? 's' : ''}`, inline: true },
                            { name: 'Channel', value: `<#${triggerChannel.id}>`, inline: true },
                            { name: 'Reason', value: `Sent ${settings.messageLimit}+ messages in ${settings.windowSeconds}s` },
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
            } catch { /* log failure is non-fatal */ }
        }
    }

    private async getSettings(guildId: string): Promise<MuzzleSettings | null> {
        const cached = this.settingsCache.get(guildId);
        if (cached && Date.now() < cached.expiresAt) return cached.settings;

        try {
            const row = await this.context!.db.muzzleSettings.findUnique({ where: { guildId } });
            const settings: MuzzleSettings | null = row ? {
                enabled:               row.enabled,
                messageLimit:          row.messageLimit,
                windowSeconds:         row.windowSeconds,
                muzzleDurationMinutes: row.muzzleDurationMinutes,
                muzzleRoleId:          row.muzzleRoleId,
                logChannelId:          row.logChannelId,
            } : null;
            this.settingsCache.set(guildId, { settings, expiresAt: Date.now() + 30_000 });
            return settings;
        } catch {
            return null;
        }
    }
}
