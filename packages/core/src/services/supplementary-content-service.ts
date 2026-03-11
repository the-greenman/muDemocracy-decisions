import { CreateSupplementaryContentSchema } from "@repo/schema";
import type { SupplementaryContent, CreateSupplementaryContent } from "@repo/schema";
import type { ISupplementaryContentRepository } from "../interfaces/i-supplementary-content-repository";

export class SupplementaryContentService {
  constructor(private repository: ISupplementaryContentRepository) {}

  async add(
    meetingId: string,
    body: string,
    options?: {
      label?: string;
      contexts?: string[];
      createdBy?: string;
      sourceType?: string;
    },
  ): Promise<SupplementaryContent> {
    const validatedData = CreateSupplementaryContentSchema.parse({
      meetingId,
      body,
      label: options?.label,
      contexts: options?.contexts ?? [],
      createdBy: options?.createdBy,
      sourceType: options?.sourceType ?? "manual",
    } satisfies CreateSupplementaryContent);

    return this.repository.create(validatedData);
  }

  async listByContext(contextTag: string): Promise<SupplementaryContent[]> {
    if (!contextTag.trim()) {
      throw new Error("Context tag is required");
    }

    return this.repository.findByContext(contextTag);
  }

  async remove(id: string): Promise<void> {
    if (!id.trim()) {
      throw new Error("Supplementary content ID is required");
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new Error("Supplementary content not found");
    }
  }
}
