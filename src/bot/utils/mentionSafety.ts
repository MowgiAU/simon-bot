/**
 * Belt-and-suspenders guarantee that the bot can never be tricked into pinging
 * @everyone/@here/roles/users through any reply that echoes user-controlled text.
 *
 * The Client-level `allowedMentions` default (set on every `new Client(...)` in this
 * codebase) is *supposed* to cover every outgoing message per discord.js's own
 * MessagePayload resolution — but that was verified live to still let pings through
 * on interaction replies (e.g. `/radio queue @everyone` → "No track found matching
 * \"@everyone\"" still pinged). Rather than keep chasing why the built-in fallback
 * isn't taking effect for every call shape, this patches the actual send/reply
 * methods plugin code calls directly, so every outgoing message is force-defaulted
 * to no-mentions *at the call site itself* — no inheritance chain to get wrong.
 *
 * A call that explicitly sets its own `allowedMentions` (the many legitimate ticket/
 * level-up/birthday/etc. pings added alongside this) is left untouched — this only
 * fills in the gap when nothing was specified.
 */
import {
    CommandInteraction,
    MessageComponentInteraction,
    ModalSubmitInteraction,
    Message,
    BaseGuildTextChannel,
    BaseGuildVoiceChannel,
    ThreadChannel,
    ThreadOnlyChannel,
    Webhook,
} from 'discord.js';

const SAFE_DEFAULT = { parse: [] as const, repliedUser: false };

function withSafeMentions(options: any): any {
    if (options === undefined) return options;
    if (typeof options === 'string') {
        return { content: options, allowedMentions: SAFE_DEFAULT };
    }
    if (options && typeof options === 'object' && !('allowedMentions' in options)) {
        return { ...options, allowedMentions: SAFE_DEFAULT };
    }
    return options;
}

/** Patches a single-argument method: `fn(optionsOrString)`. */
function patchSingleArg(proto: any, method: string): void {
    const original = proto?.[method];
    if (typeof original !== 'function' || (original as any).__mentionSafetyPatched) return;
    const patched = function (this: any, options?: any, ...rest: any[]) {
        return original.call(this, withSafeMentions(options), ...rest);
    };
    (patched as any).__mentionSafetyPatched = true;
    proto[method] = patched;
}

/** Patches a two-argument method where the payload is the second arg: `fn(target, optionsOrString)`. */
function patchSecondArg(proto: any, method: string): void {
    const original = proto?.[method];
    if (typeof original !== 'function' || (original as any).__mentionSafetyPatched) return;
    const patched = function (this: any, target: any, options?: any, ...rest: any[]) {
        return original.call(this, target, withSafeMentions(options), ...rest);
    };
    (patched as any).__mentionSafetyPatched = true;
    proto[method] = patched;
}

export function installMentionSafetyPatches(): number {
    let count = 0;
    const single = (proto: any, method: string) => {
        const before = proto?.[method];
        patchSingleArg(proto, method);
        if (proto?.[method] !== before) count++;
    };
    const second = (proto: any, method: string) => {
        const before = proto?.[method];
        patchSecondArg(proto, method);
        if (proto?.[method] !== before) count++;
    };

    // Slash / context-menu command interactions
    for (const m of ['reply', 'editReply', 'followUp']) single(CommandInteraction.prototype, m);
    // Buttons / select menus
    for (const m of ['reply', 'editReply', 'followUp', 'update']) single(MessageComponentInteraction.prototype, m);
    // Modals
    for (const m of ['reply', 'editReply', 'followUp', 'update']) single(ModalSubmitInteraction.prototype, m);

    // Plain messages / channels
    single(Message.prototype, 'reply');
    single(BaseGuildTextChannel.prototype, 'send'); // TextChannel, NewsChannel
    single(BaseGuildVoiceChannel.prototype, 'send'); // VoiceChannel, StageChannel
    single(ThreadChannel.prototype, 'send');
    single(ThreadOnlyChannel.prototype, 'send'); // Forum/media channel starter threads

    // Webhooks (word-filter repost, bot-messenger, etc.)
    single(Webhook.prototype, 'send');
    second(Webhook.prototype, 'editMessage');

    return count;
}
