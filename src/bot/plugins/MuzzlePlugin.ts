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
    exemptRoleIds: string[];
}

export class MuzzlePlugin implements IPlugin {
    id = 'muzzle';
    name = 'Muzzle';
    description = 'Automatically assigns a muzzle role to users who send messages too quickly.';
    version = '1.0.0';
    author = 'Fuji Studio Team';

    requiredPermissions: PermissionResolvable[] = ['ManageRoles', 'ModerateMembers'];
    commands: string[] = [];
    events: string[] = ['messageCreate'];
    dashboardSections = ['muzzle'];
    defaultEnabled = true;

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
        if (!settings?.enabled) return;

        const guildId = msg.guild.id;
        const userId = msg.author.id;
        const muzzleKey = `${guildId}:${userId}`;

        // Skip users already muzzled — active timeout is the source of truth
        // (the role is an optional marker), so check that first.
        const member = msg.member;
        if (!member) return;
        if (member.isCommunicationDisabled()) return;
        if (settings.muzzleRoleId && member.roles.cache.has(settings.muzzleRoleId)) return;

        // Skip exempt roles
        if (settings.exemptRoleIds.length > 0 && settings.exemptRoleIds.some(id => member.roles.cache.has(id))) return;

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
        const durationMs = settings.muzzleDurationMinutes * 60 * 1000;
        const reason = 'Muzzle: sent too many messages too quickly';

        // Native timeout is what actually blocks the user from sending messages,
        // reacting, or speaking — it does not depend on the muzzle role having
        // Send Messages denied via channel permission overwrites.
        try {
            await member.timeout(durationMs, reason);
        } catch (err: any) {
            this.logger.error(`Failed to time out member: ${err.message}`);
            return;
        }

        // Apply the optional visible muzzle role too (best-effort — the timeout
        // above is the real enforcement, so a role failure must not abort it).
        if (settings.muzzleRoleId) {
            try {
                await member.roles.add(settings.muzzleRoleId, reason);
            } catch (err: any) {
                this.logger.warn(`Applied timeout but failed to add muzzle role: ${err.message}`);
            }
        }

        this.logger.info(`Muzzled ${member.user.tag} in guild ${member.guild.id} for ${settings.muzzleDurationMinutes}m`);

        // Cancel any existing unmuzzle timer
        if (this.activeMuzzles.has(muzzleKey)) clearTimeout(this.activeMuzzles.get(muzzleKey)!);

        // Schedule auto-unmuzzle
        const handle = setTimeout(async () => {
            this.activeMuzzles.delete(muzzleKey);
            try {
                // Discord auto-expires the timeout, but clear it explicitly in case
                // the configured duration was shortened while the muzzle was active.
                await member.timeout(null, 'Muzzle: duration expired').catch(() => {});
                if (settings.muzzleRoleId) {
                    await member.roles.remove(settings.muzzleRoleId, 'Muzzle: duration expired').catch(() => {});
                }
                this.logger.info(`Unmuzzled ${member.user.tag} in guild ${member.guild.id}`);
            } catch { /* member may have left */ }
        }, durationMs);
        this.activeMuzzles.set(muzzleKey, handle);

        // Log to dashboard audit log
        if (this.context) {
            this.context.logAction({
                guildId:    member.guild.id,
                actionType: 'MUZZLE_APPLIED',
                executorId: member.client.user?.id,
                targetId:   member.id,
                details: {
                    username:         member.user.tag,
                    durationMinutes:  settings.muzzleDurationMinutes,
                    channelId:        triggerChannel.id,
                    channelName:      triggerChannel.name,
                    messageLimit:     settings.messageLimit,
                    windowSeconds:    settings.windowSeconds,
                },
            }).catch(() => {});
        }

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
                exemptRoleIds:         (row.exemptRoleIds as string[]) ?? [],
            } : null;
            this.settingsCache.set(guildId, { settings, expiresAt: Date.now() + 30_000 });
            return settings;
        } catch {
            return null;
        }
    }
}
