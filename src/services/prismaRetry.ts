/**
 * Prisma Retry Middleware — automatically retries operations that fail
 * due to transient database errors (connection timeouts, pool exhaustion,
 * server restarts, etc.)
 *
 * Retried error codes:
 *   P1001 — Can't reach database server
 *   P1002 — Database server reached but timed out
 *   P1008 — Operations timed out
 *   P1017 — Server closed the connection
 *   P2024 — Timed out fetching a new connection from the pool
 *   P2034 — Transaction conflict (write conflict / deadlock retry)
 *
 * Applies exponential backoff with jitter: ~100ms → ~200ms → ~400ms
 */

import type { Prisma } from '@prisma/client';
import { Logger } from '../bot/utils/logger.js';

const logger = new Logger('PrismaRetry');

const RETRYABLE_CODES = new Set([
    'P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2034',
]);

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

function isPrismaError(e: unknown): e is { code: string; message: string } {
    return typeof e === 'object' && e !== null && 'code' in e && typeof (e as any).code === 'string';
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const retryMiddleware: Prisma.Middleware = async (params, next) => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await next(params);
        } catch (e) {
            lastError = e;
            if (isPrismaError(e) && RETRYABLE_CODES.has(e.code) && attempt < MAX_RETRIES) {
                const jitter = Math.random() * 50;
                const backoff = BASE_DELAY_MS * Math.pow(2, attempt) + jitter;
                logger.warn(
                    `[Retry ${attempt + 1}/${MAX_RETRIES}] ${params.model}.${params.action} — ${e.code}: ${e.message.slice(0, 80)}… retrying in ${Math.round(backoff)}ms`
                );
                await delay(backoff);
                continue;
            }
            throw e;
        }
    }

    throw lastError;
};
