import { arrayContains, eq } from "drizzle-orm";
import { db } from "../client.js";
import { supplementaryContent } from "../schema.js";
import type { SupplementaryContent, CreateSupplementaryContent } from "@repo/schema";

export class DrizzleSupplementaryContentRepository {
  async create(data: CreateSupplementaryContent): Promise<SupplementaryContent> {
    const [row] = await db
      .insert(supplementaryContent)
      .values({
        meetingId: data.meetingId,
        label: data.label ?? null,
        body: data.body,
        sourceType: data.sourceType,
        contexts: data.contexts,
        createdBy: data.createdBy ?? null,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create supplementary content");
    }

    return this.toSchema(row);
  }

  async findByContext(contextTag: string): Promise<SupplementaryContent[]> {
    const rows = await db
      .select()
      .from(supplementaryContent)
      .where(arrayContains(supplementaryContent.contexts, [contextTag]))
      .orderBy(supplementaryContent.createdAt);

    return rows.map((row) => this.toSchema(row));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await db
      .delete(supplementaryContent)
      .where(eq(supplementaryContent.id, id))
      .returning();

    return rows.length > 0;
  }

  private toSchema(row: typeof supplementaryContent.$inferSelect): SupplementaryContent {
    return {
      id: row.id,
      meetingId: row.meetingId,
      label: row.label ?? undefined,
      body: row.body,
      sourceType: row.sourceType,
      contexts: row.contexts,
      createdBy: row.createdBy ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
