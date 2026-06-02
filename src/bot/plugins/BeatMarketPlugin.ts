import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    Interaction,
    EmbedBuilder,
    PermissionsBitField,
    Message,
} from 'discord.js';
import { z } from 'zod';
import { IPlugin, IPluginContext } from '../types/plugin';

export class BeatMarketPlugin implements IPlugin {
    id = 'beat-market';
    name = 'Beat Market';
    description = 'Weekly investment game — stake coins on trending music genres';
    version = '1.0.0';
    author = 'Fuji Studio';

    events = ['messageCreate', 'interactionCreate'];
    commands = ['market-trends', 'invest', 'portfolio', 'market-history', 'beat-market'];
    dashboardSections = ['beat-market'];
    defaultEnabled = true;
    requiredPermissions: any[] = [PermissionsBitField.Flags.SendMessages];
    configSchema = z.object({});

    private db: any;
    private client: any;
    private logger: any;

    private seasonTimer: ReturnType<typeof setInterval> | null = null;
    private hypeTimer: ReturnType<typeof setInterval> | null = null;

    // Per-guild 1-minute active season cache
    private seasonCache = new Map<string, { season: any; trends: any[]; fetchedAt: number }>();

    // In-memory keyword hype rate limiter: key = `${guildId}:${userId}:${trendId}` → count this hour
    private keywordHype = new Map<string, { count: number; hourStart: number }>();

    // Default trend cards seeded at season start
    private static readonly DEFAULT_TRENDS = [
        { name: 'Trap',  emoji: '🔥', keywords: ['trap', 'trap beat', 'trap music'] },
        { name: 'Lo-fi', emoji: '🌙', keywords: ['lofi', 'lo-fi', 'chill beat', 'lofi beat'] },
        { name: 'Drill', emoji: '⚡', keywords: ['drill', 'uk drill', 'ny drill'] },
        { name: 'R&B',   emoji: '🎹', keywords: ['rnb', 'r&b', 'soul beat', 'neo soul'] },
        { name: 'Phonk', emoji: '🌀', keywords: ['phonk', 'memphis', 'drift phonk'] },
    ];

    async initialize(context: IPluginContext): Promise<void> {
        this.db = context.db;
        this.client = context.client;
        this.logger = context.logger;

        // Check for season end/start every 10 minutes
        this.seasonTimer = setInterval(() => this.runForAllGuilds(this.checkSeasonLifecycle.bind(this)), 10 * 60 * 1000);
        setTimeout(() => this.runForAllGuilds(this.checkSeasonLifecycle.bind(this)), 20_000);

        // Accumulate hype from track activity every 30 minutes
        this.hypeTimer = setInterval(() => this.runForAllGuilds(this.accumulateHype.bind(this)), 30 * 60 * 1000);
        setTimeout(() => this.runForAllGuilds(this.accumulateHype.bind(this)), 45_000);
    }

    async shutdown(): Promise<void> {
        if (this.seasonTimer) clearInterval(this.seasonTimer);
        if (this.hypeTimer) clearInterval(this.hypeTimer);
        this.seasonCache.clear();
        this.keywordHype.clear();
    }

    // ─── Event handlers ───────────────────────────────────────────────────────

    async onMessageCreate(message: Message): Promise<void> {
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;
        const cached = await this.getCachedActiveSeason(guildId);
        if (!cached) return;

        const content = message.content.toLowerCase();
        const now = Date.now();
        const hourMs = 60 * 60 * 1000;

        for (const trend of cached.trends) {
            const matched = trend.keywords.some((kw: string) => content.includes(kw.toLowerCase()));
            if (!matched) continue;

            const key = `${guildId}:${message.author.id}:${trend.id}`;
            const entry = this.keywordHype.get(key);

            if (entry && now - entry.hourStart < hourMs) {
                if (entry.count >= 3) continue; // rate limit
                entry.count++;
            } else {
                this.keywordHype.set(key, { count: 1, hourStart: now });
            }

            await this.db.beatMarketTrend.update({
                where: { id: trend.id },
                data: { hypePoints: { increment: 1 } },
            }).catch(() => {});
        }
    }

