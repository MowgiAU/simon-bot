/**
 * Prisma Soft-Delete Middleware
 *
 * For models that have `deletedAt`, this middleware:
 *   - Converts `delete` / `deleteMany` into `update` / `updateMany` setting `deletedAt = now()`.
 *   - Injects `deletedAt: null` into `findMany` / `findFirst` / `count` where clauses,
 *     so soft-deleted rows are excluded by default.
 *   - To query including soft-deleted rows, pass `{ where: { deletedAt: { not: null } } }`
 *     or any explicit `deletedAt` filter — the middleware will skip injection in that case.
 *
 * Apply via:
 *   import { softDeleteMiddleware } from './softDelete.js';
 *   prisma.$use(softDeleteMiddleware);
 */

import type { Prisma } from '@prisma/client';

/** Models that have a `deletedAt` column. Must match schema additions. */
const SOFT_DELETE_MODELS = new Set([
    'User',
    'MusicianProfile',
    'Track',
    'BeatBattle',
    'BattleEntry',
    'Ticket',
    'Comment',
    'Playlist',
]);

/**
 * Returns true if the caller already specified a `deletedAt` filter
 * (meaning they want to see soft-deleted rows intentionally).
 */
function hasDeletedAtFilter(where: any): boolean {
    if (!where || typeof where !== 'object') return false;
    if ('deletedAt' in where) return true;
    // Check inside AND/OR/NOT clauses
    for (const key of ['AND', 'OR', 'NOT'] as const) {
        const nested = where[key];
        if (Array.isArray(nested)) {
            if (nested.some(hasDeletedAtFilter)) return true;
        } else if (nested && typeof nested === 'object') {
            if (hasDeletedAtFilter(nested)) return true;
        }
    }
    return false;
}

export const softDeleteMiddleware: Prisma.Middleware = async (params, next) => {
    if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
        return next(params);
    }

    // ── DELETE → soft-delete ──────────────────────────────────────────────
    if (params.action === 'delete') {
        params.action = 'update';
        params.args.data = { deletedAt: new Date() };
        return next(params);
    }

    if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (params.args.data) {
            params.args.data.deletedAt = new Date();
        } else {
            params.args.data = { deletedAt: new Date() };
        }
        return next(params);
    }

    // ── READ → auto-filter out soft-deleted ──────────────────────────────
    const readActions = ['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'];
    if (readActions.includes(params.action)) {
        if (!params.args) params.args = {};
        if (!params.args.where) params.args.where = {};

        // Only inject if caller didn't already filter on deletedAt
        if (!hasDeletedAtFilter(params.args.where)) {
            params.args.where.deletedAt = null;
        }
    }

    // findUnique / findUniqueOrThrow — cannot add non-unique fields to where,
    // so we convert to findFirst to support the soft-delete filter.
    if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
        if (!params.args) params.args = {};
        if (!params.args.where) params.args.where = {};

        if (!hasDeletedAtFilter(params.args.where)) {
            params.args.where.deletedAt = null;
            // Convert to findFirst since findUnique doesn't support non-unique filters
            if (params.action === 'findUnique') {
                params.action = 'findFirst';
            } else {
                params.action = 'findFirst';
                // For findUniqueOrThrow, we need to throw if not found
                const result = await next(params);
                if (!result) {
                    throw new Error(`No ${params.model} found`);
                }
                return result;
            }
        }
    }

    // ── UPDATE / UPSERT → add deletedAt:null to where when operating on "live" rows
    if (params.action === 'update' || params.action === 'updateMany' || params.action === 'upsert') {
        if (params.args?.where && !hasDeletedAtFilter(params.args.where)) {
            // Only inject for updateMany and upsert where the where clause isn't a unique identifier
            if (params.action === 'updateMany') {
                params.args.where.deletedAt = null;
            }
        }
    }

    return next(params);
};
