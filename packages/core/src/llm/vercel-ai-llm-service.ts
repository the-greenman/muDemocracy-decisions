import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { z } from "@repo/schema";
import type {
  ILLMService,
  GenerateDraftParams,
  RegenerateFieldParams,
  DraftResult,
} from "./i-llm-service";

function getModel() {
  const provider = process.env["LLM_PROVIDER"] ?? "anthropic";
  const modelId = process.env["LLM_MODEL"] ?? "claude-opus-4-5";

  if (provider === "openai") {
    return openai(modelId);
  }
  return anthropic(modelId);
}

/**
 * LLM service backed by the Vercel AI SDK.
 * Provider and model are runtime-configurable via LLM_PROVIDER and LLM_MODEL env vars.
 */
export class VercelAILLMService implements ILLMService {
  async generateDraft(params: GenerateDraftParams): Promise<DraftResult> {
    const fieldShape = this.buildFieldShape(params.templateFields.map((f) => f.id));
    const schema = z.object({
      ...fieldShape,
      suggestedTags: z
        .array(z.string())
        .describe(
          "3-7 short lowercase subject tags that characterise this decision, suitable for search and categorisation. Examples: 'security', 'architecture', 'compliance', 'budget', 'infrastructure'.",
        ),
    });
    const prompt = params.promptText ?? "";

    const { object } = await generateObject({
      model: getModel(),
      schema,
      prompt,
    });

    const { suggestedTags, ...fieldValues } = object;
    return {
      fields: fieldValues as Record<string, string>,
      suggestedTags: suggestedTags ?? [],
    };
  }

  async regenerateField(params: RegenerateFieldParams): Promise<string> {
    const field = params.templateFields.find((f) => f.id === params.fieldId);
    if (!field) {
      throw new Error(`Field ${params.fieldId} not found in template fields`);
    }

    const prompt = params.promptText ?? "";

    const { object } = await generateObject({
      model: getModel(),
      schema: z.object({
        [params.fieldId]: z.string().describe(field.description),
      }),
      prompt,
    });

    return (object as Record<string, string>)[params.fieldId] ?? "";
  }

  private buildFieldShape(fieldIds: string[]): Record<string, z.ZodString> {
    const shape: Record<string, z.ZodString> = {};
    for (const id of fieldIds) {
      shape[id] = z.string();
    }
    return shape;
  }
}
