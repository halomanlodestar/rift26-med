import type { Recommendation } from './ruleEngine.service';
import type { ClinicalContext } from './llm.service';

export class ContextService {
    /**
     * transform analysis results into a structured context for the LLM.
     */
    public buildContext(
        drug: string,
        result: Recommendation,
        mode: 'patient' | 'expert'
    ): ClinicalContext {
        return {
            drug: drug.toUpperCase(),
            gene: result.gene || 'Unknown',
            phenotype: result.phenotype || 'Unknown',
            variants: result.detected_variant || 'None detected',
            recommendation: result.recommendation || 'Standard dosing',
            risk_level: result.risk_label || 'Low',
            mode: mode
        };
    }
}

export const contextService = new ContextService();
