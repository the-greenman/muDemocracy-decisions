/**
 * Drizzle implementation of Decision Field Repository
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { decisionFields } from "../schema.js";
import type { DecisionField, CreateDecisionField } from "@repo/schema";

type DecisionFieldIdentityLookup = {
  namespace?: string;
  name: string;
  version?: number;
};

// Interface definition to avoid circular dependency
interface IDecisionFieldRepository {
  create(data: CreateDecisionField): Promise<DecisionField>;
  findAll(): Promise<DecisionField[]>;
  findById(id: string): Promise<DecisionField | null>;
  findByIdentity(identity: DecisionFieldIdentityLookup): Promise<DecisionField | null>;
  findByCategory(category: string): Promise<DecisionField[]>;
  findByType(type: string): Promise<DecisionField[]>;
  update(id: string, data: Partial<CreateDecisionField>): Promise<DecisionField | null>;
  delete(id: string): Promise<boolean>;
}

function toDecisionFieldInsert(data: CreateDecisionField): typeof decisionFields.$inferInsert {
  return {
    namespace: data.namespace,
    name: data.name,
    description: data.description,
    category: data.category,
    extractionPrompt: data.extractionPrompt,
    fieldType: data.fieldType,
    placeholder: data.placeholder ?? null,
    ...(data.instructions !== undefined ? { instructions: data.instructions } : {}),
    ...(data.validationRules !== undefined ? { validationRules: data.validationRules } : {}),
  };
}

function toDecisionFieldUpdate(data: Partial<CreateDecisionField>): Partial<typeof decisionFields.$inferInsert> {
  return {
    ...(data.namespace !== undefined ? { namespace: data.namespace } : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.extractionPrompt !== undefined ? { extractionPrompt: data.extractionPrompt } : {}),
    ...(data.fieldType !== undefined ? { fieldType: data.fieldType } : {}),
    ...(data.placeholder !== undefined ? { placeholder: data.placeholder ?? null } : {}),
    ...(data.instructions !== undefined ? { instructions: data.instructions } : {}),
    ...(data.validationRules !== undefined ? { validationRules: data.validationRules } : {}),
  };
}

export class DrizzleDecisionFieldRepository implements IDecisionFieldRepository {
  async create(data: CreateDecisionField): Promise<DecisionField> {
    const [row] = await db
      .insert(decisionFields)
      .values(toDecisionFieldInsert(data))
      .returning();

    return this.mapToSchema(row);
  }

  async findById(id: string): Promise<DecisionField | null> {
    const [row] = await db.select().from(decisionFields).where(eq(decisionFields.id, id)).limit(1);

    return row ? this.mapToSchema(row) : null;
  }

  async findByIdentity(identity: DecisionFieldIdentityLookup): Promise<DecisionField | null> {
    const [row] = await db
      .select()
      .from(decisionFields)
      .where(
        and(
          eq(decisionFields.namespace, identity.namespace ?? "core"),
          eq(decisionFields.name, identity.name),
          eq(decisionFields.version, identity.version ?? 1),
        ),
      )
      .limit(1);

    return row ? this.mapToSchema(row) : null;
  }

  async findAll(): Promise<DecisionField[]> {
    const rows = await db
      .select()
      .from(decisionFields)
      .orderBy(decisionFields.category, decisionFields.name);

    return rows.map((row) => this.mapToSchema(row));
  }

  async findByCategory(category: string): Promise<DecisionField[]> {
    const rows = await db
      .select()
      .from(decisionFields)
      .where(eq(decisionFields.category, category as any))
      .orderBy(decisionFields.name);

    return rows.map((row) => this.mapToSchema(row));
  }

  async update(id: string, data: Partial<CreateDecisionField>): Promise<DecisionField | null> {
    const updateData = toDecisionFieldUpdate(data);

    const [row] = await db
      .update(decisionFields)
      .set(updateData)
      .where(eq(decisionFields.id, id))
      .returning();

    return row ? this.mapToSchema(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(decisionFields).where(eq(decisionFields.id, id)).returning();

    return result.length > 0;
  }

  async createMany(fields: CreateDecisionField[]): Promise<DecisionField[]> {
    const rows = await db
      .insert(decisionFields)
      .values(fields.map((field) => toDecisionFieldInsert(field)))
      .returning();

    return rows.map((row) => this.mapToSchema(row));
  }

  async search(query: string): Promise<DecisionField[]> {
    const rows = await db
      .select()
      .from(decisionFields)
      .where(
        sql`CAST(${decisionFields.name} AS TEXT) ILIKE ${"%" + query + "%"} OR 
             CAST(${decisionFields.description} AS TEXT) ILIKE ${"%" + query + "%"} OR
             CAST(${decisionFields.category} AS TEXT) ILIKE ${"%" + query + "%"}`,
      )
      .orderBy(decisionFields.category, decisionFields.name);

    return rows.map((row) => this.mapToSchema(row));
  }

  async findByType(type: string): Promise<DecisionField[]> {
    const rows = await db
      .select()
      .from(decisionFields)
      .where(eq(decisionFields.fieldType, type as any))
      .orderBy(decisionFields.category, decisionFields.name);

    return rows.map((row) => this.mapToSchema(row));
  }

  private mapToSchema(row: any): DecisionField {
    return {
      id: row.id,
      namespace: row.namespace,
      name: row.name,
      description: row.description,
      category: row.category,
      extractionPrompt: row.extractionPrompt,
      instructions: row.instructions ?? undefined,
      fieldType: row.fieldType,
      placeholder: row.placeholder,
      validationRules: row.validationRules,
      version: row.version,
      isCustom: row.isCustom,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
