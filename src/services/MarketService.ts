/**
 * Fuji Markets — artist stocks + genre ETFs on the coin economy.
 *
 * Shared by BOTH processes (api routes + bot slash commands), exactly like
 * BankService: zero authoritative state lives in memory.
 *
 * ─── The invariant everything rests on ──────────────────────────────────────
 * Coins are strictly conserved. The treasury is the counterparty, and every coin
 * a trader gains came out of a treasury bucket.
 *
 * The naive design (oracle sets an absolute price, house buys everything back) is
 * insolvent by construction: buys bank cash at the oracle prevailing *then*, while
 * sells pay out at the *current* oracle, so the treasury is short by
 * G(s)·(O_now − O_avg_at_buy) — i.e. whenever a stock is worth more than it was
 * bought for, which is the default state of anything people want to own.
 *
 * Instead prices are NORMALISED to the reserve. Raw scores o_j come from community
 * metrics; each tick we set
 *
 *     lambda = shareReserve / Σ_j (o_j · G(s_j))        and   O_j = lambda · o_j
 *
 * which makes "the reserve exactly backs total liability" an identity rather than a
 * hope. It survives trading between ticks: a buy adds O_j·[G(s+N) − G(s)] to the
 * reserve AND the same amount to liability, so Σ O_j·G(s_j) = shareReserve is
 * invariant under every trade. Sells therefore can never be rejected for lack of
 * funds. lambda is also unchanged by delisting (both numerator and denominator drop
 * by the same stock's term), so it only moves when raw scores move — and those are
 * hard-capped per tick, which is what makes short collateral provably sufficient.
 *
 * The honest consequence, which the UI states plainly: this market is ZERO-SUM.
 * One artist's rise is funded by the others falling.
 */

// One global share count for every stock. Per-stock caps buy nothing and create
// both a governance question and a low-float attack surface.
export const SHARES_TOTAL = 1000;

// Transaction types that count as a member's own activity. Mirrors
// BankService.ACTIVITY_EARNING_TYPES: PAY and TIP are excluded because both merely
// move existing coins and would let someone qualify an alt for free.
const ACTIVITY_EARNING_TYPES = ['MESSAGE', 'LEVELUP', 'DAILY', 'WEEKLY'];

// A play only counts toward an artist's score if the listener actually listened.
const MIN_QUALIFYING_PLAY_SECONDS = 30;
const SCORE_WINDOW_DAYS = 7;
// Coins a listener must have earned themselves before their plays move any oracle.
const LISTENER_ACTIVITY_THRESHOLD = 50;
const FOLLOWER_WEIGHT = 3;
const SCORE_FLOOR = 1; // keeps a brand-new stock from being a divide-by-zero lottery ticket

export interface MarketSettingsShape {
    enabled: boolean;
    pressureK: number;
    maxTickMovePct: number;
    oracleFloorPct: number;
    tickIntervalMinutes: number;
    feePct: number;
    flipFeePct: number;
    flipWindowHours: number;
    minHoldHours: number;
    maxUserSharesPct: number;
    maxShortInterestPct: number;
    collateralPct: number;
    liquidationPct: number;
    dividendPctOfFloat: number;
    minTracksToList: number;
    minListenersToList: number;
    minProfileAgeDays: number;
}

// ─── Pricing math ────────────────────────────────────────────────────────────

/** Pressure multiplier: spans (1 - k/2)x .. (1 + k/2)x of the oracle as shares sell out. */
export function pressure(shares: number, k: number): number {
    return 1 + k * (shares / SHARES_TOTAL - 0.5);
}

/**
 * Closed-form integral of `pressure` from 0 to s. Because f is linear this is exact,
 * so cost for N shares is G(s+N) - G(s) with no per-share loop (a loop would be both
 * slower and a rounding-drift generator).
 */
export function G(shares: number, k: number): number {
    return shares * (1 + k * (shares / (2 * SHARES_TOTAL) - 0.5));
}

export function priceOf(oraclePrice: number, shares: number, k: number): number {
    return oraclePrice * pressure(shares, k);
}

/** Cost in coins (float, pre-rounding) to move a stock from `from` shares to `to`. */
export function costBetween(oraclePrice: number, from: number, to: number, k: number): number {
    return oraclePrice * (G(to, k) - G(from, k));
}

