/**
 * Drizzle implementation of Decision Field Repository
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { decisionFields } from '../schema';
import type { 
  DecisionField,
  CreateDecisionField
} from '@repo/schema';
import type { DecisionFieldIdentityLookup } from '@repo/core';

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

export class DrizzleDecisionFieldRepository implements IDecisionFieldRepository {
  async create(data: CreateDecisionField): Promise<DecisionField> {
    const [row] = await db
      .insert(decisionFields)
      .values({
        ...data,
        placeholder: data.placeholder || null,
      })
      .returning();

    return this.mapToSchema(row);
  }

  async findById(id: string): Promise<DecisionField | null> {
    const [row] = await db
      .select()
      .from(decisionFields)
      .where(eq(decisionFields.id, id))
      .limit(1);

    return row ? this.mapToSchema(row) : null;
  }

  async findByIdentity(identity: DecisionFieldIdentityLookup): Promise<DecisionField | null> {
    const [row] = await db
      .select()
      .from(decisionFields)
      .where(
        and(
          eq(decisionFields.namespace, identity.namespace ?? 'core'),
          eq(decisionFields.name, identity.name),
          eq(decisionFields.version, identity.version ?? 1)
        )
      )
      .limit(1);

    return row ? this.mapToSchema(row) : null;
  }

  async findAll(): Promise<DecisionField[]> {
    const rows = await db
      .select()
      .from(decisionFields)
      .orderBy(decisionFields.category, decisionFields.name);

    return rows.map(row => this.mapToSchema(row));
  }

  async findByCategory(category: string): Promise<DecisionField[]> {
    const rows = await db
      .select()
      .from(decisionFields)
      .where(eq(decisionFields.category, category as any))
      .orderBy(decisionFields.name);

    return rows.map(row => this.mapToSchema(row));
  }

  async update(id: string, data: Partial<CreateDecisionField>): Promise<DecisionField | null> {
    const updateData: any = { ...data };
    if (data.placeholder !== undefined) {
      updateData.placeholder = data.placeholder || null;
    }
    
    const [row] = await db
      .update(decisionFields)
      .set(updateData)
      .where(eq(decisionFields.id, id))
      .returning();

    return row ? this.mapToSchema(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(decisionFields)
      .where(eq(decisionFields.id, id))
      .returning();

    return result.length > 0;
  }

  async createMany(fields: CreateDecisionField[]): Promise<DecisionField[]> {
    const rows = await db
      .insert(decisionFields)
      .values(
        fields.map(field => ({
          ...field,
          placeholder: field.placeholder || null,
        }))
      )
      .returning();

    return rows.map(row => this.mapToSchema(row));
  }

  async search(query: string): Promise<DecisionField[]> {
    const rows = await db
      .select()
      .from(decisionFields)
      .where(
        sql`CAST(${decisionFields.name} AS TEXT) ILIKE ${'%' + query + '%'} OR 
             CAST(${decisionFields.description} AS TEXT) ILIKE ${'%' + query + '%'} OR
             CAST(${decisionFields.category} AS TEXT) ILIKE ${'%' + query + '%'}`
      )
      .orderBy(decisionFields.category, decisionFields.name);

    return rows.map(row => this.mapToSchema(row));
  }

  async findByType(type: string): Promise<DecisionField[]> {
    const rows = await db
      .select()
      .from(decisionFields)
      .where(eq(decisionFields.fieldType, type as any))
      .orderBy(decisionFields.category, decisionFields.name);

    return rows.map(row => this.mapToSchema(row));
  }

  private mapToSchema(row: any): DecisionField {
    return {
      id: row.id,
      namespace: row.namespace,
      name: row.name,
      description: row.description,
      category: row.category,
      extractionPrompt: row.extractionPrompt,
      fieldType: row.fieldType,
      placeholder: row.placeholder,
      validationRules: row.validationRules,
      version: row.version,
      isCustom: row.isCustom,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
