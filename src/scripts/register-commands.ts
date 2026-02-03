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
    // 1. Logger
    new SlashCommandBuilder()
        .setName('logger')
        .setDescription('Logger plugin commands')
        .addSubcommand(sub => 
            sub.setName('import').setDescription('Import historical logs').addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true)).addStringOption(opt => opt.setName('category').setDescription('Category').setRequired(true).addChoices({ name: 'Moderation', value: 'MOD' }, { name: 'AutoMod', value: 'AUTOMOD' }, { name: 'Roles', value: 'ROLE' }, { name: 'Profanity', value: 'PROFANITY' }, { name: 'Piracy', value: 'PIRACY' }, { name: 'Links', value: 'LINK' })))
        .addSubcommand(sub => sub.setName('clear').setDescription('⚠️ Clear ALL logs of a specific category').addStringOption(opt => opt.setName('category').setDescription('Category').setRequired(true).addChoices({ name: 'Moderation', value: 'MOD' }, { name: 'AutoMod', value: 'AUTOMOD' }, { name: 'Roles', value: 'ROLE' }, { name: 'Profanity', value: 'PROFANITY' }, { name: 'Piracy', value: 'PIRACY' }, { name: 'Links', value: 'LINK' }))).toJSON(),

    // 2. Moderation
    new SlashCommandBuilder().setName('kick').setDescription('Kick a user').setDefaultMemberPermissions(0x2).addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('Reason')).toJSON(),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a user').setDefaultMemberPermissions(0x4).addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).addStringOption(opt => opt.setName('duration').setDescription('Duration')).addStringOption(opt => opt.setName('reason').setDescription('Reason')).toJSON(),
    new SlashCommandBuilder().setName('timeout').setDescription('Timeout a user').setDefaultMemberPermissions(0x10000000000).addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).addIntegerOption(opt => opt.setName('duration').setDescription('Minutes').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('Reason')).toJSON(),
    new SlashCommandBuilder().setName('purge').setDescription('Delete messages').setDefaultMemberPermissions(0x2000).addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true)).toJSON(),

    // 3. Economy
    new SlashCommandBuilder().setName('wallet').setDescription('Check balance').addUserOption(opt => opt.setName('user').setDescription('User')).toJSON(),
    new SlashCommandBuilder().setName('wealth').setDescription('View richest users').toJSON(),
    new SlashCommandBuilder().setName('market').setDescription('View shop').toJSON(),
    new SlashCommandBuilder().setName('buy').setDescription('Buy item').addStringOption(opt => opt.setName('item').setRequired(true).setAutocomplete(true).setDescription('Item name')).toJSON(),

    // 4. Welcome Gate
    new SlashCommandBuilder()
        .setName('setup-welcome')
        .setDescription('Create the verification panel')
        .setDefaultMemberPermissions(0x10) // Manage Channels
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send panel to (default: current)'))
        .addStringOption(opt => opt.setName('title').setDescription('Embed Title'))
        .addStringOption(opt => opt.setName('description').setDescription('Embed Description'))
        .toJSON()
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
