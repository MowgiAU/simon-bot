import { Message, TextChannel, PermissionResolvable, EmbedBuilder } from 'discord.js';
import { z } from 'zod';
import OpenAI from 'openai';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

// Default keywords that indicate potential piracy discussion
const DEFAULT_KEYWORDS = [
  'crack', 'cracked', 'cracking',
  'keygen', 'key-gen', 'keygenme',
  'torrent', 'torrenting',
  'pirate', 'pirated', 'pirating', 'piracy',
  'warez',
  'r2r', 'r2r team',
  'nulled',
  'getintopc',
  'filecr',
  'audioz',
  'vstcrack',
  'vstorrent',
  'rutracker',
  '4download',
  'free download fl studio',
  'free download serum',
  'free download omnisphere',
  'free vst crack',
  'unlock full version',
  'bypass activation',
  'license bypass',
  'serial key',
  'activation patch',
  'mega link',
  'gdrive link pirate',
];

interface AIClassification {
  verdict: 'SAFE' | 'VIOLATION';
  confidence: number;
  reason: string;
}

export class AntiPiracyPlugin implements IPlugin {
  id = 'anti-piracy';
  name = 'Anti-Piracy';
  description = 'Detects and moderates software piracy discussion, especially for FL Studio and music production tools';
  version = '1.0.0';
  author = 'Fuji Studio Team';

  requiredPermissions: PermissionResolvable[] = ['ManageMessages', 'SendMessages'];
  commands: string[] = [];
  events = ['messageCreate'];
  dashboardSections = ['anti-piracy-settings'];
  defaultEnabled = true;

  configSchema = z.object({
    enabled: z.boolean().default(true),
    aiEnabled: z.boolean().default(true),
    actionType: z.enum(['warn', 'delete', 'delete_and_warn']).default('delete_and_warn'),
    excludedChannels: z.array(z.string()).default([]),
    excludedRoles: z.array(z.string()).default([]),
  });

  private context: IPluginContext | null = null;
  private logger: Logger;
  private openai: OpenAI | null = null;

  constructor() {
    this.logger = new Logger('AntiPiracyPlugin');
  }

  async initialize(context: IPluginContext): Promise<void> {
    this.context = context;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.info('Anti-Piracy plugin initialized with AI detection');
    } else {
      this.logger.info('Anti-Piracy plugin initialized (keyword-only mode, no OpenAI key)');
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Anti-Piracy plugin shut down');
  }

  async onMessage(message: Message): Promise<void> {
    if (!this.context || message.author.bot) return;
    if (!message.guild) return;

    // Load settings
    let settings = await this.getSettings(message.guild.id, message.guild.name);
    if (!settings || !settings.enabled) return;
    if (this.isExcluded(message, settings)) return;

    const content = message.content.toLowerCase();
    if (content.length < 5) return;

    // Step 1: Keyword pre-filter (FREE)
    const allKeywords = [...DEFAULT_KEYWORDS, ...settings.customKeywords.map((k: string) => k.toLowerCase())];
    const matchedKeywords = allKeywords.filter(kw => content.includes(kw.toLowerCase()));

    if (matchedKeywords.length === 0) return;

    // Step 2: AI classification (CHEAP, only when keywords match)
    let classification: AIClassification;

    if (settings.aiEnabled && this.openai) {
      try {
        classification = await this.classifyWithAI(message.content);
      } catch (err) {
        this.logger.error('AI classification failed, falling back to keyword-only', err);
        // Fallback: if multiple strong keywords, treat as violation
        classification = this.keywordFallback(matchedKeywords);
      }
    } else {
      classification = this.keywordFallback(matchedKeywords);
    }

    if (classification.verdict === 'SAFE') {
      this.logger.info(`Anti-piracy: SAFE message from ${message.author.username} (${classification.reason})`);
      return;
    }

    // VIOLATION detected — take action
    this.logger.info(`Anti-piracy VIOLATION from ${message.author.username}: ${classification.reason}`);
    await this.takeAction(message, settings, classification, matchedKeywords);
  }

  private async getSettings(guildId: string, guildName: string) {
    if (!this.context) return null;

    let settings = await this.context.db.antiPiracySettings.findUnique({
      where: { guildId },
    });

    if (!settings) {
      try {
        await this.context.db.guild.upsert({
          where: { id: guildId },
          update: {},
          create: { id: guildId, name: guildName },
        });
        settings = await this.context.db.antiPiracySettings.create({
          data: {
            guildId,
            enabled: true,
            aiEnabled: true,
            actionType: 'delete_and_warn',
            reminderMessage: 'Piracy discussion is not allowed in this server. Please support developers by purchasing software legally.',
            excludedChannels: [],
            excludedRoles: [],
            customKeywords: [],
          },
        });
        this.logger.info(`Created anti-piracy settings for guild ${guildName}`);
      } catch (error) {
        this.logger.error('Failed to create anti-piracy settings', error);
        return null;
      }
    }

    return settings;
  }

