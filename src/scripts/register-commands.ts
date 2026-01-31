import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { Logger } from '../bot/utils/logger';

dotenv.config();

const logger = new Logger('CommandReg');
const db = new PrismaClient();

// Script to manually register commands
async function main() {
  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
    logger.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env');
    return;
  }

  const commands = [
    new SlashCommandBuilder()
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
        )
        .addSubcommand(sub =>
            sub
                .setName('clear')
                .setDescription('⚠️ Clear ALL logs of a specific category for this server')
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('The category to CLEAR (MOD, AUTOMOD...)')
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
        ).toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    logger.info('Started refreshing application (/) commands.');

    // 1. Get all guilds from DB to register for
    // (Alternatively, we could register global commands: Routes.applicationCommands(clientId))
    const guilds = await db.guild.findMany();
    
    if (guilds.length === 0) {
        logger.warn('No guilds found in database. Is the bot running and synced?');
    }

    // Register for each guild
    for (const guild of guilds) {
        // simple snowflake validation (must be numeric)
        if (!/^\d+$/.test(guild.id)) {
            logger.warn(`Skipping invalid guild ID: ${guild.name} (${guild.id})`);
            continue;
        }
    
        logger.info(`Registering for guild: ${guild.name} (${guild.id})`);
        try {
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guild.id),
                { body: commands },
            );
        } catch (e) {
            logger.warn(`Failed to register for guild ${guild.name} (${guild.id})`, e);
        }
    }
    
    // REMOVE Global Commands to prevent duplicates
    logger.info('Removing Global Commands (to prevent duplicates)...');
    await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: [] },
    );

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error('Failed to register commands', error);
  } finally {
      await db.$disconnect();
  }
}

main();
