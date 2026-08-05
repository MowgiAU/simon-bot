// Shared bank business logic (savings + loans + credit score) used by BOTH the
// Discord bot's /bank commands (EconomyPlugin) and the public site's
// /api/bank/* routes, so the rules can never drift out of sync between the two.

const CREDIT_SCORE_MIN = 300;
const CREDIT_SCORE_MAX = 850;
const CREDIT_SCORE_BASE = 650;
const CREDIT_SCORE_ON_TIME_BONUS = 20;
const CREDIT_SCORE_LATE_REPAY_BONUS = 10;
const CREDIT_SCORE_DEFAULT_PENALTY = 60;

// Postgres int4 ceiling — keeps arithmetic from overflowing the column.
const MAX_AMOUNT = 1_000_000_000;

export interface BankSettings {
    currencyName: string;
    currencyEmoji: string;
    savingsInterestRatePct: number;
    savingsInterestIntervalHours: number;
    loanFeePct: number;
    loanTermDays: number;
    baseMaxLoan: number;
    loanCap: number;
    creditScoreLoanBonus: number;
    minCreditScoreToBorrow: number;
}

function clampCreditScore(score: number): number {
    return Math.max(CREDIT_SCORE_MIN, Math.min(CREDIT_SCORE_MAX, score));
}

// All coin amounts must be whole positive numbers. Without this, a fractional
// amount reaches an Int column and gets rounded inconsistently between the
// debit and the credit, letting a caller drip coins into (or out of) existence.
function validateAmount(amount: number): number {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error('Amount must be a number.');
    const amt = Math.floor(amount);
    if (amt <= 0) throw new Error('Amount must be a whole number greater than zero.');
    if (amt > MAX_AMOUNT) throw new Error('That amount is too large.');
    return amt;
}

export function computeMaxLoan(creditScore: number, settings: BankSettings): number {
    const bonus = Math.max(0, creditScore - CREDIT_SCORE_BASE) * settings.creditScoreLoanBonus;
    return Math.min(settings.loanCap, settings.baseMaxLoan + bonus);
}

async function getSettings(db: any, guildId: string): Promise<BankSettings> {
    let settings = await db.economySettings.findUnique({ where: { guildId } });
    if (!settings) {
        settings = await db.economySettings.create({ data: { guildId } });
    }
    return settings;
}

async function getAccount(db: any, guildId: string, userId: string) {
    // upsert rather than find-then-create so two concurrent first-time callers
    // can't both try to insert the same (guildId, userId) row.
    return db.economyAccount.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: { guildId, userId },
        update: {},
    });
}

/**
 * Runs a mutating bank operation under a row lock on the user's account.
 *
 * Every balance/loan rule here is "read state, decide, then write" — without a
 * lock those steps interleave, so firing N requests in parallel (spamming a
 * slash command, or looping fetch against /api/bank/*) passes the same check N
 * times. That let a caller hold N simultaneous loans and mint unbounded coins.
 * SELECT ... FOR UPDATE serialises every bank operation per account, so the
 * checks inside see state no one else can change until we commit.
 */
async function withAccountLock<T>(
    db: any,
    guildId: string,
    userId: string,
    fn: (tx: any, account: any) => Promise<T>,
): Promise<T> {
    await getAccount(db, guildId, userId); // the row must exist before it can be locked
    return db.$transaction(async (tx: any) => {
        const rows: any[] = await tx.$queryRaw`
            SELECT id, balance, "savingsBalance", "creditScore"
            FROM economy_accounts
            WHERE "guildId" = ${guildId} AND "userId" = ${userId}
            FOR UPDATE
        `;
        if (!rows.length) throw new Error('Bank account not found.');
        return fn(tx, rows[0]);
    }, { timeout: 10_000 });
}

