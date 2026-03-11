import type { CreateLLMInteraction, LLMInteraction } from "@repo/schema";

export interface ILLMInteractionRepository {
  create(data: CreateLLMInteraction): Promise<LLMInteraction>;
  findByDecisionContext(decisionContextId: string): Promise<LLMInteraction[]>;
  findByField(decisionContextId: string, fieldId: string): Promise<LLMInteraction[]>;
}