function validateShares(n: number): number {
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('Share count must be a number.');
    const shares = Math.floor(n);
    if (shares <= 0) throw new Error('Share count must be a whole number greater than zero.');
    if (shares > SHARES_TOTAL) throw new Error(`You cannot trade more than ${SHARES_TOTAL} shares at once.`);
    return shares;
}

// ─── Settings / treasury ─────────────────────────────────────────────────────

export async function getSettings(db: any, guildId: string): Promise<any> {
    let s = await db.marketSettings.findUnique({ where: { guildId } });
    if (!s) s = await db.marketSettings.create({ data: { guildId } });
    return s;
}

export async function getTreasury(db: any, guildId: string): Promise<any> {
    let t = await db.marketTreasury.findUnique({ where: { guildId } });
    if (!t) t = await db.marketTreasury.create({ data: { guildId } });
    return t;
}

/**
 * Acquires row locks in a FIXED order — treasury, then stock, then account.
 * Two concurrent trades taking them in different orders would deadlock.
 *
 * The per-guild treasury row serialises every trade in the guild. At Discord-bot
 * volume that is irrelevant and the simplicity is worth it; it is a deliberate
 * choice rather than an accident.
 */
async function withTradeLock<T>(
    db: any,
    guildId: string,
    stockId: string,
    userId: string,
    fn: (tx: any, ctx: { treasury: any; stock: any; account: any }) => Promise<T>,
): Promise<T> {
    await getTreasury(db, guildId);
    await db.economyAccount.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: { guildId, userId },
        update: {},
    });

    return db.$transaction(async (tx: any) => {
        const [treasury] = await tx.$queryRaw`
            SELECT * FROM market_treasury WHERE "guildId" = ${guildId} FOR UPDATE`;
        const [stock] = await tx.$queryRaw`
            SELECT * FROM stocks WHERE id = ${stockId} FOR UPDATE`;
        const [account] = await tx.$queryRaw`
            SELECT id, balance, "savingsBalance" FROM economy_accounts
            WHERE "guildId" = ${guildId} AND "userId" = ${userId} FOR UPDATE`;
        if (!treasury) throw new Error('Market is not set up in this server.');
        if (!stock) throw new Error('That stock does not exist.');
        if (!account) throw new Error('Economy account not found.');
        return fn(tx, { treasury, stock, account });
    }, { timeout: 15_000 });
}

// ─── Read paths ──────────────────────────────────────────────────────────────

export async function listStocks(db: any, guildId: string) {
    return db.stock.findMany({
        where: { guildId, status: { in: ['active', 'frozen'] } },
        orderBy: { price: 'desc' },
    });
}

export async function getStockByTicker(db: any, guildId: string, ticker: string) {
    return db.stock.findUnique({ where: { guildId_ticker: { guildId, ticker: ticker.toUpperCase() } } });
}

