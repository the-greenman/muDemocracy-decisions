import type { LLMInteraction, CreateLLMInteraction } from '@repo/schema';
export declare class DrizzleLLMInteractionRepository {
    create(data: CreateLLMInteraction): Promise<LLMInteraction>;
    findByDecisionContext(decisionContextId: string): Promise<LLMInteraction[]>;
    findByField(decisionContextId: string, fieldId: string): Promise<LLMInteraction[]>;
    private toSchema;
}
