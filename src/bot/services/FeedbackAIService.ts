import OpenAI from 'openai';

interface FeedbackAnalysisResult {
    type: 'FEEDBACK' | 'COMMENT';
    score: number;
    state: 'APPROVED' | 'DENIED' | 'UNSURE';
    reason: string;
}

export class FeedbackAIService {
    private openai: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = 'gpt-4o-mini') {
        this.openai = new OpenAI({ apiKey });
        this.model = model;
    }

    async analyzeFeedback(text: string): Promise<FeedbackAnalysisResult> {
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
            const systemPrompt = `You are a moderator for a music production feedback community.
Analyze a reply posted inside a feedback thread to decide if it deserves a coin reward.

First, classify the message:
- FEEDBACK: Contains specific, technical, or actionable commentary about music production (mixing, arrangement, sound design, composition, performance, mastering, etc.).
- COMMENT: Casual chat, hype reactions, question without substance, off-topic content, generic praise.

Then assign a state:
- APPROVED: Genuine FEEDBACK with specificity or helpfulness. Score ≥ 5. Reward the user.
- DENIED: Generic reactions ("fire 🔥", "W", "love this", "banger"), one-liners, vague encouragement, pure emojis, spam, unrelated chat, questions that don't critique the track. Do NOT reward.
- UNSURE: Reserve ONLY for messages that look like genuine detailed feedback but contain something problematic (harassment, suspected manipulation, or unclear language that could go either way). This should be rare. When in doubt between DENIED and UNSURE, always choose DENIED.

Respond ONLY with valid JSON: {"type":"FEEDBACK"|"COMMENT","score":0-10,"state":"APPROVED"|"DENIED"|"UNSURE","reason":"brief explanation"}`;

            const userPrompt = `Message: "${text.slice(0, 800)}"`;

            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: this.model,
                temperature: 0,
                response_format: { type: 'json_object' }
            });

            const content = completion.choices[0].message.content;
            if (!content) throw new Error('Empty AI response');

            const result = JSON.parse(content);
            
            return {
                type: result.type || 'COMMENT',
                score: result.score || 0,
                state: result.state || 'DENIED',
                reason: result.reason || 'AI Analysis'
            };

        } catch (error) {
            console.error('AI Analysis Error:', error);
            // Fallback: queue for human review on AI error
            return {
                type: 'FEEDBACK',
                score: 0,
                state: 'UNSURE',
                reason: 'AI Error'
            };
        }
    }
}
