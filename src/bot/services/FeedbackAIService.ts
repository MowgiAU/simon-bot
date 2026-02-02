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
                state: 'DENIED', // Or IGNORE, but DENIED works for "no reward"
                reason: 'Message too short'
            };
        }

        try {
            // 2. Prompt Engineering
            const systemPrompt = `You are a strict music production mentor.
            Analyze the user's message in a feedback thread.
            
            1. Classify as FEEDBACK (technical critique, advice, specific comments on the track) or COMMENT (casual chat, jokes, generic praise like "fire bro").
            2. If FEEDBACK, score it 0-10 based on helpfulness and depth.
            3. Assign status:
               - APPROVED: Good quality feedback (Score 5+).
               - DENIED: Low quality, generic, or just a comment.
               - UNSURE: Borderline, abusive, or hard to determine.

            Respond ONLY with a JSON object.`;

            const userPrompt = `Message: "${text}"`;

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
            
            // Validate schema roughly
            return {
                type: result.type || 'COMMENT',
                score: result.score || 0,
                state: result.state || 'UNSURE',
                reason: result.reason || 'AI Analysis'
            };

        } catch (error) {
            console.error('AI Analysis Error:', error);
            // Fallback Safety
            return {
                type: 'FEEDBACK',
                score: 0,
                state: 'UNSURE', // Default to human review on error
                reason: 'AI Error'
            };
        }
    }
}