export async function getSummary(db: any, guildId: string, userId: string) {
    const [account, settings, activeLoan, recentTransactions] = await Promise.all([
        getAccount(db, guildId, userId),
        getSettings(db, guildId),
        db.economyLoan.findFirst({ where: { guildId, userId, status: { in: ['active', 'defaulted'] } } }),
        db.economyTransaction.findMany({
            where: {
                guildId,
                type: { in: ['DEPOSIT', 'WITHDRAW', 'LOAN', 'REPAY', 'INTEREST'] },
                OR: [{ fromUserId: userId }, { toUserId: userId }],
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        }),
    ]);

    return {
        wallet: account.balance,
        savings: account.savingsBalance,
        creditScore: account.creditScore,
        maxLoan: computeMaxLoan(account.creditScore, settings),
        canBorrow: account.creditScore >= settings.minCreditScoreToBorrow && !activeLoan,
        activeLoan,
        settings,
        recentTransactions,
    };
}

export async function deposit(db: any, guildId: string, userId: string, amount: number) {
    const amt = validateAmount(amount);
    return withAccountLock(db, guildId, userId, async (tx, account) => {
        if (account.balance < amt) throw new Error('Insufficient wallet balance.');
        const updated = await tx.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { decrement: amt }, savingsBalance: { increment: amt } },
        });
        await tx.economyTransaction.create({
            data: { guildId, amount: amt, type: 'DEPOSIT', reason: 'Deposit to savings', fromUserId: userId, toUserId: userId },
        });
        return updated;
    });
}

export async function withdraw(db: any, guildId: string, userId: string, amount: number) {
    const amt = validateAmount(amount);
    return withAccountLock(db, guildId, userId, async (tx, account) => {
        if (account.savingsBalance < amt) throw new Error('Insufficient savings balance.');
        const updated = await tx.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { increment: amt }, savingsBalance: { decrement: amt } },
        });
        await tx.economyTransaction.create({
            data: { guildId, amount: amt, type: 'WITHDRAW', reason: 'Withdrawal from savings', fromUserId: userId, toUserId: userId },
        });
        return updated;
    });
}

export async function requestLoan(db: any, guildId: string, userId: string, amount: number) {
    const amt = validateAmount(amount);
    const settings = await getSettings(db, guildId);

    return withAccountLock(db, guildId, userId, async (tx, account) => {
        // Re-checked inside the lock: this is the guard that stops parallel
        // requests from each being granted their own loan.
        const existing = await tx.economyLoan.findFirst({
            where: { guildId, userId, status: { in: ['active', 'defaulted'] } },
        });
        if (existing) {
            throw new Error(existing.status === 'defaulted'
                ? 'You have an unpaid defaulted loan. Repay it before borrowing again.'
                : 'You already have an active loan. Repay it before borrowing again.');
        }
        if (account.creditScore < settings.minCreditScoreToBorrow) {
            throw new Error(`Your credit score (${account.creditScore}) is below the minimum (${settings.minCreditScoreToBorrow}) required to borrow.`);
        }

        const maxLoan = computeMaxLoan(account.creditScore, settings);
        if (amt > maxLoan) throw new Error(`You can borrow at most ${settings.currencyEmoji} ${maxLoan.toLocaleString()} right now.`);

        const feeAmount = Math.round(amt * (settings.loanFeePct / 100));
        const totalOwed = amt + feeAmount;
        const dueAt = new Date(Date.now() + settings.loanTermDays * 24 * 60 * 60 * 1000);

        const loan = await tx.economyLoan.create({
            data: { guildId, userId, principal: amt, feeAmount, totalOwed, status: 'active', dueAt },
        });
        await tx.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { increment: amt } },
        });
        await tx.economyTransaction.create({
            data: { guildId, amount: amt, type: 'LOAN', reason: `Loan issued (fee ${feeAmount})`, toUserId: userId },
        });
        return loan;
    });
}

