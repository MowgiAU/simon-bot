import { Events, PermissionsBitField, TextChannel, type Message } from 'discord.js';
import { z } from 'zod';
import type { IPlugin, IPluginContext } from '../types/plugin';

// Matches a message that starts with a common bot command prefix immediately
// followed by a word char — catches !play / .skip / -queue / $np / >join / m!help /
// pls play, while sparing "!!!", "...", "- a dash", and ordinary sentences.
const PREFIX_COMMAND_RE = /^\s*([!?.$>;+~&%=|\/-][a-z0-9]|[a-z]{1,3}!\S|pls\s+\w)/i;

export class CommandGuardPlugin implements IPlugin {
    readonly id = 'command-guard';
    readonly name = 'Command Guard';
    readonly description = 'Locks channels down to Fuji-only commands — deletes other bots\' messages and typed prefix commands, with per-guild whitelists.';
    readonly version = '1.0.0';
    readonly author = 'Fuji Studio';
    readonly requiredPermissions = [PermissionsBitField.Flags.ManageMessages];
    readonly commands: string[] = [];
    readonly events = ['messageCreate'];
    readonly dashboardSections = ['command-guard'];
    readonly defaultEnabled = true;
    readonly configSchema = z.object({});

    private context!: IPluginContext;
    private db: any;
    private logger: any;
    private client: any;

    async initialize(context: IPluginContext): Promise<void> {
        this.context = context;
        this.db = context.db;
        this.logger = context.logger;
        this.client = context.client;

        // Attached directly on the client (not the shared dispatcher) since we
        // need to see *other bots'* messages — the dispatcher drops all
        // bot-authored messages before plugins ever see them.
        this.client.on(Events.MessageCreate, (msg: Message) => { void this.onMessageCreate(msg); });

        this.logger.info('[CommandGuard] Plugin initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('[CommandGuard] Plugin shut down');
    }

    private async getSettings(guildId: string) {
        let settings = await this.db.commandGuardSettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await this.db.commandGuardSettings.create({ data: { guildId } });
        }
        return settings;
    }

    async onMessageCreate(message: Message): Promise<void> {
        try {
            if (!message.guild || message.system) return;
            if (message.author.id === this.client?.user?.id) return;

            const settings = await this.getSettings(message.guild.id);
            if (!settings.enabled || !settings.guardedChannelIds.includes(message.channelId)) return;

            const isOtherBot = message.author.bot;
            if (isOtherBot && settings.whitelistedBotIds.includes(message.author.id)) return;

            const content = message.content || '';
            const looksLikeCommand = !isOtherBot && PREFIX_COMMAND_RE.test(content);
            if (!isOtherBot && !looksLikeCommand) return;

            const whitelistedPrefix = settings.whitelistedCommandPrefixes.some((p: string) =>
                p && content.toLowerCase().startsWith(p.toLowerCase()),
            );
            if (whitelistedPrefix) return;

            if (settings.deleteMessage) {
                await message.delete().catch(() => {});
            }

            if (settings.warnUser && looksLikeCommand && 'send' in message.channel) {
                (message.channel as TextChannel)
                    .send({ content: `<@${message.author.id}> This channel doesn't allow other bot commands — please use bot commands elsewhere.`, allowedMentions: { users: [message.author.id] } })
                    .then((m: any) => setTimeout(() => m.delete().catch(() => {}), 6000))
                    .catch(() => {});
            }

            if (settings.logChannelId) {
                try {
                    const logChannel = await message.guild.channels.fetch(settings.logChannelId);
                    if (logChannel?.isTextBased()) {
                        await (logChannel as TextChannel).send({
                            content: `🛡️ **Command Guard** blocked ${isOtherBot ? 'a bot message' : 'a command'} from <@${message.author.id}> (\`${message.author.tag}\`) in <#${message.channelId}>${content ? `:\n> ${content.slice(0, 300)}` : ''}`,
                            allowedMentions: { parse: [] },
                        });
                    }
                } catch (e: any) {
                    this.logger.warn(`[CommandGuard] failed to log: ${e.message}`);
                }
            }
        } catch (err) {
            this.logger?.warn?.(`[CommandGuard] guard error: ${err}`);
        }
    }
}
