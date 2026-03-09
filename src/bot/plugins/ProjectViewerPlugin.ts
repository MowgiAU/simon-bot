// src/bot/plugins/ProjectViewerPlugin.ts
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { PermissionResolvable } from 'discord.js';
import { z } from 'zod';
import axios from 'axios';
import { FLPParser } from '../utils/FLPParser';

/**
 * ProjectViewerPlugin: Manages SPL-style project visualizations.
 * Includes FLP parsing, metadata storage, and Discord CDN syncing.
 */
export class ProjectViewerPlugin implements IPlugin {
    readonly id = 'project-viewer';
    readonly name = 'Fuji Project Viewer';
    readonly description = 'Visualize FL Studio project structures and sync with audio renders.';
    readonly version = '1.0.0';
    readonly author = 'Fuji Studio Team';
    readonly defaultEnabled = true;

    requiredPermissions: PermissionResolvable[] = ['Administrator'];
    commands = ['scanprojects'];
    events = [];
    dashboardSections = ['project-viewer'];

    private logger = new Logger('ProjectViewer');
    private token = process.env.DISCORD_TOKEN || '';
    private context: IPluginContext | null = null;

    configSchema = z.object({
        storageGuildId: z.string().default(process.env.PROJECT_STORAGE_GUILD_ID || '1480389681676816435'),
    });

    constructor(private prisma: PrismaClient) {}

    async initialize(context: IPluginContext) {
        this.context = context;
        this.logger.info('Project Viewer initialized.');
    }

    async shutdown() {
        this.logger.info('Project Viewer disabled.');
    }

    // Helper for Discord API
    private async request(url: string) {
        return (await axios.get(url, { headers: { Authorization: `Bot ${this.token}` } })).data;
    }

    /**
     * Scan the project storage guild.
     * Logic:
     * 1. Look for messages containing BOTH an .flp and an .mp3/.wav in the same thread.
     * 2. Index the audio as SampleMetadata.
     * 3. Index the .flp as ProjectFile.
     * 4. Parse the .flp for the 'arrangement' JSON blob.
     */
    private async scanProjectGuild(guildId: string) {
        this.logger.info(`Scanning project storage guild: ${guildId}`);

        // 0. Ensure a SamplePack row exists for the project storage guild (required by FK constraint)
        const storagePack = await this.prisma.samplePack.upsert({
            where: { channelId: `proj-storage-${guildId}` },
            update: {},
            create: {
                guildId,
                channelId: `proj-storage-${guildId}`,
                name: 'Project Storage',
                description: 'Auto-indexed FL Studio projects from the project storage guild.'
            }
        });

        // 1. Get all active threads in the guild
        const threads = await this.request(`https://discord.com/api/v10/guilds/${guildId}/threads/active`);
        
        if (!threads?.threads?.length) {
            this.logger.warn(`No active threads found in guild ${guildId}`);
            return;
        }

        for (const thread of threads.threads) {
            // 2. Fetch recent messages (up to 100)
            const messages = await this.request(
                `https://discord.com/api/v10/channels/${thread.id}/messages?limit=100`
            );
            
            for (const msg of messages) {
                const attachments: any[] = msg.attachments || [];
                const audioFile = attachments.find((a) =>
                    a.filename.endsWith('.mp3') || a.filename.endsWith('.wav') || a.filename.endsWith('.ogg')
                );
                const projectFile = attachments.find((a) => a.filename.endsWith('.flp'));

                if (!audioFile || !projectFile) continue;

                this.logger.info(`Found project pair: ${audioFile.filename} + ${projectFile.filename}`);
                
                // 3. Download and parse FLP for arrangement
                let arrangement = {};
                try {
                    const flpBuffer = (await axios.get(projectFile.url, { responseType: 'arraybuffer' })).data;
                    arrangement = FLPParser.parse(Buffer.from(flpBuffer));
                    this.logger.info(`Parsed arrangement for ${projectFile.filename}: ${JSON.stringify(arrangement).slice(0, 100)}`);
                } catch (e) {
                    this.logger.error(`Failed to parse FLP: ${projectFile.filename}`, e);
                    // Still index the audio file without arrangement
                }

                // 4. Upsert the audio render into SampleMetadata
                // Using `db` cast to bypass stale local Prisma types —
                // the arrangement and projectFile fields exist in schema.prisma and will
                // be available after `prisma db push && prisma generate` runs on the server.
                const db = this.prisma as any;
                const sample = await db.sampleMetadata.upsert({
                    where: { attachmentId: audioFile.id },
                    update: {
                        filename: audioFile.filename,
                        url: audioFile.url,
                        arrangement,
                    },
                    create: {
                        attachmentId: audioFile.id,
                        filename: audioFile.filename,
                        url: audioFile.url,
                        filesize: audioFile.size || 0,
                        mimetype: audioFile.content_type || 'audio/mpeg',
                        arrangement,
                        packId: storagePack.id,
                    }
                });

                // 5. Upsert the FLP file into ProjectFile (all required schema fields included)
                await db.projectFile.upsert({
                    where: { sampleId: sample.id },
                    update: {
                        url: projectFile.url,
                        filename: projectFile.filename,
                        filesize: projectFile.size || 0,
                        mimetype: projectFile.content_type || 'application/octet-stream',
                    },
                    create: { 
                        sampleId: sample.id, 
                        url: projectFile.url, 
                        filename: projectFile.filename,
                        filesize: projectFile.size || 0,
                        mimetype: projectFile.content_type || 'application/octet-stream',
                    }
                });

                // Rate limit guard between messages
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    // For now, let's keep it simple for registration
    async getCommands() {
        return [
            {
                name: 'scanprojects',
                description: 'Sync the project storage guild with the database.',
                permissions: ['Administrator'],
                execute: async (ctx: any) => {
                    await ctx.reply('🔍 Starting project storage scan...');
                    try {
                        const guildId = process.env.PROJECT_STORAGE_GUILD_ID || '1480389681676816435';
                        await this.scanProjectGuild(guildId);
                        await ctx.followUp('✅ Project scan complete.');
                    } catch (e: any) {
                        this.logger.error('Scan failed', e);
                        await ctx.followUp(`❌ Scan failed: ${e.message}`);
                    }
                }
            }
        ];
    }
}