export async function repayLoan(db: any, guildId: string, userId: string, amount?: number) {
    const requested = amount === undefined || amount === null ? undefined : validateAmount(amount);

    return withAccountLock(db, guildId, userId, async (tx, account) => {
        const loan = await tx.economyLoan.findFirst({
            where: { guildId, userId, status: { in: ['active', 'defaulted'] } },
        });
        if (!loan) throw new Error('You have no outstanding loan to repay.');

        const payAmount = requested !== undefined ? Math.min(requested, loan.totalOwed) : loan.totalOwed;
        if (account.balance < payAmount) throw new Error('Insufficient wallet balance to make this repayment.');

        const remaining = loan.totalOwed - payAmount;
        const now = new Date();

        await tx.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { decrement: payAmount } },
        });
        await tx.economyTransaction.create({
            data: { guildId, amount: payAmount, type: 'REPAY', reason: 'Loan repayment', fromUserId: userId },
        });

        if (remaining <= 0) {
            const onTime = now <= loan.dueAt;
            const scoreDelta = onTime ? CREDIT_SCORE_ON_TIME_BONUS : CREDIT_SCORE_LATE_REPAY_BONUS;
            await tx.economyLoan.update({
                where: { id: loan.id },
                data: { totalOwed: 0, status: 'repaid', repaidAt: now },
            });
            await tx.economyAccount.update({
                where: { guildId_userId: { guildId, userId } },
                data: { creditScore: clampCreditScore(account.creditScore + scoreDelta) },
            });
        } else {
            await tx.economyLoan.update({ where: { id: loan.id }, data: { totalOwed: remaining } });
        }

        return tx.economyLoan.findUnique({ where: { id: loan.id } });
    });
}

// Batched interest accrual — mirrors EconomyPlugin's processExpiredGrants pattern.
export async function runInterestTick(db: any, guildId: string, logger?: any): Promise<void> {
    try {
        const settings = await getSettings(db, guildId);
        if (settings.savingsInterestRatePct <= 0) return;

        const cutoff = new Date(Date.now() - settings.savingsInterestIntervalHours * 60 * 60 * 1000);
        const accounts = await db.economyAccount.findMany({
            where: {
                guildId,
                savingsBalance: { gt: 0 },
                OR: [{ lastInterestAt: null }, { lastInterestAt: { lte: cutoff } }],
            },
            select: { userId: true },
            take: 200,
        });

        for (const { userId } of accounts) {
            try {
                // Locked so a withdrawal mid-tick can't be paid interest it no longer holds.
                await withAccountLock(db, guildId, userId, async (tx, account) => {
                    const interest = Math.floor(account.savingsBalance * (settings.savingsInterestRatePct / 100));
                    await tx.economyAccount.update({
                        where: { guildId_userId: { guildId, userId } },
                        data: {
                            savingsBalance: { increment: interest },
                            totalEarned: interest > 0 ? { increment: interest } : undefined,
                            lastInterestAt: new Date(),
                        },
                    });
                    if (interest > 0) {
                        await tx.economyTransaction.create({
                            data: { guildId, amount: interest, type: 'INTEREST', reason: 'Savings interest', toUserId: userId },
                        });
                    }
                });
            } catch (e: any) {
                logger?.warn?.(`[Bank] interest accrual failed for ${userId}: ${e.message}`);
            }
        }
    } catch (e: any) {
        logger?.warn?.(`[Bank] runInterestTick error for ${guildId}: ${e.message}`);
    }
}

// Flags overdue active loans as defaulted and dings credit score — no forced
// collection of any kind, purely a credit-score consequence.
export async function runLoanOverdueSweep(db: any, guildId: string, logger?: any): Promise<void> {
    try {
        const overdue = await db.economyLoan.findMany({
            where: { guildId, status: 'active', dueAt: { lt: new Date() } },
            select: { id: true, userId: true },
            take: 200,
        });

        for (const { id, userId } of overdue) {
            try {
                // Locked so it can't collide with the borrower repaying right now
                // (which would otherwise apply both the bonus and the penalty).
                await withAccountLock(db, guildId, userId, async (tx, account) => {
                    const fresh = await tx.economyLoan.findUnique({ where: { id } });
                    if (!fresh || fresh.status !== 'active') return; // repaid in the meantime
                    await tx.economyLoan.update({ where: { id }, data: { status: 'defaulted' } });
                    await tx.economyAccount.update({
                        where: { guildId_userId: { guildId, userId } },
                        data: { creditScore: clampCreditScore(account.creditScore - CREDIT_SCORE_DEFAULT_PENALTY) },
                    });
                });
            } catch (e: any) {
                logger?.warn?.(`[Bank] overdue sweep failed for loan ${id}: ${e.message}`);
            }
        }
    } catch (e: any) {
        logger?.warn?.(`[Bank] runLoanOverdueSweep error for ${guildId}: ${e.message}`);
    }
}
