import OpenAI from 'openai';

interface FeedbackAnalysisResult {
    type: 'FEEDBACK' | 'COMMENT';
    score: number;
    state: 'APPROVED' | 'DENIED' | 'UNSURE';
    reason: string;
}

export interface FeedbackAnalysisContext {
    /** Title of the feedback thread (usually the track name). */
    threadTitle?: string;
    /** Text of the thread starter message — what the OP asked for. */
    threadStarter?: string;
    /** The message this reply was replying to, if any. */
    repliedTo?: string;
    /** Model override (per-guild `FeedbackSettings.aiModel`). */
    model?: string;
}

/** Score at or above which a FEEDBACK post is rewarded automatically. */
const APPROVE_SCORE = 5;
/** Score at or above which a post is sent to staff review instead of being denied. */
const REVIEW_SCORE = 3;

export class FeedbackAIService {
    private openai: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = 'gpt-4o-mini') {
        this.openai = new OpenAI({ apiKey });
        this.model = model;
    }

    async analyzeFeedback(text: string, ctx: FeedbackAnalysisContext = {}): Promise<FeedbackAnalysisResult> {
        // 1. Input Validation
        if (text.length < 10) {
            return {
                type: 'COMMENT',
                score: 0,
                state: 'DENIED',
                reason: 'Message too short'
            };
        }

        // 2. Quick pre-checks before calling AI
        const stripped = text
            .replace(/https?:\/\/\S+/g, '')      // remove URLs
            .replace(/<[^>]+>/g, '')               // remove Discord mentions/channels
            .replace(/[^\w\s]/gu, ' ')             // punctuation → spaces (keep unicode words)
            .trim();
        const wordCount = stripped.split(/\s+/).filter(Boolean).length;
        if (wordCount < 3) {
            return { type: 'COMMENT', score: 0, state: 'DENIED', reason: 'Not enough content' };
        }

        try {
            // 3. Prompt Engineering
            const systemPrompt = `You are a moderator for a music production feedback community. Producers post a track in a thread, and other members reply with feedback. Decide whether a reply earns a coin reward.

Classify the reply:
- FEEDBACK: it tells the producer something useful about THEIR track — a reaction to a specific part, element or section, a critique, a suggested change, a mix/arrangement/sound-design/composition observation, or a considered opinion on what does and doesn't work. It does not have to be long, technical, or negative.
- COMMENT: it says nothing about the track — pure hype, emoji, greetings, off-topic chat, self-promotion, or a question that ignores the track.

Score 0-10 for how useful the reply is to the producer:
- 8-10: detailed, specific, actionable — names elements and suggests changes.
- 5-7: genuinely useful — points at something specific in the track (an element, a section, a transition, the mix, the vocal, the drop) and says something about it, even briefly, even if it is praise. A single specific sentence belongs here.
- 3-4: borderline — some engagement with the track but very vague, or you cannot tell without hearing it.
- 0-2: generic reaction or unrelated chat, no engagement with the track.

Important calibration:
- Length is NOT a criterion. "the snare is way too loud in the second half" is real feedback and scores 5+. Do not penalise a reply for being one line.
- Praise is real feedback when it is specific: "the vocal chop in the drop sits perfectly" scores 5+. Only generic praise ("fire", "banger", "W", "love this") scores 0-2.
- Non-technical wording is fine. Casual language, slang and non-native English must not lower the score if the substance is there.
- Questions count as feedback when they engage with the track ("what did you use for that bass? it's clipping on my headphones"), and do not when they don't ("wanna collab?").
- Replies that build on earlier conversation in the thread are still feedback; use the thread context to judge them.
- Rudeness or blunt criticism is still feedback. Only outright harassment should be refused.

Respond ONLY with valid JSON: {"type":"FEEDBACK"|"COMMENT","score":0-10,"reason":"brief explanation"}`;

            const contextParts: string[] = [];
            if (ctx.threadTitle) contextParts.push(`Thread (track) title: "${ctx.threadTitle}"`);
            if (ctx.threadStarter) contextParts.push(`What the producer posted: "${ctx.threadStarter.slice(0, 600)}"`);
            if (ctx.repliedTo) contextParts.push(`This reply is answering: "${ctx.repliedTo.slice(0, 400)}"`);

            const userPrompt = `${contextParts.length ? contextParts.join('\n') + '\n\n' : ''}Reply to judge: "${text.slice(0, 2000)}"`;

            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: ctx.model || this.model,
                temperature: 0,
                response_format: { type: 'json_object' }
            });

            const content = completion.choices[0].message.content;
            if (!content) throw new Error('Empty AI response');

            const result = JSON.parse(content);

            const type: 'FEEDBACK' | 'COMMENT' = result.type === 'FEEDBACK' ? 'FEEDBACK' : 'COMMENT';
            const rawScore = Number(result.score);
            const score = Number.isFinite(rawScore) ? Math.min(10, Math.max(0, Math.round(rawScore))) : 0;

            // The state is derived from the score here rather than asked for, so a
            // high-scoring reply can never be denied by a contradictory label.
            let state: 'APPROVED' | 'DENIED' | 'UNSURE';
            if (type === 'FEEDBACK' && score >= APPROVE_SCORE) state = 'APPROVED';
            else if (score >= REVIEW_SCORE) state = 'UNSURE';
            else state = 'DENIED';

            return {
                type,
                score,
                state,
                reason: typeof result.reason === 'string' && result.reason ? result.reason : 'AI Analysis'
            };

        } catch (error) {
            // Fallback: queue for human review on AI error
            return {
                type: 'FEEDBACK',
                score: 0,
                state: 'UNSURE',
                reason: `AI Error: ${error instanceof Error ? error.message : 'unknown'}`
            };
        }
    }
}