    async onInteractionCreate(interaction: Interaction): Promise<void> {
        if (interaction.isAutocomplete()) {
            if (interaction.commandName === 'invest') await this.handleInvestAutocomplete(interaction as AutocompleteInteraction);
            return;
        }
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;
        if (commandName === 'market-trends')  await this.handleMarketTrends(interaction as ChatInputCommandInteraction);
        else if (commandName === 'invest')     await this.handleInvest(interaction as ChatInputCommandInteraction);
        else if (commandName === 'portfolio')  await this.handlePortfolio(interaction as ChatInputCommandInteraction);
        else if (commandName === 'market-history') await this.handleMarketHistory(interaction as ChatInputCommandInteraction);
        else if (commandName === 'beat-market') await this.handleBeatMarketInfo(interaction as ChatInputCommandInteraction);
    }

    // ─── Commands ─────────────────────────────────────────────────────────────

    private async handleMarketTrends(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        await interaction.deferReply({ ephemeral: true });

        try {
            const season = await this.getOrCreateActiveSeason(interaction.guildId);
            if (!season) {
                await interaction.editReply({ content: 'Beat Market is not enabled for this server.' });
                return;
            }

            const trends = await this.db.beatMarketTrend.findMany({
                where: { seasonId: season.id },
                orderBy: { hypePoints: 'desc' },
                include: {
                    investments: {
                        select: { amount: true, userId: true },
                    },
                },
            });

            const userInvestments = trends.reduce((acc: Record<string, number>, t: any) => {
                const mine = t.investments.find((inv: any) => inv.userId === interaction.user.id);
                if (mine) acc[t.id] = mine.amount;
                return acc;
            }, {} as Record<string, number>);

            const settings = await this.getSettings(interaction.guildId);
            const endsIn = this.formatCountdown(season.endsAt);

            const embed = new EmbedBuilder()
                .setTitle(`📈 Beat Market — Season #${season.number}`)
                .setColor('#10E87A')
                .setDescription(`**Season ends in:** ${endsIn}\nInvest coins on which music trend will dominate the server this week!\n​`)
                .setFooter({ text: 'Use /invest <trend> <amount> to stake your coins' });

            const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            let fieldValue = '';
            const totalPool = trends.reduce((sum: number, t: any) => sum + t.investments.reduce((s: any, inv: any) => s + inv.amount, 0), 0);

            for (let i = 0; i < trends.length; i++) {
                const t = trends[i];
                const communityCoins = t.investments.reduce((s: any, inv: any) => s + inv.amount, 0);
                const myPos = userInvestments[t.id] ? ` ✅ **You: ${settings.currencyEmoji}${userInvestments[t.id]}**` : '';
                const hypeBar = this.hypeBar(t.hypePoints, trends[0].hypePoints);
                fieldValue += `${rankEmojis[i]} ${t.emoji} **${t.name}**  ${hypeBar}  ${t.hypePoints} hype · ${settings.currencyEmoji}${communityCoins} invested${myPos}\n`;
            }

            embed.addFields({ name: `Community Pool: ${settings.currencyEmoji}${totalPool}`, value: fieldValue || 'No activity yet' });
            await interaction.editReply({ embeds: [embed] });
        } catch (e) {
            this.logger.error('market-trends failed', e);
            await interaction.editReply({ content: 'Failed to load market trends.' });
        }
    }

    private async handleInvestAutocomplete(interaction: AutocompleteInteraction) {
        if (!interaction.guildId) return;
        const season = await this.getOrCreateActiveSeason(interaction.guildId).catch(() => null);
        if (!season) { await interaction.respond([]); return; }

        const trends = await this.db.beatMarketTrend.findMany({
            where: { seasonId: season.id },
            orderBy: { position: 'asc' },
        });
        await interaction.respond(trends.map((t: any) => ({ name: `${t.emoji} ${t.name}`, value: t.id })));
    }