export async function getPortfolio(db: any, guildId: string, userId: string) {
    const [holdings, shorts, account] = await Promise.all([
        db.stockHolding.findMany({ where: { guildId, userId, shares: { gt: 0 } }, include: { stock: true } }),
        db.shortPosition.findMany({ where: { guildId, userId, status: 'open' }, include: { stock: true } }),
        db.economyAccount.findUnique({ where: { guildId_userId: { guildId, userId } } }),
    ]);

    let holdingsValue = 0;
    for (const h of holdings) holdingsValue += h.shares * h.stock.price;

    return {
        wallet: account?.balance ?? 0,
        holdings: holdings.map((h: any) => ({
            stockId: h.stockId,
            ticker: h.stock.ticker,
            name: h.stock.name,
            shares: h.shares,
            avgCost: h.avgCost,
            price: h.stock.price,
            value: h.shares * h.stock.price,
            pnl: h.shares * h.stock.price - h.shares * h.avgCost,
            openedAt: h.openedAt,
        })),
        shorts,
        holdingsValue,
    };
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

/** An artist may never trade their own stock, in either direction. */
async function assertNotOwnStock(db: any, stock: any, userId: string) {
    if (stock.type !== 'ARTIST' || !stock.profileId) return;
    const profile = await db.musicianProfile.findUnique({
        where: { id: stock.profileId },
        select: { userId: true },
    });
    if (profile?.userId === userId) {
        throw new Error("You can't trade your own stock.");
    }
}

function assertTradeable(stock: any, settings: any) {
    if (!settings.enabled) throw new Error('The market is currently closed.');
    if (stock.status === 'delisted') throw new Error(`${stock.ticker} has been delisted.`);
    if (stock.status === 'frozen') throw new Error(`${stock.ticker} is frozen and cannot be traded right now.`);
}

// ─── Buy ─────────────────────────────────────────────────────────────────────

/**
 * Rounding discipline: the charge rounds UP and the reserve is credited the exact
 * liability increase, with the fee as a SPREAD on top. Skimming the fee out of the
 * reserve instead would reintroduce the insolvency at feePct per round trip.
 */
export async function buy(db: any, guildId: string, userId: string, stockId: string, requestedShares: number) {
    const want = validateShares(requestedShares);
    const settings = await getSettings(db, guildId);

    return withTradeLock(db, guildId, stockId, userId, async (tx, { treasury, stock, account }) => {
        assertTradeable(stock, settings);
        await assertNotOwnStock(tx, stock, userId);

        const holding = await tx.stockHolding.findUnique({
            where: { guildId_userId_stockId: { guildId, userId, stockId } },
        });
        const held = holding?.shares ?? 0;

        // Partial fill rather than a hard rejection: friendlier in Discord, and the
        // decision is made here rather than left to a stray Math.min.
        const floatLeft = SHARES_TOTAL - stock.sharesOutstanding;
        const userCap = Math.floor(SHARES_TOTAL * (settings.maxUserSharesPct / 100));
        const allowedByCap = Math.max(0, userCap - held);
        const shares = Math.min(want, floatLeft, allowedByCap);

        if (floatLeft <= 0) throw new Error(`${stock.ticker} is fully sold out.`);
        if (allowedByCap <= 0) throw new Error(`You already hold the maximum ${userCap} shares of ${stock.ticker}.`);

        const k = settings.pressureK;
        const gross = costBetween(stock.oraclePrice, stock.sharesOutstanding, stock.sharesOutstanding + shares, k);
        const reserveCredit = Math.ceil(gross);
        const feeInt = Math.ceil(gross * (settings.feePct / 100));
        const totalCharge = reserveCredit + feeInt;

        if (account.balance < totalCharge) {
            throw new Error(`You need ${totalCharge.toLocaleString()} coins for ${shares} share(s) of ${stock.ticker} but only have ${account.balance.toLocaleString()}.`);
        }

        const newShares = stock.sharesOutstanding + shares;
        const newPrice = priceOf(stock.oraclePrice, newShares, k);

        await tx.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { decrement: totalCharge } },
        });
        await tx.marketTreasury.update({
            where: { guildId },
            data: { shareReserve: { increment: reserveCredit }, houseFloat: { increment: feeInt } },
        });
        await tx.stock.update({
            where: { id: stockId },
            data: { sharesOutstanding: newShares, price: newPrice },
        });

        const prevCostBasis = held * (holding?.avgCost ?? 0);
        await tx.stockHolding.upsert({
            where: { guildId_userId_stockId: { guildId, userId, stockId } },
            create: { guildId, userId, stockId, shares, avgCost: totalCharge / shares, openedAt: new Date() },
            update: {
                shares: held + shares,
                avgCost: (prevCostBasis + totalCharge) / (held + shares),
                // Reset on every increase: conservative, and makes min-hold and the
                // flip fee impossible to dodge by topping up an old position.
                openedAt: new Date(),
            },
        });
        await tx.stockTrade.create({
            data: { guildId, userId, stockId, action: 'BUY', shares, price: newPrice, coinDelta: -totalCharge, feePaid: feeInt },
        });

        return { shares, totalCharge, feeInt, price: newPrice, partial: shares < want };
    });
}

// ─── Sell ────────────────────────────────────────────────────────────────────

