import Groq from 'groq-sdk';
import { config } from '../config/env';

export interface ClinicalContext {
    drug: string;
    gene: string;
    phenotype: string;
    variants: string;
    recommendation: string;
    risk_level: string;
}

const groq = new Groq({
    apiKey: config.GROQ_API_KEY,
});

export class LlmService {
    private readonly MODEL = 'llama3-70b-8192';
    private readonly TIMEOUT_MS = 8000; // 8 seconds timeout

    /**
     * Generates a clinical pharmacogenomic explanation based on structured context.
     */
    public async generateExplanation(context: ClinicalContext): Promise<string> {
        try {
            const prompt = this.buildPrompt(context);

            const completion = await Promise.race([
                groq.chat.completions.create({
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are a clinical pharmacogenomics explanation assistant. You must only explain based on provided structured context. Do not invent dosing. Do not modify recommendations. Do not hallucinate additional variants. Explain biological mechanism, gene impact on metabolism, and why risk classification applies. Be 4–6 sentences.',
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    model: this.MODEL,
                    temperature: 0.3,
                    max_tokens: 300,
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('LLM Timeout')), this.TIMEOUT_MS)
                ),
            ]);

            // @ts-ignore - Groq types might strict check completion
            // Safe access
            const content = completion.choices[0]?.message?.content;
            return content || 'Explanation temporarily unavailable.';
        } catch (error) {
            console.error('LLM Generation Error:', error);
            return 'Explanation temporarily unavailable due to service disruption.';
        }
    }

    private buildPrompt(context: ClinicalContext): string {
        return `
Drug: ${context.drug}
Gene: ${context.gene}
Phenotype: ${context.phenotype}
Variants: ${context.variants}
Risk Level: ${context.risk_level}
Clinical Recommendation: ${context.recommendation}

Please provide a concise biological explanation for this result.
`;
    }
}

export const llmService = new LlmService();