    private async handleInvest(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        await interaction.deferReply({ ephemeral: true });

        try {
            const trendId = interaction.options.getString('trend', true);
            const amount = interaction.options.getInteger('amount', true);
            const guildId = interaction.guildId;
            const userId = interaction.user.id;

            const settings = await this.getSettings(guildId);
            const season = await this.getOrCreateActiveSeason(guildId);
            if (!season) {
                await interaction.editReply({ content: 'Beat Market is not active.' });
                return;
            }

            // Validate trend belongs to active season
            const trend = await this.db.beatMarketTrend.findFirst({
                where: { id: trendId, seasonId: season.id },
            });
            if (!trend) {
                await interaction.editReply({ content: 'Invalid trend selected.' });
                return;
            }

            // Check min
            if (amount < settings.minInvest) {
                await interaction.editReply({ content: `Minimum investment is ${settings.currencyEmoji}${settings.minInvest}.` });
                return;
            }

            // Check existing investment in this trend
            const existing = await this.db.beatMarketInvestment.findUnique({
                where: { seasonId_trendId_userId: { seasonId: season.id, trendId, userId } },
            });
            if (existing) {
                await interaction.editReply({ content: `You've already invested in **${trend.name}** this season. Each trend can only be invested in once per season.` });
                return;
            }

            // Check balance
            const account = await this.db.economyAccount.findUnique({
                where: { guildId_userId: { guildId, userId } },
            });
            const balance = account?.balance ?? 0;

            if (balance < amount) {
                await interaction.editReply({ content: `You only have ${settings.currencyEmoji}${balance}. Not enough to invest ${settings.currencyEmoji}${amount}.` });
                return;
            }

            // Check 25% of balance cap
            const maxByPct = Math.floor(balance * (settings.maxInvestPct / 100));
            if (amount > maxByPct) {
                await interaction.editReply({ content: `You can invest at most ${settings.currencyEmoji}${maxByPct} (${settings.maxInvestPct}% of your balance) per trend.` });
                return;
            }

            // Check total season cap
            const seasonTotal = await this.db.beatMarketInvestment.aggregate({
                where: { seasonId: season.id, userId, guildId },
                _sum: { amount: true },
            });
            const alreadyInvested = seasonTotal._sum.amount ?? 0;
            if (alreadyInvested + amount > settings.maxInvestPerSeason) {
                const remaining = settings.maxInvestPerSeason - alreadyInvested;
                await interaction.editReply({ content: `You've already invested ${settings.currencyEmoji}${alreadyInvested} this season. You can invest up to ${settings.currencyEmoji}${remaining} more.` });
                return;
            }

            // Deduct coins and create investment
            await this.db.$transaction([
                this.db.economyAccount.upsert({
                    where: { guildId_userId: { guildId, userId } },
                    update: { balance: { decrement: amount } },
                    create: { guildId, userId, balance: -amount, totalEarned: 0 },
                }),
                this.db.economyTransaction.create({
                    data: { guildId, amount: -amount, type: 'INVEST', reason: `Beat Market: ${trend.name} S#${season.number}`, fromUserId: userId },
                }),
                this.db.beatMarketInvestment.create({
                    data: { seasonId: season.id, trendId, guildId, userId, amount },
                }),
            ]);

            // Show all current positions
            const allPositions = await this.db.beatMarketInvestment.findMany({
                where: { seasonId: season.id, userId, guildId },
                include: { trend: true },
            });

            const embed = new EmbedBuilder()
                .setTitle(`${settings.currencyEmoji} Investment Placed!`)
                .setColor('#10E87A')
                .setDescription(`You invested **${settings.currencyEmoji}${amount}** in **${trend.emoji} ${trend.name}**.\n​`);

            const positionLines = allPositions.map((p: any) =>
                `${p.trend.emoji} **${p.trend.name}** — ${settings.currencyEmoji}${p.amount}`
            ).join('\n');

            embed.addFields(
                { name: 'Your Season Positions', value: positionLines },
                { name: 'Payout Multipliers', value: '🥇 1.6×  🥈 1.3×  🥉 1.1×  4th 0.9×  5th 0.7×', inline: false },
            );

            await interaction.editReply({ embeds: [embed] });
            this.invalidateSeasonCache(guildId);
        } catch (e: any) {
            if (e?.code === 'P2002') {
                await interaction.editReply({ content: "You've already invested in that trend this season." });
            } else {
                this.logger.error('invest failed', e);
                await interaction.editReply({ content: 'Failed to place investment.' });
            }
        }
    }

