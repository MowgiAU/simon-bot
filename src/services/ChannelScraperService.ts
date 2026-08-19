/**
 * Channel Scraper — shared save/normalize logic.
 *
 * Used by BOTH the bot process (real-time capture via ChannelScraperPlugin.onMessageCreate,
 * which sees a live discord.js Message) and the API process (backfill via raw Discord REST
 * calls, which sees a plain JSON message object) — see the plan's architecture note: api and
 * bot are separate processes with no shared memory, so this is the one place their save logic
 * is guaranteed not to drift apart.
 */

export interface CapturableMessage {
    guildId: string;
    channelId: string;
    messageId: string;
    authorId: string;
    authorUsername: string;
    content: string;
    replyToMessageId: string | null;
    attachments: { url: string; filename: string; contentType: string | null }[];
    embeds: any[];
    createdAt: Date;
}

/** Normalizes a live discord.js Message into the shared shape. */
export function extractFromDiscordJsMessage(message: any): CapturableMessage {
    return {
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
        authorId: message.author.id,
        authorUsername: message.author.username,
        content: message.content || '',
        replyToMessageId: message.reference?.messageId || null,
        attachments: [...message.attachments.values()].map((a: any) => ({
            url: a.url, filename: a.name || 'file', contentType: a.contentType || null,
        })),
        embeds: message.embeds.map((e: any) => e.toJSON ? e.toJSON() : e),
        createdAt: new Date(message.createdTimestamp),
    };
}

/** Normalizes a raw Discord REST API message object (GET .../messages) into the shared shape. */
export function extractFromRestMessage(guildId: string, channelId: string, m: any): CapturableMessage {
    return {
        guildId,
        channelId,
        messageId: m.id,
        authorId: m.author?.id || 'unknown',
        authorUsername: m.author?.username || 'unknown',
        content: m.content || '',
        replyToMessageId: m.message_reference?.message_id || null,
        attachments: (m.attachments || []).map((a: any) => ({
            url: a.url, filename: a.filename || 'file', contentType: a.content_type || null,
        })),
        embeds: m.embeds || [],
        createdAt: new Date(m.timestamp),
    };
}

/**
 * Upserts on [channelId, messageId] so a message caught by both backfill and real-time capture
 * (a plausible race right when the feature is turned on, or an overlapping re-run of backfill)
 * never double-writes or throws on the unique constraint.
 */
export async function saveCapturedMessage(db: any, msg: CapturableMessage): Promise<void> {
    await db.capturedMessage.upsert({
        where: { channelId_messageId: { channelId: msg.channelId, messageId: msg.messageId } },
        create: {
            guildId: msg.guildId,
            channelId: msg.channelId,
            messageId: msg.messageId,
            authorId: msg.authorId,
            authorUsername: msg.authorUsername,
            content: msg.content,
            replyToMessageId: msg.replyToMessageId,
            attachments: msg.attachments,
            embeds: msg.embeds,
            createdAt: msg.createdAt,
        },
        update: {
            // Re-captured (e.g. backfill overlapping a live-captured message) — content may
            // have been edited since, so refresh it rather than leaving the stale first copy.
            content: msg.content,
            attachments: msg.attachments,
            embeds: msg.embeds,
        },
    });
}
