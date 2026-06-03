import { GuildMember, PermissionResolvable, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';
import { Logger } from '../utils/logger';

const LEADING_SYMBOLS_RE = /^[^\p{L}\p{N}]+/u;

export class NicknameEnforcerPlugin implements IPlugin {
  id = 'nickname-enforcer';
  name = 'Nickname Enforcer';
  description = 'Strips leading symbols from member nicknames to prevent list-topping abuse';
  version = '1.0.0';
  author = 'Fuji Studio Team';

  requiredPermissions: PermissionResolvable[] = ['ManageNicknames'];
  commands = ['nickname-scan'];
  events = ['guildMemberAdd', 'guildMemberUpdate', 'interactionCreate'];
  dashboardSections = [];
  defaultEnabled = true;

  configSchema = z.object({
    enabled: z.boolean().default(true),
  });

  private context: IPluginContext | null = null;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('NicknameEnforcerPlugin');
  }

  async initialize(context: IPluginContext): Promise<void> {
    this.context = context;
    this.logger.info('Nickname Enforcer plugin initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Nickname Enforcer plugin shut down');
  }

  async registerCommands(): Promise<SlashCommandBuilder[]> {
    const cmd = new SlashCommandBuilder()
      .setName('nickname-scan')
      .setDescription('Scan all members and strip leading symbols from nicknames')
      .setDefaultMemberPermissions('8'); // Administrator
    return [cmd as SlashCommandBuilder];
  }

  async onGuildMemberAdd(member: GuildMember): Promise<void> {
    await this.enforce(member);
  }

  async onGuildMemberUpdate(_old: GuildMember, newMember: GuildMember): Promise<void> {
    await this.enforce(newMember);
  }

  async onInteractionCreate(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'nickname-scan') return;
    if (!interaction.guild) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let fixed = 0;
    let skipped = 0;
    let failed = 0;

    const members = await interaction.guild.members.fetch();

    for (const [, member] of members) {
      if (member.user.bot) continue;
      const displayName = member.nickname ?? member.user.username;
      if (!LEADING_SYMBOLS_RE.test(displayName)) continue;

      const cleaned = displayName.replace(LEADING_SYMBOLS_RE, '');
      if (!cleaned) { skipped++; continue; }

      if (!this.canRename(member)) { skipped++; continue; }

      try {
        await member.setNickname(cleaned, 'Nickname scan: leading symbols removed');
        fixed++;
        this.logger.info(`[scan] Renamed "${displayName}" → "${cleaned}" (${member.user.username})`);
      } catch {
        failed++;
      }
    }

    await interaction.editReply(
      `Scan complete — **${fixed}** fixed, **${skipped}** skipped (owner / higher role / empty result), **${failed}** failed.`
    );
  }

  private async enforce(member: GuildMember): Promise<void> {
    if (!this.context || member.user.bot) return;

    const displayName = member.nickname ?? member.user.username;
    if (!LEADING_SYMBOLS_RE.test(displayName)) return;

    const cleaned = displayName.replace(LEADING_SYMBOLS_RE, '');
    if (!cleaned) return;
    if (!this.canRename(member)) return;

    try {
      await member.setNickname(cleaned, 'Leading symbols removed');
      this.logger.info(`Renamed "${displayName}" → "${cleaned}" (${member.user.username})`);
    } catch (err) {
      this.logger.error(`Failed to rename ${member.user.username}`, err);
    }
  }

  private canRename(member: GuildMember): boolean {
    if (member.id === member.guild.ownerId) return false;
    const bot = member.guild.members.me;
    if (bot && member.roles.highest.position >= bot.roles.highest.position) return false;
    return true;
  }
}

export default new NicknameEnforcerPlugin();
