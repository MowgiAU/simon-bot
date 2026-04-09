import { PrismaClient } from '@prisma/client';

/**
 * Shared word censor utility.
 *
 * Loads the guild's word filter groups from the database and applies the same
 * regex logic the WordFilterPlugin uses for user messages — but designed to be
 * called from any plugin that posts user-submitted content to Discord
 * (track titles, artist names, battle entries, etc.).
 *
 * Usage:
 *   const censor = new WordCensor(db);
 *   const safeLine = await censor.clean(guildId, rawTitle);
 */
export class WordCensor {
    constructor(private db: PrismaClient) {}

    /**
     * Replace filtered words in `text` using the guild's word filter config.
     * Returns the censored string (unchanged if nothing matched or filter disabled).
     */
    async clean(guildId: string, text: string): Promise<string> {
        if (!text) return text;

        const settings = await this.db.filterSettings.findUnique({
            where: { guildId },
            include: { wordGroups: { include: { words: true } } },
        });

        if (!settings?.enabled || !settings.wordGroups?.length) return text;

        let result = text;

        for (const group of settings.wordGroups) {
            if (!group.enabled) continue;

            const replacement = group.replacementText || (group.useEmoji ? group.replacementEmoji : null) || '****';

            for (const entry of group.words) {
                const escaped = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'gi');
                result = result.replace(regex, replacement);
            }
        }

        return result;
    }
}
