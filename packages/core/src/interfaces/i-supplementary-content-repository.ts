import type { SupplementaryContent, CreateSupplementaryContent } from "@repo/schema";

export interface ISupplementaryContentRepository {
  create(data: CreateSupplementaryContent): Promise<SupplementaryContent>;
  findByContext(contextTag: string): Promise<SupplementaryContent[]>;
  delete(id: string): Promise<boolean>;
}