  private isExcluded(message: Message, settings: any): boolean {
    if (settings.excludedChannels.includes(message.channelId)) return true;
    if (message.member) {
      return settings.excludedRoles.some((roleId: string) =>
        message.member?.roles.cache.has(roleId)
      );
    }
    return false;
  }

  private async classifyWithAI(messageContent: string): Promise<AIClassification> {
    if (!this.openai) throw new Error('OpenAI not configured');

    const systemPrompt = `You are a content moderation AI for a music production Discord server (FL Studio / DAW community).

Your job: Classify whether a message is ADVOCATING or FACILITATING software piracy.

SAFE messages (verdict: "SAFE"):
- Discussing piracy as a topic (news, ethics debates, history)
- Condemning or discouraging piracy
- Asking about legitimate pricing, sales, or free alternatives
- Mentioning piracy keywords in an unrelated or negative context
- Talking about anti-piracy measures

VIOLATION messages (verdict: "VIOLATION"):
- Asking where/how to download cracked software
- Sharing links to pirated content
- Instructing others how to crack, patch, or bypass software licensing
- Recommending specific piracy sites or tools
- Celebrating or encouraging pirating DAWs, plugins, or sample packs

Respond ONLY with a JSON object: {"verdict": "SAFE" or "VIOLATION", "confidence": 0.0-1.0, "reason": "brief explanation"}`;

    const completion = await this.openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Message: "${messageContent}"` },
      ],
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) throw new Error('Empty AI response');

    const result = JSON.parse(raw);
    return {
      verdict: result.verdict === 'VIOLATION' ? 'VIOLATION' : 'SAFE',
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
      reason: typeof result.reason === 'string' ? result.reason : 'AI classification',
    };
  }

  private keywordFallback(matchedKeywords: string[]): AIClassification {
    // Without AI, use heuristic: 2+ strong keywords = violation
    const strongKeywords = ['crack', 'cracked', 'keygen', 'torrent', 'warez', 'r2r', 'nulled',
      'vstcrack', 'vstorrent', 'audioz', 'rutracker', 'filecr', 'getintopc', 'bypass activation',
      'license bypass', 'activation patch'];
    const strongMatches = matchedKeywords.filter(kw => strongKeywords.includes(kw));

    if (strongMatches.length >= 2) {
      return { verdict: 'VIOLATION', confidence: 0.7, reason: `Multiple piracy keywords detected: ${strongMatches.join(', ')}` };
    }
    if (strongMatches.length === 1) {
      return { verdict: 'VIOLATION', confidence: 0.5, reason: `Piracy keyword detected: ${strongMatches[0]}` };
    }
    // Weak match only - let it pass
    return { verdict: 'SAFE', confidence: 0.3, reason: 'Weak keyword match only' };
  }

  private async takeAction(
    message: Message,
    settings: any,
    classification: AIClassification,
    matchedKeywords: string[]
  ): Promise<void> {
    if (!this.context) return;
    const channel = message.channel as TextChannel;

    try {
      // Delete message if configured
      if ((settings.actionType === 'delete' || settings.actionType === 'delete_and_warn') && message.deletable) {
        await message.delete();
      }

      // Send warning/reminder if configured
      if (settings.actionType === 'warn' || settings.actionType === 'delete_and_warn') {
        const embed = new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle('⚠️ Anti-Piracy Notice')
          .setDescription(settings.reminderMessage)
          .setFooter({ text: 'Fuji Studio Anti-Piracy' })
          .setTimestamp();

        const warning = await channel.send({ embeds: [embed] });

        // Auto-delete warning after 15 seconds to keep chat clean
        setTimeout(() => {
          warning.delete().catch(() => {});
        }, 15000);
      }

      // Log action
      const searchText = [
        message.author.username,
        message.author.id,
        message.content,
        channel.name,
        matchedKeywords.join(' '),
        classification.reason,
      ].join(' ').toLowerCase();

      await this.context.db.actionLog.create({
        data: {
          guildId: message.guild!.id,
          pluginId: this.id,
          action: 'piracy_detected',
          executorId: message.author.id,
          targetId: message.channelId,
          searchableText: searchText,
          details: {
            channelName: channel.name || 'unknown',
            matchedKeywords,
            originalContent: message.content,
            authorTag: message.author.tag,
            aiVerdict: classification.verdict,
            aiConfidence: classification.confidence,
            aiReason: classification.reason,
            actionTaken: settings.actionType,
          },
        },
      });

    } catch (error) {
      this.logger.error('Failed to take anti-piracy action', error);
    }
  }
}
