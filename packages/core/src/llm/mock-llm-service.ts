import type {
  ILLMService,
  GenerateDraftParams,
  RegenerateFieldParams,
  DraftResult,
} from "./i-llm-service";

/**
 * Deterministic mock LLM service for unit tests.
 * Returns canned responses without making any real API calls.
 */
export class MockLLMService implements ILLMService {
  private draftResponse: DraftResult;
  private fieldResponses: Map<string, string>;

  constructor(
    options: {
      draftResponse?: DraftResult;
      fieldResponses?: Record<string, string>;
    } = {},
  ) {
    this.draftResponse = options.draftResponse ?? {};
    this.fieldResponses = new Map(Object.entries(options.fieldResponses ?? {}));
  }

  async generateDraft(params: GenerateDraftParams): Promise<DraftResult> {
    const result: DraftResult = {};
    for (const field of params.templateFields) {
      result[field.id] = this.draftResponse[field.id] ?? `Mock value for ${field.name}`;
    }
    return result;
  }

  async regenerateField(params: RegenerateFieldParams): Promise<string> {
    return (
      this.fieldResponses.get(params.fieldId) ?? `Mock regenerated value for ${params.fieldId}`
    );
  }

  /**
   * Override the draft response for a specific field (useful in test setup).
   */
  setFieldResponse(fieldId: string, value: string): void {
    this.fieldResponses.set(fieldId, value);
  }

  /**
   * Override the entire draft response.
   */
  setDraftResponse(response: DraftResult): void {
    this.draftResponse = response;
  }
}
