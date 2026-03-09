// src/bot/plugins/ProjectViewerPlugin.ts
import { IPlugin, CommandContext, PluginConfig } from '../core/PluginManager';
import { Logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { FLPParser } from '../utils/FLPParser';

/**
 * ProjectViewerPlugin: Manages SPL-style project visualizations.
 * Includes FLP parsing, metadata storage, and Discord CDN syncing.
 */
export class ProjectViewerPlugin implements IPlugin {
    readonly id = 'project-viewer';
    readonly name = 'Fuji Project Viewer';
    readonly description = 'Visualize FL Studio project structures and sync with audio renders.';
    readonly defaultEnabled = true;

    private logger = new Logger('ProjectViewer');
    private token = process.env.DISCORD_TOKEN || '';

    configSchema = {
        storageGuildId: {
            type: 'string',
            default: process.env.PROJECT_STORAGE_GUILD_ID || '1480389681676816435',
            description: 'The Discord Guild ID used for storing raw FLPs and renders.'
        }
    } as PluginConfig;

    constructor(private prisma: PrismaClient) {}

    async onEnable() {
        this.logger.info('Project Viewer initialized.');
    }

    async onDisable() {
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
        // 1. Get all threads/channels
        const threads = await this.request(`https://discord.com/api/v10/guilds/${guildId}/threads/active`);
        
        for (const thread of threads.threads) {
            // 2. Fetch recent messages
            const messages = await this.request(`https://discord.com/api/v10/channels/${thread.id}/messages`);
            
            for (const msg of messages) {
                const attachments = msg.attachments || [];
                const audioFile = attachments.find((a: any) => a.filename.endsWith('.mp3') || a.filename.endsWith('.wav'));
                const projectFile = attachments.find((a: any) => a.filename.endsWith('.flp'));

                if (audioFile && projectFile) {
                    this.logger.info(`Found project pair: ${audioFile.filename} + ${projectFile.filename}`);
                    
                    // 3. Download and parse FLP for arrangement
                    let arrangement = {};
                    try {
                        const flpBuffer = (await axios.get(projectFile.url, { responseType: 'arraybuffer' })).data;
                        arrangement = FLPParser.parse(Buffer.from(flpBuffer));
                        this.logger.info(`Parsed FLP arrangement for ${projectFile.filename}`);
                    } catch (e) {
                        this.logger.error(`Failed to parse FLP: ${projectFile.filename}`, e);
                        continue;
                    }

                    // 4. Update Database
                    const sample = await this.prisma.sampleMetadata.upsert({
                        where: { attachmentId: audioFile.id },
                        update: {
                            filename: audioFile.filename,
                            url: audioFile.url,
                            arrangement: arrangement as any, // JSON blob
                        },
                        create: {
                            attachmentId: audioFile.id,
                            filename: audioFile.filename,
                            url: audioFile.url,
                            filesize: audioFile.size,
                            mimetype: audioFile.content_type,
                            arrangement: arrangement as any,
                            packId: 'proj-storage', 
                        }
                    });

                    await this.prisma.projectFile.upsert({
                        where: { sampleId: sample.id },
                        update: { url: projectFile.url, filename: projectFile.filename },
                        create: { 
                            sampleId: sample.id, 
                            url: projectFile.url, 
                            filename: projectFile.filename 
                        }
                    });
                }
            }
        }
    }

    // Command to manually trigger an indexing of the project storage
    async getCommands() {
        return [
            {
                name: 'scanprojects',
                description: 'Sync the project storage guild with the database.',
                permissions: ['Administrator'],
                execute: async (ctx: CommandContext) => {
                    await ctx.reply('🔍 Starting project storage scan...');
                    try {
                        const guildId = this.configSchema.storageGuildId.default as string;
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