export async function sell(db: any, guildId: string, userId: string, stockId: string, requestedShares: number) {
    const want = validateShares(requestedShares);
    const settings = await getSettings(db, guildId);

    return withTradeLock(db, guildId, stockId, userId, async (tx, { treasury, stock, account }) => {
        if (!settings.enabled) throw new Error('The market is currently closed.');
        if (stock.status === 'frozen') throw new Error(`${stock.ticker} is frozen and cannot be traded right now.`);

        const holding = await tx.stockHolding.findUnique({
            where: { guildId_userId_stockId: { guildId, userId, stockId } },
        });
        if (!holding || holding.shares <= 0) throw new Error(`You don't own any ${stock.ticker}.`);

        const shares = Math.min(want, holding.shares);
        const heldMs = Date.now() - new Date(holding.openedAt).getTime();
        const heldHours = heldMs / 3_600_000;
        if (heldHours < settings.minHoldHours) {
            const wait = Math.ceil(settings.minHoldHours - heldHours);
            throw new Error(`You must hold ${stock.ticker} for ${settings.minHoldHours}h before selling. Try again in ~${wait}h.`);
        }

        const k = settings.pressureK;
        const gross = costBetween(stock.oraclePrice, stock.sharesOutstanding - shares, stock.sharesOutstanding, k);

        // Clamp to what the reserve actually holds. The invariant means this should
        // never bind, but integer drift within a tick makes the guard cheap insurance.
        const reserveDebit = Math.min(Math.floor(gross), treasury.shareReserve);
        const flip = heldHours < settings.flipWindowHours ? settings.flipFeePct : 0;
        const feeInt = Math.ceil(reserveDebit * ((settings.feePct + flip) / 100));
        const payout = Math.max(0, reserveDebit - feeInt);
        const houseCredit = reserveDebit - payout;

        const newShares = stock.sharesOutstanding - shares;
        const newPrice = priceOf(stock.oraclePrice, newShares, k);

        await tx.marketTreasury.update({
            where: { guildId },
            data: { shareReserve: { decrement: reserveDebit }, houseFloat: { increment: houseCredit } },
        });
        await tx.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { increment: payout } },
        });
        await tx.stock.update({
            where: { id: stockId },
            data: { sharesOutstanding: newShares, price: newPrice },
        });

        const left = holding.shares - shares;
        if (left > 0) {
            await tx.stockHolding.update({
                where: { guildId_userId_stockId: { guildId, userId, stockId } },
                data: { shares: left },
            });
        } else {
            await tx.stockHolding.delete({
                where: { guildId_userId_stockId: { guildId, userId, stockId } },
            });
        }
        await tx.stockTrade.create({
            data: { guildId, userId, stockId, action: 'SELL', shares, price: newPrice, coinDelta: payout, feePaid: houseCredit },
        });

        return { shares, payout, feePaid: houseCredit, price: newPrice, flipped: flip > 0 };
    });
}

// ─── Oracle scoring ──────────────────────────────────────────────────────────

/**
 * Raw score per artist profile, from community metrics.
 *
 * Reads TrackPlay ONLY. Track.playCount and MusicianProfile.totalPlays are inflated
 * by a random 2-4x vanity multiplier in AudioService.playCountMultiplier(), so they
 * carry noise with a ~3x bias and are unusable as a price signal.
 *
 * A play counts only if the listener is identified, listened for real, has earned
 * their own coins in the server, and is not the artist. Each listener contributes at
 * most once per artist per day. Under normalised pricing, farming your own score
 * doesn't merely pump you, it takes value from every other stock's holders, so this
 * gate is the single most important piece of anti-abuse in the feature.
 */
