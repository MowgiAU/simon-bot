// Shared bank business logic (savings + loans + credit score) used by BOTH the
// Discord bot's /bank commands (EconomyPlugin) and the public site's
// /api/bank/* routes, so the rules can never drift out of sync between the two.

const CREDIT_SCORE_MIN = 300;
const CREDIT_SCORE_MAX = 850;
const CREDIT_SCORE_BASE = 650;
const CREDIT_SCORE_ON_TIME_BONUS = 20;
const CREDIT_SCORE_LATE_REPAY_BONUS = 10;
const CREDIT_SCORE_DEFAULT_PENALTY = 60;

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
    let account = await db.economyAccount.findUnique({ where: { guildId_userId: { guildId, userId } } });
    if (!account) {
        account = await db.economyAccount.create({ data: { guildId, userId } });
    }
    return account;
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
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.');
    const account = await getAccount(db, guildId, userId);
    if (account.balance < amount) throw new Error('Insufficient wallet balance.');

    await db.$transaction([
        db.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { decrement: amount }, savingsBalance: { increment: amount } },
        }),
        db.economyTransaction.create({
            data: { guildId, amount, type: 'DEPOSIT', reason: 'Deposit to savings', fromUserId: userId, toUserId: userId },
        }),
    ]);

    return getAccount(db, guildId, userId);
}

export async function withdraw(db: any, guildId: string, userId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.');
    const account = await getAccount(db, guildId, userId);
    if (account.savingsBalance < amount) throw new Error('Insufficient savings balance.');

    await db.$transaction([
        db.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { increment: amount }, savingsBalance: { decrement: amount } },
        }),
        db.economyTransaction.create({
            data: { guildId, amount, type: 'WITHDRAW', reason: 'Withdrawal from savings', fromUserId: userId, toUserId: userId },
        }),
    ]);

    return getAccount(db, guildId, userId);
}

export async function requestLoan(db: any, guildId: string, userId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.');

    const [account, settings, existing] = await Promise.all([
        getAccount(db, guildId, userId),
        getSettings(db, guildId),
        db.economyLoan.findFirst({ where: { guildId, userId, status: { in: ['active', 'defaulted'] } } }),
    ]);

    if (existing) throw new Error(existing.status === 'defaulted'
        ? 'You have an unpaid defaulted loan — repay it before borrowing again.'
        : 'You already have an active loan — repay it before borrowing again.');
    if (account.creditScore < settings.minCreditScoreToBorrow) {
        throw new Error(`Your credit score (${account.creditScore}) is below the minimum (${settings.minCreditScoreToBorrow}) required to borrow.`);
    }

    const maxLoan = computeMaxLoan(account.creditScore, settings);
    if (amount > maxLoan) throw new Error(`You can borrow at most ${settings.currencyEmoji} ${maxLoan.toLocaleString()} right now.`);

    const feeAmount = Math.round(amount * (settings.loanFeePct / 100));
    const totalOwed = amount + feeAmount;
    const dueAt = new Date(Date.now() + settings.loanTermDays * 24 * 60 * 60 * 1000);

    const [loan] = await db.$transaction([
        db.economyLoan.create({
            data: { guildId, userId, principal: amount, feeAmount, totalOwed, status: 'active', dueAt },
        }),
        db.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { increment: amount } },
        }),
        db.economyTransaction.create({
            data: { guildId, amount, type: 'LOAN', reason: `Loan issued (fee ${feeAmount})`, toUserId: userId },
        }),
    ]);

    return loan;
}

export async function repayLoan(db: any, guildId: string, userId: string, amount?: number) {
    const loan = await db.economyLoan.findFirst({ where: { guildId, userId, status: { in: ['active', 'defaulted'] } } });
    if (!loan) throw new Error('You have no outstanding loan to repay.');

    const payAmount = amount && amount > 0 ? Math.min(amount, loan.totalOwed) : loan.totalOwed;
    const account = await getAccount(db, guildId, userId);
    if (account.balance < payAmount) throw new Error('Insufficient wallet balance to make this repayment.');

    const remaining = loan.totalOwed - payAmount;
    const now = new Date();
    const ops: any[] = [
        db.economyAccount.update({
            where: { guildId_userId: { guildId, userId } },
            data: { balance: { decrement: payAmount } },
        }),
        db.economyTransaction.create({
            data: { guildId, amount: payAmount, type: 'REPAY', reason: 'Loan repayment', fromUserId: userId },
        }),
    ];

    if (remaining <= 0) {
        const onTime = now <= loan.dueAt;
        const scoreDelta = onTime ? CREDIT_SCORE_ON_TIME_BONUS : CREDIT_SCORE_LATE_REPAY_BONUS;
        ops.push(
            db.economyLoan.update({ where: { id: loan.id }, data: { totalOwed: 0, status: 'repaid', repaidAt: now } }),
            db.economyAccount.update({
                where: { guildId_userId: { guildId, userId } },
                data: { creditScore: clampCreditScore(account.creditScore + scoreDelta) },
            }),
        );
    } else {
        ops.push(db.economyLoan.update({ where: { id: loan.id }, data: { totalOwed: remaining } }));
    }

    await db.$transaction(ops);
    return db.economyLoan.findUnique({ where: { id: loan.id } });
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
            take: 200,
        });

        for (const account of accounts) {
            const interest = Math.floor(account.savingsBalance * (settings.savingsInterestRatePct / 100));
            const now = new Date();
            await db.$transaction([
                db.economyAccount.update({
                    where: { id: account.id },
                    data: {
                        savingsBalance: { increment: interest },
                        totalEarned: interest > 0 ? { increment: interest } : undefined,
                        lastInterestAt: now,
                    },
                }),
                ...(interest > 0
                    ? [db.economyTransaction.create({
                        data: { guildId, amount: interest, type: 'INTEREST', reason: 'Savings interest', toUserId: account.userId },
                    })]
                    : []),
            ]);
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
            take: 200,
        });

        for (const loan of overdue) {
            const account = await getAccount(db, guildId, loan.userId);
            await db.$transaction([
                db.economyLoan.update({ where: { id: loan.id }, data: { status: 'defaulted' } }),
                db.economyAccount.update({
                    where: { id: account.id },
                    data: { creditScore: clampCreditScore(account.creditScore - CREDIT_SCORE_DEFAULT_PENALTY) },
                }),
            ]);
        }
    } catch (e: any) {
        logger?.warn?.(`[Bank] runLoanOverdueSweep error for ${guildId}: ${e.message}`);
    }
}
