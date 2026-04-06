import { REST, Routes, SlashCommandBuilder, ChannelType } from 'discord.js';
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
    new SlashCommandBuilder().setName('timeout').setDescription('Timeout a user').setDefaultMemberPermissions(0x10000000000).addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('Reason')).toJSON(),
    new SlashCommandBuilder().setName('warn').setDescription('Issue a warning to a user').setDefaultMemberPermissions(0x2).addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('warnings').setDescription('View warnings for a user').setDefaultMemberPermissions(0x2).addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('purge').setDescription('Delete messages').setDefaultMemberPermissions(0x2000).addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true)).toJSON(),

    // 2b. Booster Colour Roles
    new SlashCommandBuilder().setName('booster').setDescription('Pick your booster name colour').addStringOption(opt => opt.setName('role').setDescription('Colour to apply').setRequired(true).setAutocomplete(true)).toJSON(),

    // 2c. Bot Messenger
    new SlashCommandBuilder().setName('send').setDescription('Send a message as the bot').setDefaultMemberPermissions(0x20)
        .addStringOption(opt => opt.setName('message').setDescription('Message content').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send to').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addStringOption(opt => opt.setName('reply_to').setDescription('Message ID to reply to')).toJSON(),
    new SlashCommandBuilder().setName('react').setDescription('Add a reaction to a message').setDefaultMemberPermissions(0x20)
        .addStringOption(opt => opt.setName('message_id').setDescription('Message ID to react to').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('Unicode emoji or <:name:id>').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel containing the message').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)).toJSON(),

    // 3. Economy
    new SlashCommandBuilder().setName('wallet').setDescription('Check balance').addUserOption(opt => opt.setName('user').setDescription('User')).toJSON(),
    new SlashCommandBuilder().setName('wealth').setDescription('View richest users').addIntegerOption(opt => opt.setName('page').setDescription('Page number')).toJSON(),
    new SlashCommandBuilder().setName('market').setDescription('View shop').toJSON(),
    new SlashCommandBuilder().setName('buy').setDescription('Buy item').addStringOption(opt => opt.setName('item').setRequired(true).setAutocomplete(true).setDescription('Item name')).toJSON(),
    new SlashCommandBuilder().setName('nick-optout').setDescription('Toggle auto-nickname balance display on/off').toJSON(),

    // 4. Welcome Gate
    new SlashCommandBuilder()
        .setName('setup-welcome')
        .setDescription('Create the verification panel')
        .setDefaultMemberPermissions(0x10)
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send panel to (default: current)'))
        .addStringOption(opt => opt.setName('title').setDescription('Embed Title'))
        .addStringOption(opt => opt.setName('description').setDescription('Embed Description'))
        .toJSON(),

    // 5. Leveling
    new SlashCommandBuilder().setName('rank').setDescription('View your rank card').addUserOption(opt => opt.setName('user').setDescription('User to check')).toJSON(),
    new SlashCommandBuilder().setName('leaderboard').setDescription('View the server leaderboard')
        .addStringOption(opt => opt.setName('type').setDescription('Leaderboard type').addChoices({ name: 'XP', value: 'xp' }, { name: 'Voice', value: 'voice' }, { name: 'Messages', value: 'messages' }, { name: 'Power Score', value: 'power' }))
        .addIntegerOption(opt => opt.setName('page').setDescription('Page number').setMinValue(1)).toJSON(),
    new SlashCommandBuilder().setName('xp').setDescription('Manage member XP').setDefaultMemberPermissions(0x20)
        .addSubcommand(sub => sub.setName('give').setDescription('Give XP to a user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove XP from a user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
        .addSubcommand(sub => sub.setName('set').setDescription('Set a user\'s level').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).addIntegerOption(opt => opt.setName('level').setDescription('Level').setRequired(true).setMinValue(0))).toJSON(),
    new SlashCommandBuilder().setName('leveling-sync').setDescription('Sync role rewards for a member').setDefaultMemberPermissions(0x20)
        .addUserOption(opt => opt.setName('user').setDescription('User to sync'))
        .addBooleanOption(opt => opt.setName('all').setDescription('Sync ALL members')).toJSON(),
    new SlashCommandBuilder().setName('xpboost').setDescription('Purchase a temporary XP multiplier boost').toJSON(),

    // 6. Guide
    new SlashCommandBuilder().setName('guide').setDescription('Studio Guide AI assistant')
        .addSubcommand(sub => sub.setName('ask').setDescription('Ask the Studio Guide a question').addStringOption(opt => opt.setName('question').setDescription('Your question').setRequired(true)))
        .addSubcommand(sub => sub.setName('optout').setDescription('Opt out of automatic responses').addBooleanOption(opt => opt.setName('permanent').setDescription('Permanently opt out')).addIntegerOption(opt => opt.setName('minutes').setDescription('Opt out for this many minutes').setMinValue(1).setMaxValue(480)))
        .addSubcommand(sub => sub.setName('optin').setDescription('Re-enable automatic responses'))
        .addSubcommand(sub => sub.setName('pause').setDescription('Pause responses temporarily').addIntegerOption(opt => opt.setName('minutes').setDescription('Minutes to pause').setMinValue(1).setMaxValue(480)))
        .addSubcommand(sub => sub.setName('resume').setDescription('Resume automatic responses'))
        .addSubcommand(sub => sub.setName('status').setDescription('Check your current Studio Guide status')).toJSON(),

    // 7. Beat Battle
    new SlashCommandBuilder().setName('battle').setDescription('Beat Battle commands')
        .addSubcommand(sub => sub.setName('info').setDescription('View current battle info'))
        .addSubcommand(sub => sub.setName('leaderboard').setDescription('View battle leaderboard')).toJSON(),

    // 8. Musician Profile
    new SlashCommandBuilder().setName('profile').setDescription('View or edit your musician profile')
        .addSubcommand(sub => sub.setName('view').setDescription('View a profile').addUserOption(opt => opt.setName('user').setDescription('User to view')))
        .addSubcommand(sub => sub.setName('edit').setDescription('Edit your profile')).toJSON(),

    // 9. Radio
    new SlashCommandBuilder().setName('radio').setDescription('Fuji Radio controls')
        .addSubcommand(sub => sub.setName('start').setDescription('Start the radio'))
        .addSubcommand(sub => sub.setName('stop').setDescription('Stop the radio'))
        .addSubcommand(sub => sub.setName('skip').setDescription('Skip the current track'))
        .addSubcommand(sub => sub.setName('np').setDescription('See what\'s now playing'))
        .addSubcommand(sub => sub.setName('queue').setDescription('Queue a track').addStringOption(opt => opt.setName('track').setDescription('Track title to search for').setRequired(true)))
        .addSubcommand(sub => sub.setName('host').setDescription('Take over as live host')).toJSON(),
    new SlashCommandBuilder().setName('tip').setDescription('Tip the current DJ').addIntegerOption(opt => opt.setName('amount').setDescription('Amount to tip').setRequired(true).setMinValue(1)).toJSON(),
    new SlashCommandBuilder().setName('like').setDescription('Like the current track').toJSON(),
    new SlashCommandBuilder().setName('nowplaying').setDescription('See what\'s now playing on the radio').toJSON(),

    // 5. Tickets
    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage the ticket system')
        .addSubcommand(sub => 
            sub.setName('setup')
            .setDescription('Configure ticket system category')
            .addChannelOption(opt => opt.setName('category').setDescription('Category to create tickets in').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
            .addRoleOption(opt => opt.setName('initial_role').setDescription('Initial staff role (optional)').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('staff-add')
            .setDescription('Add a staff role to tickets')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('staff-remove')
            .setDescription('Remove a staff role from tickets')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('panel')
            .setDescription('Send the ticket creation panel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send panel to'))
        )
        .addSubcommand(sub =>
            sub.setName('transcript-channel')
            .setDescription('Set the channel for ticket transcripts/logs')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel for transcripts').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('close')
            .setDescription('Close the current ticket')
        )
        .addSubcommand(sub => 
            sub.setName('add')
            .setDescription('Add a user to the ticket')
            .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('remove')
            .setDescription('Remove a user from the ticket')
            .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('priority')
            .setDescription('Set the priority of the ticket')
            .addStringOption(opt => 
                opt.setName('level')
                .setDescription('Priority level')
                .setRequired(true)
                .addChoices(
                    { name: 'Low', value: 'low' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'High', value: 'high' }
                )
            )
        )
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
        // skip sentinel/fallback guild used for public pages
        if (guild.id === 'default-guild') continue;

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