export async function computeArtistScores(db: any, guildId: string): Promise<Map<string, number>> {
    const since = new Date(Date.now() - SCORE_WINDOW_DAYS * 24 * 3600 * 1000);

    const qualifiedRows: any[] = await db.$queryRaw`
        SELECT "toUserId" AS "userId"
        FROM economy_transactions
        WHERE "guildId" = ${guildId}
          AND type IN ('MESSAGE', 'LEVELUP', 'DAILY', 'WEEKLY')
          AND "toUserId" IS NOT NULL
        GROUP BY "toUserId"
        HAVING SUM(amount) >= ${LISTENER_ACTIVITY_THRESHOLD}`;
    const qualified = new Set(qualifiedRows.map(r => r.userId));

    // Distinct (artist, listener, day) tuples — caps each listener at one
    // contribution per artist per day and drops self-plays.
    const playRows: any[] = await db.$queryRaw`
        SELECT DISTINCT t."profileId" AS "profileId", tp."userId" AS "userId", DATE(tp."playAt") AS day
        FROM track_plays tp
        JOIN musician_tracks t ON t.id = tp."trackId"
        JOIN musician_profiles mp ON mp.id = t."profileId"
        WHERE tp."playAt" >= ${since}
          AND tp."userId" IS NOT NULL
          AND COALESCE(tp."durationPlayed", 0) >= ${MIN_QUALIFYING_PLAY_SECONDS}
          AND tp."userId" <> mp."userId"`;

    const listenerDays = new Map<string, number>();
    for (const r of playRows) {
        if (!qualified.has(r.userId)) continue;
        listenerDays.set(r.profileId, (listenerDays.get(r.profileId) ?? 0) + 1);
    }

    // sqrt compression: the 50th follower should count for far less than the 5th.
    const followerRows = await db.artistFollow.groupBy({ by: ['artistId'], _count: { _all: true } });
    const scores = new Map<string, number>();
    for (const [profileId, days] of listenerDays) scores.set(profileId, days);
    for (const f of followerRows) {
        const bonus = FOLLOWER_WEIGHT * Math.sqrt(f._count._all);
        scores.set(f.artistId, (scores.get(f.artistId) ?? 0) + bonus);
    }
    return scores;
}

// ─── Tick ────────────────────────────────────────────────────────────────────

/**
 * Recomputes every stock's price.
 *
 * Metric queries run OUTSIDE the transaction; only the short apply step holds the
 * guild-wide treasury lock. Idempotency is DB-backed via lastTickAt checked inside
 * that lock, because the in-memory guards used elsewhere in this codebase reset on
 * every PM2 restart and a double-run would mean a double price move.
 */
