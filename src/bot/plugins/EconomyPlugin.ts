import { 
    Message, 
    MessageReaction, 
    User, 
    GuildMember, 
    Events, 
    SlashCommandBuilder, 
    PermissionsBitField, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    Interaction,
    MessageFlags,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';

interface EconomyContext extends IPluginContext {}

export class EconomyPlugin implements IPlugin {
    id = 'economy';
    name = 'Economy';
    description = 'Currency, Transactions, and Shop';
    version = '1.0.0';
    author = 'Fuji Studio';
    
    // Core properties
    events = ['messageCreate', 'messageReactionAdd', 'interactionCreate'];
    
    requiredPermissions: any[] = [
        PermissionsBitField.Flags.ManageRoles,
        PermissionsBitField.Flags.ManageNicknames
    ];

    dashboardSections = ['economy'];
    
    defaultEnabled = true;

    configSchema = z.object({});

    commands = ['wallet', 'wealth', 'market', 'buy', 'nick-optout'];

    private client: any;
    private db: any;
    private logger: any;
    private logAction: any;

    private messageCooldowns = new Map<string, number>();

    async initialize(context: EconomyContext): Promise<void> {
        this.client = context.client;
        this.db = context.db;
        this.logger = context.logger;
        this.logAction = context.logAction;
    }

    async shutdown(): Promise<void> {
        this.messageCooldowns.clear();
    }

    private async handleAutocomplete(interaction: AutocompleteInteraction) {
        if (!interaction.guildId) return;

        const focusedValue = interaction.options.getFocused();
        
        // Search items
        const items = await this.db.economyItem.findMany({
            where: {
                guildId: interaction.guildId,
                name: {
                    contains: focusedValue,
                    mode: 'insensitive'
                }
            },
            orderBy: { name: 'asc' },
            take: 25
        });

        await interaction.respond(
            items.map((item: any) => ({ 
                name: `${item.name} ($${item.price})`, 
                value: item.name 
            }))
        );
    }



    /**
     * Handle commands
     */
    async onInteractionCreate(interaction: Interaction): Promise<void> {
        if (interaction.isAutocomplete()) {
            if (interaction.commandName === 'buy') await this.handleAutocomplete(interaction);
            return;
        }

        if (interaction.isButton() && interaction.customId.startsWith('wealth_')) {
            return this.handleWealthButton(interaction);
        }

        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;
        if (commandName === 'wallet') await this.handleWallet(interaction);
        else if (commandName === 'wealth') await this.handleWealth(interaction);
        else if (commandName === 'market') await this.handleMarket(interaction);
        else if (commandName === 'buy') await this.handleBuy(interaction);
        else if (commandName === 'nick-optout') await this.handleNickOptout(interaction);
    }

    /**
     * Passive Earning
     */
    async onMessageCreate(message: Message): Promise<void> {
        if (message.author.bot || !message.guild) return;

        const settings = await this.getSettings(message.guild.id);
        const cooldown = settings.messageCooldown * 1000;
        const now = Date.now();
        const lastEarn = this.messageCooldowns.get(message.author.id) || 0;

        if (now - lastEarn < cooldown) return;
        if (message.content.length < settings.minMessageLength) return;

        // Activity Scaling: +2% per 5 levels if enabled in leveling settings
        let reward = settings.messageReward;
        try {
            const levelingSettings = await this.db.levelingSettings.findUnique({ where: { guildId: message.guild.id } });
            if (levelingSettings?.activityScalingEnabled) {
                const member = await this.db.member.findUnique({
                    where: { guildId_userId: { guildId: message.guild.id, userId: message.author.id } },
                    select: { level: true },
                });
                if (member && member.level >= 5) {
                    const bonusTiers = Math.floor(member.level / 5);
                    const scalingMultiplier = 1 + bonusTiers * 0.02;
                    reward = Math.floor(reward * scalingMultiplier);
                }
            }
        } catch { /* leveling tables may not exist */ }

        // Give reward
        await this.addBalance(message.guild.id, message.author.id, reward, 'MESSAGE', 'Message Activity Reward');
        
        this.messageCooldowns.set(message.author.id, now);
    }

    /**
     * Reaction Tipping
     */
    async onMessageReactionAdd(reaction: MessageReaction | any, user: User): Promise<void> {
        if (user.bot || !reaction.message.guild) return;

        // Fetch partials
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        const message = reaction.message as Message;
        if (message.author.id === user.id) return; // Can't tip self

        if (!message.guild) return;
        const settings = await this.getSettings(message.guild.id);
        if (!settings.allowTipping) return;

        // Check emoji
        const configEmoji = settings.currencyEmoji;
        const reactionEmojiId = reaction.emoji.id;
        const reactionEmojiName = reaction.emoji.name;

        // 1. Literal Match (Standard Emoji)
        let isMatch = reactionEmojiName === configEmoji;

        // 2. Custom Emoji ID Match (if config is <:name:id>)
        if (!isMatch && reactionEmojiId) {
             if (configEmoji.includes(reactionEmojiId)) {
                 isMatch = true;
             }
        }

        if (!isMatch) return;

        if (!message.guild) return;
        // Process tip (1 coin)
        const success = await this.transfer(message.guild.id, user.id, message.author.id, 1, 'TIP', `Tip for message ${message.id}`);
        
        if (success) {
             // Optional: React back to confirm? Or just silent. Silent is cleaner.
        } else {
             // Maybe remove reaction if failed?
             try { await reaction.users.remove(user); } catch (e) {}
        }
    }

    /**
     * Command: /wallet
     */
    private async handleWallet(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        
        try {
            await interaction.deferReply();
            
            const target = interaction.options.getUser('user') || interaction.user;
            const account = await this.getAccount(interaction.guildId, target.id);
            const settings = await this.getSettings(interaction.guildId);

            const embed = new EmbedBuilder()
                .setTitle(`${target.username}'s Wallet`)
                .setColor('#FFD700')
                .addFields(
                    { name: 'Balance', value: `${settings.currencyEmoji} ${account.balance}`, inline: true },
                    { name: 'Lifetime Earned', value: `${settings.currencyEmoji} ${account.totalEarned}`, inline: true },
                    { name: 'Rank', value: '#'+(await this.getRank(interaction.guildId, target.id)), inline: true }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (e) {
            this.logger.error('Wallet command failed', e);
            await interaction.editReply({ content: 'Failed to retrieve wallet functionality.' });
        }
    }

     /**
     * Command: /wealth (Leaderboard) — paginated
     */
     private async handleWealth(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        await interaction.deferReply();
        const page = (interaction.options.getInteger('page') || 1) - 1;
        await this.sendWealthPage(interaction, page);
    }

    private async sendWealthPage(interaction: any, page: number) {
        const guildId = interaction.guildId!;
        const perPage = 10;

        try {
            const settings = await this.getSettings(guildId);
            const total = await this.db.economyAccount.count({ where: { guildId } });
            const maxPage = Math.max(0, Math.ceil(total / perPage) - 1);
            page = Math.min(Math.max(0, page), maxPage);

            const accounts = await this.db.economyAccount.findMany({
                where: { guildId },
                orderBy: { balance: 'desc' },
                skip: page * perPage,
                take: perPage,
            });

            const lines: string[] = [];
            for (let i = 0; i < accounts.length; i++) {
                const acc = accounts[i];
                const rank = page * perPage + i + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
                lines.push(`${medal} <@${acc.userId}> — ${settings.currencyEmoji} ${acc.balance.toLocaleString()}`);
            }

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('💰 Wealth Leaderboard')
                .setDescription(lines.join('\n') || 'No rich people here yet.')
                .setFooter({ text: `Page ${page + 1}/${maxPage + 1} • ${total} accounts tracked` });

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`wealth_${page - 1}`)
                    .setLabel('◀ Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`wealth_${page + 1}`)
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= maxPage),
            );

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [embed], components: [row] });
            } else {
                await interaction.update({ embeds: [embed], components: [row] });
            }
        } catch (e) {
            this.logger.error('Wealth command failed', e);
            const msg = { content: 'Failed to retrieve leaderboard.' };
            if (interaction.replied || interaction.deferred) await interaction.editReply(msg);
            else await interaction.reply(msg);
        }
    }

    private async handleWealthButton(interaction: any) {
        const page = parseInt(interaction.customId.split('_')[1]);
        if (isNaN(page)) return;
        await this.sendWealthPage(interaction, page);
    }

    /**
     * Command: /market
     */
    private async handleMarket(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        try {
            await interaction.deferReply();

            const items = await this.db.economyItem.findMany({
                where: { guildId: interaction.guildId },
                orderBy: { price: 'asc' }
            });
            const settings = await this.getSettings(interaction.guildId);

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.guild?.name} Market`)
                .setColor('#5865F2')
                .setDescription('Use `/buy [item]` to purchase.');

            if (items.length === 0) {
                embed.setDescription('The shop is currently empty.');
            } else {
                items.forEach((item: any) => {
                    let stockStr = item.stock === null ? '∞' : item.stock;
                    embed.addFields({
                        name: `${item.name} (${settings.currencyEmoji} ${item.price})`,
                        value: `${item.description || 'No description'}\nType: ${item.type} | Stock: ${stockStr}`
                    });
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (e) {
            this.logger.error('Market command failed', e);
            await interaction.editReply({ content: 'Failed to retrieve market.' });
        }
    }

    /**
     * Command: /buy
     */
    private async handleBuy(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        
        const itemName = interaction.options.getString('item', true);
        const item = await this.db.economyItem.findUnique({
            where: { guildId_name: { guildId: interaction.guildId, name: itemName } }
        });

        if (!item) {
            return interaction.reply({ content: 'Item not found.', flags: MessageFlags.Ephemeral });
        }

        const settings = await this.getSettings(interaction.guildId);
        const account = await this.getAccount(interaction.guildId, interaction.user.id);

        // Checks
        if (account.balance < item.price) {
            return interaction.reply({ content: `You need ${settings.currencyEmoji} ${item.price - account.balance} more to buy this.`, flags: MessageFlags.Ephemeral });
        }
        if (item.stock !== null && item.stock <= 0) {
            return interaction.reply({ content: 'This item is out of stock.', flags: MessageFlags.Ephemeral });
        }

        // Process Transaction
        try {
            // Deduct
            await this.addBalance(interaction.guildId, interaction.user.id, -item.price, 'SHOP', `Bought ${item.name}`);
            
            // Reduce Stock
            if (item.stock !== null) {
                await this.db.economyItem.update({
                    where: { id: item.id },
                    data: { stock: { decrement: 1 } }
                });
            }

            // Add to Inventory
            await this.db.economyInventory.upsert({
                where: { guildId_userId_itemId: { guildId: interaction.guildId, userId: interaction.user.id, itemId: item.id } },
                update: { quantity: { increment: 1 } },
                create: { guildId: interaction.guildId, userId: interaction.user.id, itemId: item.id, quantity: 1 }
            });

            // Handle Item Effects
            if (item.type === 'ROLE') {
                const roleId = (item.metadata as any)?.roleId;
                if (roleId) {
                    const member = await interaction.guild?.members.fetch(interaction.user.id);
                    await member?.roles.add(roleId).catch(e => this.logger.error('Failed to add role', e));
                }
            }

            // Log
            await this.logAction({
                guildId: interaction.guildId,
                actionType: 'item_bought',
                executorId: interaction.user.id,
                details: { item: item.name, price: item.price }
            });

            interaction.reply({ content: `Successfully purchased **${item.name}** for ${settings.currencyEmoji} ${item.price}!` });

        } catch (e) {
            this.logger.error('Purchase failed', e);
            interaction.reply({ content: 'Transaction failed via database error.', flags: MessageFlags.Ephemeral });
        }
    }


    /**
     * Command: /nick-optout - Toggle auto-nickname opt-out
     */
    private async handleNickOptout(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        try {
            const account = await this.getAccount(interaction.guildId, interaction.user.id);
            const newValue = !account.nickOptOut;

            await this.db.economyAccount.update({
                where: { guildId_userId: { guildId: interaction.guildId, userId: interaction.user.id } },
                data: { nickOptOut: newValue },
            });

            if (newValue) {
                // Opted out — restore original nickname by removing balance suffix
                try {
                    const guild = await this.client.guilds.fetch(interaction.guildId);
                    const member = await guild.members.fetch(interaction.user.id);
                    const currentName = member.nickname || member.user.username;
                    const suffixRegex = /\s\([^\)]+\)$/;
                    if (suffixRegex.test(currentName) && member.manageable) {
                        const baseName = currentName.replace(suffixRegex, '');
                        await member.setNickname(baseName === member.user.username ? null : baseName);
                    }
                } catch { /* permission errors are fine */ }

                await interaction.reply({
                    content: '✅ You have **opted out** of automatic nickname updates. Your nickname will no longer show your balance.',
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({
                    content: '✅ You have **opted back in** to automatic nickname updates. Your balance will appear in your nickname.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (e) {
            this.logger.error('Nick-optout command failed', e);
            await interaction.reply({ content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral });
        }
    }


    // --- Helpers ---

    private async getSettings(guildId: string) {
        let settings = await this.db.economySettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await this.db.economySettings.create({
                data: { guildId }
            });
        }
        return settings;
    }

    private async getAccount(guildId: string, userId: string) {
        let account = await this.db.economyAccount.findUnique({ 
            where: { guildId_userId: { guildId, userId } }
        });
        if (!account) {
            account = await this.db.economyAccount.create({
                data: { guildId, userId }
            });
        }
        return account;
    }

    private async addBalance(guildId: string, userId: string, amount: number, type: string, reason?: string) {
        // Update Account
        const account = await this.db.economyAccount.upsert({
            where: { guildId_userId: { guildId, userId } },
            update: { 
                balance: { increment: amount },
                totalEarned: amount > 0 ? { increment: amount } : undefined 
            },
            create: { 
                guildId, userId, 
                balance: amount, 
                totalEarned: amount > 0 ? amount : 0 
            }
        });

        // Log Transaction
        await this.db.economyTransaction.create({
            data: {
                guildId,
                amount,
                type,
                reason,
                toUserId: amount > 0 ? userId : null,
                fromUserId: amount < 0 ? userId : null // If negative, user is paying
            }
        });

        // Auto-Nickname check
        if (amount !== 0) {
            this.checkAutoNickname(guildId, userId, account.balance);
        }

        return account;
    }

    private async transfer(guildId: string, fromId: string, toId: string, amount: number, type: string, reason?: string): Promise<boolean> {
        const fromAccount = await this.getAccount(guildId, fromId);
        if (fromAccount.balance < amount) return false;

        // Transactional update
        await this.db.$transaction([
            // Deduct
            this.db.economyAccount.update({
                where: { guildId_userId: { guildId, userId: fromId } },
                data: { balance: { decrement: amount } }
            }),
            // Add
            this.db.economyAccount.upsert({
                where: { guildId_userId: { guildId, userId: toId } },
                update: { 
                    balance: { increment: amount },
                    totalEarned: { increment: amount }
                },
                create: { guildId, userId: toId, balance: amount, totalEarned: amount }
            }),
            // Log
            this.db.economyTransaction.create({
                data: {
                    guildId,
                    amount,
                    type,
                    reason,
                    fromUserId: fromId,
                    toUserId: toId
                }
            })
        ]);

        return true;
    }

    private async getRank(guildId: string, userId: string): Promise<number> {
        const count = await this.db.economyAccount.count({
            where: {
                guildId,
                balance: {
                    gt: (await this.getAccount(guildId, userId)).balance
                }
            }
        });
        return count + 1;
    }

    private async checkAutoNickname(guildId: string, userId: string, balance: number) {
        try {
            const settings = await this.getSettings(guildId);
            if (!settings.autoNickname) return;

            // Respect opt-out preference
            const account = await this.db.economyAccount.findUnique({
                where: { guildId_userId: { guildId, userId } },
                select: { nickOptOut: true },
            });
            if (account?.nickOptOut) return;

            const guild = await this.client.guilds.fetch(guildId);
            const me = guild.members.me ?? await guild.members.fetchMe();
            if (!me.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
                this.logger.warn('Auto-nickname: bot lacks ManageNicknames permission');
                return;
            }

            const member = await guild.members.fetch(userId);
            if (!member.manageable) {
                this.logger.warn(`Auto-nickname: cannot manage ${member.user.username} (role hierarchy)`);
                return;
            }

            const currentName = member.nickname || member.user.displayName;
            const suffixRegex = /\s\([^\)]+\)$/; // Matches " (...)" at end

            const baseName = currentName.replace(suffixRegex, '');
            const newNick = `${baseName} (${settings.currencyEmoji}${balance.toLocaleString()})`;

            if (newNick.length > 32) return; // Discord limit
            if (member.nickname === newNick) return; // No change needed

            await member.setNickname(newNick);
            this.logger.info(`Auto-nickname: ${member.user.username} → "${newNick}"`);
        } catch (e: any) {
            this.logger.error(`Auto-nickname failed for user ${userId}: ${e.message}`);
        }
    }
}