    private async handlePortfolio(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        await interaction.deferReply({ ephemeral: true });

        try {
            const guildId = interaction.guildId;
            const userId = interaction.user.id;
            const settings = await this.getSettings(guildId);

            const activeSeason = await this.getOrCreateActiveSeason(guildId);
            const currentPositions = activeSeason ? await this.db.beatMarketInvestment.findMany({
                where: { seasonId: activeSeason.id, userId, guildId },
                include: { trend: { select: { name: true, emoji: true, hypePoints: true } } },
                orderBy: { amount: 'desc' },
            }) : [];

            // Last 3 completed seasons
            const pastSeasons = await this.db.beatMarketSeason.findMany({
                where: { guildId, status: 'completed' },
                orderBy: { number: 'desc' },
                take: 3,
                include: {
                    investments: { where: { userId }, include: { trend: { select: { name: true, emoji: true, finalRank: true } } } },
                },
            });

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${interaction.user.displayName}'s Beat Market Portfolio`)
                .setColor('#10E87A');

            if (activeSeason && currentPositions.length > 0) {
                const totalStaked = currentPositions.reduce((s: number, p: any) => s + p.amount, 0);
                const lines = currentPositions.map((p: any) =>
                    `${p.trend.emoji} **${p.trend.name}** — ${settings.currencyEmoji}${p.amount} · ${p.trend.hypePoints} hype`
                ).join('\n');
                embed.addFields({
                    name: `Season #${activeSeason.number} (Active) — ${settings.currencyEmoji}${totalStaked} staked`,
                    value: lines,
                });
            } else if (activeSeason) {
                embed.addFields({ name: `Season #${activeSeason.number} (Active)`, value: 'No investments yet. Use `/invest` to stake!' });
            }

            if (pastSeasons.length > 0) {
                let history = '';
                let netPnl = 0;
                for (const s of pastSeasons) {
                    if (s.investments.length === 0) continue;
                    const staked = s.investments.reduce((sum: number, i: any) => sum + i.amount, 0);
                    const earned = s.investments.reduce((sum: number, i: any) => sum + (i.payout ?? 0), 0);
                    const pnl = earned - staked;
                    netPnl += pnl;
                    const sign = pnl >= 0 ? '+' : '';
                    history += `S#${s.number}: staked ${settings.currencyEmoji}${staked} → ${settings.currencyEmoji}${earned} (${sign}${pnl})\n`;
                }
                if (history) {
                    embed.addFields({ name: `Past Seasons | Net P&L: ${netPnl >= 0 ? '+' : ''}${settings.currencyEmoji}${netPnl}`, value: history });
                }
            }

            if (embed.data.fields?.length === 0) {
                embed.setDescription('No investment history found. Use `/invest` to get started!');
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (e) {
            this.logger.error('portfolio failed', e);
            await interaction.editReply({ content: 'Failed to load portfolio.' });
        }
    }

    private async handleMarketHistory(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        await interaction.deferReply({ ephemeral: true });

        try {
            const guildId = interaction.guildId;
            const seasonNum = interaction.options.getInteger('season');
            const settings = await this.getSettings(guildId);

            const where: any = { guildId, status: 'completed' };
            if (seasonNum) where.number = seasonNum;

            const season = await this.db.beatMarketSeason.findFirst({
                where,
                orderBy: { number: 'desc' },
                include: {
                    trends: { orderBy: { finalRank: 'asc' } },
                    investments: true,
                },
            });

            if (!season) {
                await interaction.editReply({ content: 'No completed seasons found.' });
                return;
            }

            const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const embed = new EmbedBuilder()
                .setTitle(`📜 Beat Market — Season #${season.number} Results`)
                .setColor('#10E87A')
                .setDescription(`Settled: <t:${Math.floor(new Date(season.settledAt).getTime() / 1000)}:R>\n​`);

            for (const t of season.trends) {
                const rank = (t.finalRank ?? 5) - 1;
                const investors = season.investments.filter((i: any) => i.trendId === t.id);
                const totalStaked = investors.reduce((s: number, i: any) => s + i.amount, 0);
                const totalPayout = investors.reduce((s: number, i: any) => s + (i.payout ?? 0), 0);
                embed.addFields({
                    name: `${rankEmojis[rank]} ${t.emoji} ${t.name} (${t.hypePoints} hype · ${t.finalMultiplier}×)`,
                    value: `${investors.length} investors · ${settings.currencyEmoji}${totalStaked} staked → ${settings.currencyEmoji}${totalPayout} paid out`,
                    inline: false,
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (e) {
            this.logger.error('market-history failed', e);
            await interaction.editReply({ content: 'Failed to load season history.' });
        }
    }

    private async handleBeatMarketInfo(interaction: ChatInputCommandInteraction) {
        await interaction.reply({
            content: `**📈 Beat Market** — Learn how the investment system works:\nhttps://fujistud.io/beat-market`,
            ephemeral: false,
        });
    }

    // ─── Season lifecycle ─────────────────────────────────────────────────────

    private async runForAllGuilds(fn: (guildId: string) => Promise<void>) {
        try {
            const guilds = await this.db.guild.findMany({ select: { id: true } });
            for (const guild of guilds) {
                await fn(guild.id).catch((e: any) => this.logger.error(`BeatMarket runForAllGuilds error guild=${guild.id}`, e));
            }
        } catch (e) {
            this.logger.error('BeatMarket runForAllGuilds failed', e);
        }
    }

    private async checkSeasonLifecycle(guildId: string) {
        const settings = await this.db.beatMarketSettings.findUnique({ where: { guildId } });
        if (!settings?.enabled) return;

        // Settle any expired active seasons
        const expired = await this.db.beatMarketSeason.findFirst({
            where: { guildId, status: 'active', endsAt: { lte: new Date() } },
            include: { trends: true, investments: true },
        });

        if (expired) {
            await this.settleSeason(expired, settings);
            this.invalidateSeasonCache(guildId);
        }

        // Ensure there is an active season
        const active = await this.db.beatMarketSeason.findFirst({ where: { guildId, status: 'active' } });
        if (!active) {
            await this.createNewSeason(guildId, settings);
            this.invalidateSeasonCache(guildId);
        }
    }

    private async settleSeason(season: any, settings: any) {
        const payoutMap: number[] = [settings.payoutRank1, settings.payoutRank2, settings.payoutRank3, settings.payoutRank4, settings.payoutRank5];
        const sorted = [...season.trends].sort((a: any, b: any) => b.hypePoints - a.hypePoints);

        // Assign final ranks to trends
        for (let i = 0; i < sorted.length; i++) {
            await this.db.beatMarketTrend.update({
                where: { id: sorted[i].id },
                data: { finalRank: i + 1, finalMultiplier: payoutMap[i] ?? 0.7 },
            });
        }

        // Build payout map: trendId → multiplier
        const trendMultiplier: Record<string, number> = {};
        for (let i = 0; i < sorted.length; i++) {
            trendMultiplier[sorted[i].id] = payoutMap[i] ?? 0.7;
        }

        // Settle each investment
        const txOps: any[] = [];
        for (const inv of season.investments) {
            const mult = trendMultiplier[inv.trendId] ?? 0.7;
            const payout = Math.floor(inv.amount * mult);

            txOps.push(
                this.db.beatMarketInvestment.update({
                    where: { id: inv.id },
                    data: { payout, multiplier: mult, rank: (sorted.findIndex((t: any) => t.id === inv.trendId) + 1), settledAt: new Date() },
                }),
                this.db.economyAccount.upsert({
                    where: { guildId_userId: { guildId: season.guildId, userId: inv.userId } },
                    update: { balance: { increment: payout }, totalEarned: { increment: payout } },
                    create: { guildId: season.guildId, userId: inv.userId, balance: payout, totalEarned: payout },
                }),
                this.db.economyTransaction.create({
                    data: {
                        guildId: season.guildId, amount: payout, type: 'INVEST_PAYOUT',
                        reason: `Beat Market S#${season.number} payout (${mult}×)`,
                        toUserId: inv.userId,
                    },
                }),
            );
        }

        txOps.push(
            this.db.beatMarketSeason.update({
                where: { id: season.id },
                data: { status: 'completed', settledAt: new Date() },
            }),
        );

        await this.db.$transaction(txOps);

        // Announce results if channel configured
        await this.announceResults(season, sorted, payoutMap, settings).catch(() => {});
        this.logger.info(`BeatMarket: settled season #${season.number} for guild ${season.guildId}`);
    }

    private async createNewSeason(guildId: string, settings: any) {
        const last = await this.db.beatMarketSeason.findFirst({
            where: { guildId },
            orderBy: { number: 'desc' },
        });
        const number = (last?.number ?? 0) + 1;
        const startsAt = new Date();
        const endsAt = new Date(startsAt.getTime() + settings.seasonDurationDays * 24 * 60 * 60 * 1000);

        const season = await this.db.beatMarketSeason.create({
            data: { guildId, number, startsAt, endsAt },
        });

        for (let i = 0; i < BeatMarketPlugin.DEFAULT_TRENDS.length; i++) {
            const t = BeatMarketPlugin.DEFAULT_TRENDS[i];
            await this.db.beatMarketTrend.create({
                data: { seasonId: season.id, name: t.name, emoji: t.emoji, keywords: t.keywords, position: i + 1 },
            });
        }

        this.logger.info(`BeatMarket: created season #${number} for guild ${guildId}`);
        await this.announceNewSeason(season, BeatMarketPlugin.DEFAULT_TRENDS, settings).catch(() => {});
        return season;
    }

    private async announceNewSeason(season: any, trends: typeof BeatMarketPlugin.DEFAULT_TRENDS, settings: any) {
        if (!settings.announcementChannelId) return;

        const guild = await this.client.guilds.fetch(season.guildId).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(settings.announcementChannelId).catch(() => null);
        if (!channel || !('send' in channel)) return;

        const endsAt = Math.floor(new Date(season.endsAt).getTime() / 1000);
        const curr = settings.currencyEmoji;

        const embed = new EmbedBuilder()
            .setTitle(`📈 Beat Market — Season #${season.number} is Live!`)
            .setColor('#10E87A')
            .setDescription(
                `A new season has started! Stake your ${curr} on which music genre will dominate the server this week.\n\n` +
                `**Season ends:** <t:${endsAt}:R> (<t:${endsAt}:f>)\n​`
            );

        const trendLines = trends.map((t, i) =>
            `${t.emoji} **${t.name}** — ${t.keywords.slice(0, 2).join(', ')}`
        ).join('\n');

        embed.addFields(
            { name: 'This Week\'s Trends', value: trendLines },
            {
                name: 'Payout Multipliers',
                value: '🥇 1st: **1.6×**  🥈 2nd: **1.3×**  🥉 3rd: **1.1×**  4th: 0.9×  5th: 0.7×',
            },
            {
                name: 'How to Play',
                value:
                    '`/market-trends` — see live hype standings\n' +
                    '`/invest <trend> <amount>` — stake your coins\n' +
                    '`/portfolio` — track your positions\n' +
                    `Learn more: https://fujistud.io/beat-market`,
            },
        );

        await (channel as any).send({ embeds: [embed] });
    }

    // ─── Hype accumulation ────────────────────────────────────────────────────

    private async accumulateHype(guildId: string) {
        const settings = await this.db.beatMarketSettings.findUnique({ where: { guildId } });
        if (!settings?.enabled) return;

        const season = await this.db.beatMarketSeason.findFirst({
            where: { guildId, status: 'active' },
            include: { trends: true },
        });
        if (!season) return;

        const since = season.lastHypeAt ?? season.startsAt;
        const now = new Date();

        for (const trend of season.trends) {
            let hypeGain = 0;
            const kwLower = trend.keywords.map((k: string) => k.toLowerCase());

            // Track announcements with matching genre
            try {
                const announcements = await this.db.trackAnnouncement.findMany({
                    where: { guildId, createdAt: { gt: since }, genres: { hasSome: kwLower } },
                    select: { id: true },
                });
                hypeGain += announcements.length * 10;
            } catch { /* table may not exist */ }

            // Track plays via genre join
            try {
                const playRows = await this.db.$queryRaw`
                    SELECT COUNT(*) as cnt FROM track_plays tp
                    JOIN track_genre_map tgm ON tgm.track_id = tp.track_id
                    JOIN genres g ON g.id = tgm.genre_id
                    WHERE tp.created_at > ${since}
                      AND LOWER(g.name) = ANY(${kwLower}::text[])
                ` as any[];
                const plays = Math.min(Number(playRows[0]?.cnt ?? 0), 500);
                hypeGain += plays;
            } catch { /* skip if schema differs */ }

            // Track favourites
            try {
                const favRows = await this.db.$queryRaw`
                    SELECT COUNT(*) as cnt FROM track_favourites tf
                    JOIN track_genre_map tgm ON tgm.track_id = tf.track_id
                    JOIN genres g ON g.id = tgm.genre_id
                    WHERE tf.created_at > ${since}
                      AND LOWER(g.name) = ANY(${kwLower}::text[])
                ` as any[];
                hypeGain += Number(favRows[0]?.cnt ?? 0) * 3;
            } catch { /* skip */ }

            if (hypeGain > 0) {
                await this.db.beatMarketTrend.update({
                    where: { id: trend.id },
                    data: { hypePoints: { increment: hypeGain } },
                });
            }
        }

        await this.db.beatMarketSeason.update({
            where: { id: season.id },
            data: { lastHypeAt: now },
        });

        this.invalidateSeasonCache(guildId);
    }

    // ─── Announcement ─────────────────────────────────────────────────────────

    private async announceResults(season: any, sortedTrends: any[], payoutMap: number[], settings: any) {
        if (!settings.announcementChannelId) return;

        const guild = await this.client.guilds.fetch(season.guildId).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(settings.announcementChannelId).catch(() => null);
        if (!channel || !('send' in channel)) return;

        const curr = settings.currencyEmoji;
        const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const embed = new EmbedBuilder()
            .setTitle(`📈 Beat Market Season #${season.number} — Results!`)
            .setColor('#10E87A')
            .setDescription('The season has ended. Here are the final standings:\n​');

        for (let i = 0; i < sortedTrends.length; i++) {
            const t = sortedTrends[i];
            const investCount = season.investments.filter((inv: any) => inv.trendId === t.id).length;
            embed.addFields({
                name: `${rankEmojis[i]} ${t.emoji} ${t.name}`,
                value: `${t.hypePoints} hype · ${payoutMap[i]}× payout · ${investCount} investors`,
                inline: true,
            });
        }

        embed.addFields({ name: '​', value: 'A new season has begun! Use `/market-trends` to see the new trends.', inline: false });

        await (channel as any).send({ embeds: [embed] });
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async getOrCreateActiveSeason(guildId: string): Promise<any | null> {
        const settings = await this.db.beatMarketSettings.findUnique({ where: { guildId } });
        if (!settings) return null;

        let season = await this.db.beatMarketSeason.findFirst({ where: { guildId, status: 'active' } });
        if (!season) {
            season = await this.createNewSeason(guildId, settings);
        }
        return season;
    }

    private async getCachedActiveSeason(guildId: string): Promise<{ season: any; trends: any[] } | null> {
        const now = Date.now();
        const cached = this.seasonCache.get(guildId);
        if (cached && now - cached.fetchedAt < 60_000) return cached;

        const settings = await this.db.beatMarketSettings.findUnique({ where: { guildId } }).catch(() => null);
        if (!settings?.enabled) return null;

        const season = await this.db.beatMarketSeason.findFirst({ where: { guildId, status: 'active' } });
        if (!season) return null;

        const trends = await this.db.beatMarketTrend.findMany({ where: { seasonId: season.id } });
        const entry = { season, trends, fetchedAt: now };
        this.seasonCache.set(guildId, entry);
        return entry;
    }

    private invalidateSeasonCache(guildId: string) {
        this.seasonCache.delete(guildId);
    }

    private async getSettings(guildId: string) {
        let s = await this.db.beatMarketSettings.findUnique({ where: { guildId } });
        if (!s) s = await this.db.beatMarketSettings.create({ data: { guildId } });
        const econ = await this.db.economySettings.findUnique({ where: { guildId } });
        return { ...s, currencyEmoji: econ?.currencyEmoji ?? '🪙', currencyName: econ?.currencyName ?? 'Coins' };
    }

    private hypeBar(points: number, max: number): string {
        if (max === 0) return '░░░░░';
        const filled = Math.round((points / max) * 5);
        return '█'.repeat(filled) + '░'.repeat(5 - filled);
    }

    private formatCountdown(date: Date): string {
        const ms = new Date(date).getTime() - Date.now();
        if (ms <= 0) return 'Ending soon';
        const d = Math.floor(ms / 86400000);
        const h = Math.floor((ms % 86400000) / 3600000);
        return d > 0 ? `${d}d ${h}h` : `${h}h`;
    }

    async registerCommands(): Promise<SlashCommandBuilder[]> {
        return [
            new SlashCommandBuilder()
                .setName('market-trends')
                .setDescription('See this week\'s Beat Market trends and hype standings'),

            new SlashCommandBuilder()
                .setName('invest')
                .setDescription('Invest coins in a Beat Market trend')
                .addStringOption(o => o.setName('trend').setDescription('Which trend to invest in').setRequired(true).setAutocomplete(true))
                .addIntegerOption(o => o.setName('amount').setDescription('How many coins to invest').setRequired(true).setMinValue(1)),

            new SlashCommandBuilder()
                .setName('portfolio')
                .setDescription('View your current and past Beat Market investments'),

            new SlashCommandBuilder()
                .setName('market-history')
                .setDescription('View results from a past Beat Market season')
                .addIntegerOption(o => o.setName('season').setDescription('Season number (defaults to last)').setRequired(false)),

            new SlashCommandBuilder()
                .setName('beat-market')
                .setDescription('Get a link to learn how the Beat Market works'),
        ] as unknown as SlashCommandBuilder[];
    }
}