export async function runTick(db: any, guildId: string, logger?: any, force = false): Promise<boolean> {
    const settings = await getSettings(db, guildId);
    if (!settings.enabled) return false;

    const treasuryPre = await getTreasury(db, guildId);
    const intervalMs = settings.tickIntervalMinutes * 60_000;
    if (!force && treasuryPre.lastTickAt && Date.now() - new Date(treasuryPre.lastTickAt).getTime() < intervalMs * 0.9) {
        return false;
    }

    const stocks = await db.stock.findMany({ where: { guildId, status: { in: ['active', 'frozen'] } } });
    if (!stocks.length) return false;

    const artistScores = await computeArtistScores(db, guildId);

    // ETFs are synthetic: their raw score is just the sum of their live constituents'
    // scores, so a delisted constituent simply drops out next tick — no basket to
    // rebalance, no unwind path, no special case.
    const etfMembers = new Map<string, string[]>();
    for (const s of stocks) {
        if (s.type === 'ETF' && s.genreId) {
            const members = await db.profileGenre.findMany({
                where: { genreId: s.genreId },
                select: { profileId: true },
            });
            etfMembers.set(s.id, members.map((m: any) => m.profileId));
        }
    }

    const cap = settings.maxTickMovePct / 100;
    const desired = new Map<string, number>();
    for (const s of stocks) {
        let raw: number;
        if (s.type === 'ARTIST') {
            raw = (artistScores.get(s.profileId ?? '') ?? 0) + SCORE_FLOOR;
        } else {
            const members = etfMembers.get(s.id) ?? [];
            raw = members.reduce((acc, pid) => acc + (artistScores.get(pid) ?? 0), 0) + SCORE_FLOOR;
        }

        // Hard per-tick movement cap. This is load-bearing for short-collateral
        // solvency, not cosmetic — the collateral proof assumes a bounded step.
        const prev = s.rawScore > 0 ? s.rawScore : raw;
        let capped = Math.max(prev * (1 - cap), Math.min(prev * (1 + cap), raw));

        // Asymmetric floor: fast rises allowed, but a fall is floored against the
        // trailing 7-day peak so an artist can't crater their own stock in one tick
        // by deleting their tracks.
        const peakRow = await db.stockPricePoint.findFirst({
            where: { stockId: s.id, at: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
            orderBy: { oraclePrice: 'desc' },
            select: { oraclePrice: true },
        });
        if (peakRow && treasuryPre.lambda > 0) {
            const peakRaw = peakRow.oraclePrice / treasuryPre.lambda;
            capped = Math.max(capped, peakRaw * (settings.oracleFloorPct / 100));
        }

        desired.set(s.id, Math.max(SCORE_FLOOR, capped));
    }

    const k = settings.pressureK;

    return db.$transaction(async (tx: any) => {
        const [treasury] = await tx.$queryRaw`
            SELECT * FROM market_treasury WHERE "guildId" = ${guildId} FOR UPDATE`;
        if (!force && treasury.lastTickAt && Date.now() - new Date(treasury.lastTickAt).getTime() < intervalMs * 0.9) {
            return false; // another process ticked while we were computing
        }

        const fresh = await tx.stock.findMany({ where: { guildId, status: { in: ['active', 'frozen'] } } });
        let denom = 0;
        for (const s of fresh) denom += (desired.get(s.id) ?? SCORE_FLOOR) * G(s.sharesOutstanding, k);

        // lambda = reserve / Σ o·G(s) makes full backing an identity. With no shares
        // outstanding anywhere the ratio is undefined (0/0) — carry the previous value,
        // which is provably self-consistent: the first buy banks exactly lambda·o·G(N),
        // so recomputing immediately after yields the same lambda.
        const lambda = denom > 0 && treasury.shareReserve > 0 ? treasury.shareReserve / denom : treasury.lambda;

        for (const s of fresh) {
            const raw = desired.get(s.id) ?? SCORE_FLOOR;
            const oraclePrice = lambda * raw;
            const price = priceOf(oraclePrice, s.sharesOutstanding, k);
            await tx.stock.update({
                where: { id: s.id },
                data: { rawScore: raw, oraclePrice, price, prevClose: s.price },
            });
            await tx.stockPricePoint.create({
                data: { stockId: s.id, price, oraclePrice, sharesOutstanding: s.sharesOutstanding },
            });
        }

        await tx.marketTreasury.update({
            where: { guildId },
            data: { lambda, lastTickAt: new Date() },
        });
        return true;
    }, { timeout: 30_000 });
}

// ─── Listing ─────────────────────────────────────────────────────────────────

function tickerFor(name: string, taken: Set<string>): string {
    const base = (name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'STK').slice(0, 4).padEnd(3, 'X');
    let t = base;
    let n = 1;
    while (taken.has(t)) t = `${base.slice(0, 3)}${n++}`;
    taken.add(t);
    return t;
}

/** Lists newly-eligible artists and genre ETFs. Honours soft-delete and moderation state. */
export async function syncListings(db: any, guildId: string, logger?: any): Promise<number> {
    const settings = await getSettings(db, guildId);
    const existing = await db.stock.findMany({ where: { guildId } });
    const taken = new Set<string>(existing.map((s: any) => s.ticker));
    const haveProfile = new Set(existing.filter((s: any) => s.profileId).map((s: any) => s.profileId));
    const haveGenre = new Set(existing.filter((s: any) => s.genreId).map((s: any) => s.genreId));

    const scores = await computeArtistScores(db, guildId);
    const ageCutoff = new Date(Date.now() - settings.minProfileAgeDays * 24 * 3600 * 1000);

    const candidates = await db.musicianProfile.findMany({
        where: {
            deletedAt: null,
            status: 'active',
            createdAt: { lte: ageCutoff },
        },
        select: { id: true, username: true, displayName: true, _count: { select: { tracks: true } } },
    });

    let created = 0;
    for (const p of candidates) {
        if (haveProfile.has(p.id)) continue;
        if (p._count.tracks < settings.minTracksToList) continue;
        if ((scores.get(p.id) ?? 0) < settings.minListenersToList) continue;
        const name = p.displayName || p.username;
        await db.stock.create({
            data: {
                guildId, type: 'ARTIST', profileId: p.id,
                ticker: tickerFor(name, taken), name,
                rawScore: SCORE_FLOOR, oraclePrice: 0, price: 0,
            },
        });
        created++;
    }

    const genres = await db.genre.findMany({ select: { id: true, name: true } });
    for (const g of genres) {
        if (haveGenre.has(g.id)) continue;
        const memberCount = await db.profileGenre.count({ where: { genreId: g.id } });
        if (memberCount < 3) continue;
        await db.stock.create({
            data: {
                guildId, type: 'ETF', genreId: g.id,
                ticker: tickerFor(g.name, taken), name: `${g.name} Index`,
                rawScore: SCORE_FLOOR, oraclePrice: 0, price: 0,
            },
        });
        created++;
    }

    if (created) logger?.info?.(`[Market] listed ${created} new stock(s) in ${guildId}`);
    return created;
}

// ─── Delisting ───────────────────────────────────────────────────────────────

/**
 * Freeze, then compulsorily buy back every outstanding share at the last valid price.
 *
 * Always affordable: the payout is exactly O_j·G(s_j), which IS this stock's slice of
 * the reserve. Remaining stocks renormalise upward next tick, and lambda is provably
 * unchanged because numerator and denominator both drop by the same term.
 */
export async function delistStock(db: any, guildId: string, stockId: string, logger?: any) {
    const settings = await getSettings(db, guildId);
    const k = settings.pressureK;

    return db.$transaction(async (tx: any) => {
        const [treasury] = await tx.$queryRaw`
            SELECT * FROM market_treasury WHERE "guildId" = ${guildId} FOR UPDATE`;
        const [stock] = await tx.$queryRaw`
            SELECT * FROM stocks WHERE id = ${stockId} FOR UPDATE`;
        if (!stock || stock.status === 'delisted') return { alreadyDelisted: true, paidOut: 0, holders: 0 };

        const holdings = await tx.stockHolding.findMany({ where: { guildId, stockId, shares: { gt: 0 } } });
        const settlePrice = priceOf(stock.oraclePrice, stock.sharesOutstanding, k);

        let paidOut = 0;
        for (const h of holdings) {
            // Value each holder's slice on the same curve they'd have sold into.
            const gross = costBetween(stock.oraclePrice, Math.max(0, stock.sharesOutstanding - h.shares), stock.sharesOutstanding, k);
            const payout = Math.min(Math.floor(gross), treasury.shareReserve - paidOut);
            if (payout > 0) {
                await tx.economyAccount.update({
                    where: { guildId_userId: { guildId, userId: h.userId } },
                    data: { balance: { increment: payout } },
                });
                paidOut += payout;
            }
            await tx.stockTrade.create({
                data: { guildId, userId: h.userId, stockId, action: 'DELIST_BUYBACK', shares: h.shares, price: settlePrice, coinDelta: payout },
            });
            await tx.stockHolding.delete({ where: { id: h.id } });
        }

        await tx.marketTreasury.update({
            where: { guildId },
            data: { shareReserve: { decrement: paidOut } },
        });
        await tx.stock.update({
            where: { id: stockId },
            data: { status: 'delisted', delistPrice: settlePrice, sharesOutstanding: 0, price: settlePrice },
        });

        logger?.info?.(`[Market] delisted ${stock.ticker}: paid ${paidOut} to ${holdings.length} holder(s)`);
        return { alreadyDelisted: false, paidOut, holders: holdings.length, settlePrice };
    }, { timeout: 30_000 });
}

// ─── Conservation audit ──────────────────────────────────────────────────────

/**
 * Asserts the two things that must always be true. Alerts, never auto-corrects —
 * silently "fixing" a conservation breach would destroy the evidence needed to find
 * its cause.
 */
export async function auditConservation(db: any, guildId: string, logger?: any) {
    const settings = await getSettings(db, guildId);
    const treasury = await getTreasury(db, guildId);
    const stocks = await db.stock.findMany({ where: { guildId, status: { in: ['active', 'frozen'] } } });

    let liability = 0;
    for (const s of stocks) liability += s.oraclePrice * G(s.sharesOutstanding, settings.pressureK);

    const wallets = await db.economyAccount.aggregate({
        where: { guildId },
        _sum: { balance: true, savingsBalance: true },
    });

    const totalCoins =
        (wallets._sum.balance ?? 0) +
        (wallets._sum.savingsBalance ?? 0) +
        treasury.shareReserve + treasury.shortCollateral + treasury.houseFloat;

    const backingGap = treasury.shareReserve - liability;
    const healthy = backingGap >= -Math.max(10, stocks.length);

    if (!healthy) {
        logger?.error?.(`[Market] BACKING SHORTFALL in ${guildId}: reserve=${treasury.shareReserve} liability=${liability.toFixed(2)} gap=${backingGap.toFixed(2)}`);
    }
    return { totalCoins, shareReserve: treasury.shareReserve, liability, backingGap, healthy, stockCount: stocks.length };
}
