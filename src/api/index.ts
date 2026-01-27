import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../bot/utils/logger';

dotenv.config();

const app = express();
const logger = new Logger('API');
const db = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Helper to get guildId from request (for now, default to first guild)
const getGuildId = async () => {
  const guild = await db.guild.findFirst();
  return guild?.id || 'default-guild';
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Word Filter Plugin Settings Routes
app.get('/api/word-filter/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Simply fetch - the bot has already created these on startup
    const settings = await db.filterSettings.findUnique({
      where: { guildId },
      include: {
        wordGroups: {
          include: {
            words: true,
          },
        },
      },
    });

    if (!settings) {
      return res.status(404).json({ error: 'Settings not found. Bot may not be initialized.' });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Failed to get word filter settings', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

app.post('/api/word-filter/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { enabled, repostEnabled, excludedChannels, excludedRoles } = req.body;

    const settings = await db.filterSettings.update({
      where: { guildId },
      data: {
        enabled,
        repostEnabled,
        excludedChannels: excludedChannels || [],
        excludedRoles: excludedRoles || [],
      },
      include: {
        wordGroups: {
          include: {
            words: true,
          },
        },
      },
    });

    res.json(settings);
  } catch (error) {
    logger.error('Failed to update word filter settings', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Word Group Routes
app.post('/api/word-filter/groups/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { name, replacementText, replacementEmoji, useEmoji } = req.body;

    // Settings should already exist from bot initialization
    const group = await db.wordGroup.create({
      data: {
        guildId,
        name,
        replacementText: useEmoji ? undefined : replacementText,
        replacementEmoji: useEmoji ? replacementEmoji : undefined,
        useEmoji,
      },
      include: {
        words: true,
      },
    });

    res.json(group);
  } catch (error) {
    logger.error('Failed to create word group', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

app.put('/api/word-filter/groups/:guildId/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, replacementText, replacementEmoji, useEmoji } = req.body;

    const group = await db.wordGroup.update({
      where: { id: groupId },
      data: {
        name,
        replacementText: useEmoji ? undefined : replacementText,
        replacementEmoji: useEmoji ? replacementEmoji : undefined,
        useEmoji,
      },
      include: {
        words: true,
      },
    });

    res.json(group);
  } catch (error) {
    logger.error('Failed to update word group', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

app.delete('/api/word-filter/groups/:guildId/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;

    await db.wordGroup.delete({
      where: { id: groupId },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete word group', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Word Routes
app.post('/api/word-filter/groups/:guildId/:groupId/words', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { word } = req.body;

    const filterWord = await db.filterWord.create({
      data: {
        groupId,
        word: word.toLowerCase(),
      },
    });

    res.json(filterWord);
  } catch (error) {
    logger.error('Failed to add word', error);
    res.status(500).json({ error: 'Failed to add word' });
  }
});

app.delete('/api/word-filter/groups/:guildId/:groupId/words/:wordId', async (req, res) => {
  try {
    const { wordId } = req.params;

    await db.filterWord.delete({
      where: { id: wordId },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete word', error);
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

// Plugin settings routes (generic)
app.get('/api/plugins/:pluginId/settings', (req, res) => {
  res.json({ message: 'Get plugin settings' });
});

app.post('/api/plugins/:pluginId/settings', (req, res) => {
  res.json({ message: 'Update plugin settings' });
});

// Dashboard data routes
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const guilds = await db.guild.count();
    const members = await db.member.count();
    
    res.json({
      guilds,
      members,
      plugins: 1, // Word Filter
    });
  } catch (error) {
    res.json({
      guilds: 0,
      members: 0,
      plugins: 0,
    });
  }
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API error', err);
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`);
});
