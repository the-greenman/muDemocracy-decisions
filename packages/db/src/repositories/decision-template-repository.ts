/**
 * Drizzle Implementation of Decision Template Repository
 */

import {
  decisionTemplates,
  exportTemplateFieldAssignments,
  exportTemplates,
  templateFieldAssignments,
  type DecisionTemplateSelect,
  type ExportTemplateFieldAssignmentInsert,
  type ExportTemplateFieldAssignmentSelect,
  type ExportTemplateSelect,
  type TemplateFieldAssignmentSelect,
  type TemplateFieldAssignmentInsert,
} from "../schema.js";
import { db } from "../client.js";
import { eq, and, ilike, asc, inArray } from "drizzle-orm";
import type {
  DecisionTemplate,
  ExportTemplate,
  ExportTemplateFieldAssignment,
  CreateDecisionTemplate,
  CreateExportTemplate,
  TemplateFieldAssignment,
} from "@repo/schema";

type DecisionTemplateIdentityLookup = {
  namespace?: string;
  name: string;
  version?: number;
};

type DefinitionLineageInput = CreateExportTemplate["lineage"];
type DefinitionProvenanceInput = CreateExportTemplate["provenance"];

function sanitizeDefinitionLineage(lineage: DefinitionLineageInput) {
  if (!lineage) return undefined;

  const sanitized = {
    ...(lineage.sourceDefinitionId !== undefined
      ? { sourceDefinitionId: lineage.sourceDefinitionId }
      : {}),
    ...(lineage.sourceVersion !== undefined ? { sourceVersion: lineage.sourceVersion } : {}),
    ...(lineage.forkedFromDefinitionId !== undefined
      ? { forkedFromDefinitionId: lineage.forkedFromDefinitionId }
      : {}),
    ...(lineage.forkedFromVersion !== undefined
      ? { forkedFromVersion: lineage.forkedFromVersion }
      : {}),
  };

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeDefinitionProvenance(provenance: DefinitionProvenanceInput) {
  if (!provenance) return undefined;

  const sanitized = {
    ...(provenance.publisher !== undefined ? { publisher: provenance.publisher } : {}),
    ...(provenance.sourcePackage !== undefined
      ? { sourcePackage: provenance.sourcePackage }
      : {}),
    ...(provenance.importedAt !== undefined ? { importedAt: provenance.importedAt } : {}),
  };

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

// Interface definitions to avoid circular dependency
interface IDecisionTemplateRepository {
  create(data: CreateDecisionTemplate): Promise<DecisionTemplate>;
  findById(id: string): Promise<DecisionTemplate | null>;
  findByIdentity(identity: DecisionTemplateIdentityLookup): Promise<DecisionTemplate | null>;
  findAll(): Promise<DecisionTemplate[]>;
  findByCategory(category: string): Promise<DecisionTemplate[]>;
  findDefault(): Promise<DecisionTemplate | null>;
  update(id: string, data: Partial<CreateDecisionTemplate>): Promise<DecisionTemplate | null>;
  delete(id: string): Promise<boolean>;
  setDefault(id: string): Promise<DecisionTemplate>;
  search(query: string): Promise<DecisionTemplate[]>;
}

// Use the actual database insert type for the interface
interface ITemplateFieldAssignmentRepository {
  create(data: TemplateFieldAssignmentInsert): Promise<TemplateFieldAssignment>;
  createMany(data: TemplateFieldAssignmentInsert[]): Promise<TemplateFieldAssignment[]>;
  findByTemplate(templateId: string): Promise<TemplateFieldAssignment[]>;
  findByField(fieldId: string): Promise<TemplateFieldAssignment[]>;
  update(
    templateId: string,
    fieldId: string,
    data: Partial<TemplateFieldAssignmentInsert>,
  ): Promise<TemplateFieldAssignment | null>;
  delete(templateId: string, fieldId: string): Promise<boolean>;
  deleteByTemplate(templateId: string): Promise<boolean>;
}

interface IExportTemplateRepository {
  create(data: CreateExportTemplate): Promise<ExportTemplate>;
  findById(id: string): Promise<ExportTemplate | null>;
  findByDeliberationTemplateId(deliberationTemplateId: string): Promise<ExportTemplate[]>;
  findDefaultByDeliberationTemplateId(deliberationTemplateId: string): Promise<ExportTemplate | null>;
}

interface IExportTemplateFieldAssignmentRepository {
  create(data: ExportTemplateFieldAssignmentInsert): Promise<ExportTemplateFieldAssignment>;
  findByExportTemplateId(exportTemplateId: string): Promise<ExportTemplateFieldAssignment[]>;
}

function toDecisionTemplateInsert(
  data: CreateDecisionTemplate,
): typeof decisionTemplates.$inferInsert {
  return {
    namespace: data.namespace,
    name: data.name,
    description: data.description,
    category: data.category,
    ...(data.promptTemplate !== undefined ? { promptTemplate: data.promptTemplate } : {}),
  };
}

function toDecisionTemplateUpdate(
  data: Partial<CreateDecisionTemplate>,
): Partial<typeof decisionTemplates.$inferInsert> {
  return {
    ...(data.namespace !== undefined ? { namespace: data.namespace } : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.promptTemplate !== undefined ? { promptTemplate: data.promptTemplate } : {}),
  };
}

function toExportTemplateInsert(data: CreateExportTemplate): typeof exportTemplates.$inferInsert {
  const lineage = sanitizeDefinitionLineage(data.lineage);
  const provenance = sanitizeDefinitionProvenance(data.provenance);

  return {
    deliberationTemplateId: data.deliberationTemplateId,
    namespace: data.namespace,
    name: data.name,
    description: data.description,
    ...(lineage !== undefined ? { lineage } : {}),
    ...(provenance !== undefined ? { provenance } : {}),
  };
}

export class DrizzleDecisionTemplateRepository implements IDecisionTemplateRepository {
  private mapToSchema(
    row: DecisionTemplateSelect & { fields?: TemplateFieldAssignment[] },
  ): DecisionTemplate {
    return {
      id: row.id,
      namespace: row.namespace,
      name: row.name,
      description: row.description,
      category: row.category,
      fields: row.fields || [],
      version: row.version,
      isDefault: row.isDefault,
      isCustom: row.isCustom,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapFieldAssignmentToSchema(row: TemplateFieldAssignmentSelect): TemplateFieldAssignment {
    return {
      id: row.id,
      fieldId: row.fieldId,
      templateId: row.templateId,
      order: row.order,
      required: row.required,
    };
  }

  async create(data: CreateDecisionTemplate): Promise<DecisionTemplate> {
    const [row] = await db.insert(decisionTemplates).values(toDecisionTemplateInsert(data)).returning();

    if (!row) {
      throw new Error("Failed to create template");
    }

    return this.mapToSchema(row);
  }

  async findById(id: string): Promise<DecisionTemplate | null> {
    const [row] = await db
      .select()
      .from(decisionTemplates)
      .where(eq(decisionTemplates.id, id))
      .limit(1);

    if (!row) return null;

    // Get field assignments
    const fields = await db
      .select()
      .from(templateFieldAssignments)
      .where(eq(templateFieldAssignments.templateId, id))
      .orderBy(asc(templateFieldAssignments.order));

    return this.mapToSchema({ ...row, fields });
  }

  async findByIdentity(identity: DecisionTemplateIdentityLookup): Promise<DecisionTemplate | null> {
    const [row] = await db
      .select()
      .from(decisionTemplates)
      .where(
        and(
          eq(decisionTemplates.namespace, identity.namespace ?? "core"),
          eq(decisionTemplates.name, identity.name),
          eq(decisionTemplates.version, identity.version ?? 1),
        ),
      )
      .limit(1);

    if (!row) return null;

    const fields = await db
      .select()
      .from(templateFieldAssignments)
      .where(eq(templateFieldAssignments.templateId, row.id))
      .orderBy(asc(templateFieldAssignments.order));

    return this.mapToSchema({
      ...row,
      fields: fields.map((f) => this.mapFieldAssignmentToSchema(f)),
    });
  }

  async findAll(): Promise<DecisionTemplate[]> {
    const rows = await db
      .select()
      .from(decisionTemplates)
      .orderBy(asc(decisionTemplates.category), asc(decisionTemplates.name));

    // Get all field assignments for all templates
    const allFields = await db
      .select()
      .from(templateFieldAssignments)
      .orderBy(asc(templateFieldAssignments.templateId), asc(templateFieldAssignments.order));

    // Group fields by template
    const fieldsByTemplate = allFields.reduce(
      (acc, field) => {
        const templateFields = acc[field.templateId] ?? [];
        templateFields.push(this.mapFieldAssignmentToSchema(field));
        acc[field.templateId] = templateFields;
        return acc;
      },
      {} as Record<string, TemplateFieldAssignment[]>,
    );

    return rows.map((row) => this.mapToSchema({ ...row, fields: fieldsByTemplate[row.id] || [] }));
  }

  async findDefault(): Promise<DecisionTemplate | null> {
    const [row] = await db
      .select()
      .from(decisionTemplates)
      .where(eq(decisionTemplates.isDefault, true))
      .limit(1);

    if (!row) return null;

    const fields = await db
      .select()
      .from(templateFieldAssignments)
      .where(eq(templateFieldAssignments.templateId, row.id))
      .orderBy(asc(templateFieldAssignments.order));

    return this.mapToSchema({
      ...row,
      fields: fields.map((f) => this.mapFieldAssignmentToSchema(f)),
    });
  }

  async setDefault(id: string): Promise<DecisionTemplate> {
    // Start transaction to unset current default and set new one
    const result = await db.transaction(async (tx) => {
      // Unset all existing defaults
      await tx
        .update(decisionTemplates)
        .set({ isDefault: false })
        .where(eq(decisionTemplates.isDefault, true));

      // Set new default
      const rows = await tx
        .update(decisionTemplates)
        .set({ isDefault: true })
        .where(eq(decisionTemplates.id, id))
        .returning();

      return rows[0];
    });

    if (!result) {
      throw new Error("Template not found");
    }

    // Fetch fields for the updated template
    const fields = await db
      .select()
      .from(templateFieldAssignments)
      .where(eq(templateFieldAssignments.templateId, result.id))
      .orderBy(asc(templateFieldAssignments.order));

    return this.mapToSchema({
      ...result,
      fields: fields.map((f) => this.mapFieldAssignmentToSchema(f)),
    });
  }

  async update(
    id: string,
    data: Partial<CreateDecisionTemplate>,
  ): Promise<DecisionTemplate | null> {
    const [row] = await db
      .update(decisionTemplates)
      .set(toDecisionTemplateUpdate(data))
      .where(eq(decisionTemplates.id, id))
      .returning();

    if (!row) return null;

    const fields = await db
      .select()
      .from(templateFieldAssignments)
      .where(eq(templateFieldAssignments.templateId, id))
      .orderBy(asc(templateFieldAssignments.order));

    return this.mapToSchema({
      ...row,
      fields: fields.map((f) => this.mapFieldAssignmentToSchema(f)),
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(decisionTemplates)
      .where(eq(decisionTemplates.id, id))
      .returning();

    return result.length > 0;
  }

  async findByCategory(category: string): Promise<DecisionTemplate[]> {
    const rows = await db
      .select()
      .from(decisionTemplates)
      .where(eq(decisionTemplates.category, category as any))
      .orderBy(asc(decisionTemplates.name));

    // Get field assignments for these templates
    const templateIds = rows.map((r) => r.id);
    const fields = await db
      .select()
      .from(templateFieldAssignments)
      .where(inArray(templateFieldAssignments.templateId, templateIds))
      .orderBy(asc(templateFieldAssignments.templateId), asc(templateFieldAssignments.order));

    const fieldsByTemplate = fields.reduce(
      (acc, field) => {
        const templateFields = acc[field.templateId] ?? [];
        templateFields.push(this.mapFieldAssignmentToSchema(field));
        acc[field.templateId] = templateFields;
        return acc;
      },
      {} as Record<string, TemplateFieldAssignment[]>,
    );

    return rows.map((row) => this.mapToSchema({ ...row, fields: fieldsByTemplate[row.id] || [] }));
  }

  async findByName(name: string): Promise<DecisionTemplate | null> {
    const [row] = await db
      .select()
      .from(decisionTemplates)
      .where(eq(decisionTemplates.name, name))
      .limit(1);

    if (!row) return null;

    const fields = await db
      .select()
      .from(templateFieldAssignments)
      .where(eq(templateFieldAssignments.templateId, row.id))
      .orderBy(asc(templateFieldAssignments.order));

    return this.mapToSchema({
      ...row,
      fields: fields.map((f) => this.mapFieldAssignmentToSchema(f)),
    });
  }

  async search(query: string): Promise<DecisionTemplate[]> {
    const rows = await db
      .select()
      .from(decisionTemplates)
      .where(ilike(decisionTemplates.name, `%${query}%`))
      .orderBy(asc(decisionTemplates.name));

    // Get field assignments
    const templateIds = rows.map((r) => r.id);
    const fields =
      templateIds.length > 0
        ? await db
            .select()
            .from(templateFieldAssignments)
            .where(inArray(templateFieldAssignments.templateId, templateIds))
            .orderBy(asc(templateFieldAssignments.templateId), asc(templateFieldAssignments.order))
        : [];

    const fieldsByTemplate = fields.reduce(
      (acc, field) => {
        const templateFields = acc[field.templateId] ?? [];
        templateFields.push(this.mapFieldAssignmentToSchema(field));
        acc[field.templateId] = templateFields;
        return acc;
      },
      {} as Record<string, TemplateFieldAssignment[]>,
    );

    return rows.map((row) => this.mapToSchema({ ...row, fields: fieldsByTemplate[row.id] || [] }));
  }

  async createMany(templates: CreateDecisionTemplate[]): Promise<DecisionTemplate[]> {
    const rows = await db
      .insert(decisionTemplates)
      .values(templates.map((template) => toDecisionTemplateInsert(template)))
      .returning();

    return rows.map((row) => this.mapToSchema(row));
  }
}

export class DrizzleTemplateFieldAssignmentRepository
  implements ITemplateFieldAssignmentRepository
{
  private mapFieldAssignmentToSchema(row: TemplateFieldAssignmentSelect): TemplateFieldAssignment {
    return {
      id: row.id,
      fieldId: row.fieldId,
      templateId: row.templateId,
      order: row.order,
      required: row.required,
    };
  }

  async create(data: TemplateFieldAssignmentInsert): Promise<TemplateFieldAssignment> {
    const [row] = await db.insert(templateFieldAssignments).values(data).returning();

    if (!row) {
      throw new Error("Failed to create template field assignment");
    }

    return this.mapFieldAssignmentToSchema(row);
  }

  async findByTemplateId(templateId: string): Promise<TemplateFieldAssignment[]> {
    return this.findByTemplate(templateId);
  }

  async findByTemplate(templateId: string): Promise<TemplateFieldAssignment[]> {
    const rows = await db
      .select()
      .from(templateFieldAssignments)
      .where(eq(templateFieldAssignments.templateId, templateId))
      .orderBy(asc(templateFieldAssignments.order));

    return rows.map((row) => this.mapFieldAssignmentToSchema(row));
  }

  async findByFieldId(fieldId: string): Promise<TemplateFieldAssignment[]> {
    return this.findByField(fieldId);
  }

  async findByField(fieldId: string): Promise<TemplateFieldAssignment[]> {
    const rows = await db
      .select()
      .from(templateFieldAssignments)
      .where(eq(templateFieldAssignments.fieldId, fieldId))
      .orderBy(asc(templateFieldAssignments.templateId), asc(templateFieldAssignments.order));

    return rows.map((row) => this.mapFieldAssignmentToSchema(row));
  }

  async update(
    templateId: string,
    fieldId: string,
    data: Partial<TemplateFieldAssignmentInsert>,
  ): Promise<TemplateFieldAssignment | null> {
    const [row] = await db
      .update(templateFieldAssignments)
      .set(data)
      .where(
        and(
          eq(templateFieldAssignments.templateId, templateId),
          eq(templateFieldAssignments.fieldId, fieldId),
        ),
      )
      .returning();

    return row ? this.mapFieldAssignmentToSchema(row) : null;
  }

  async delete(templateId: string, fieldId: string): Promise<boolean> {
    const result = await db
      .delete(templateFieldAssignments)
      .where(
        and(
          eq(templateFieldAssignments.templateId, templateId),
          eq(templateFieldAssignments.fieldId, fieldId),
        ),
      )
      .returning();

    return result.length > 0;
  }

  async deleteByTemplateId(templateId: string): Promise<boolean> {
    return this.deleteByTemplate(templateId);
  }

  async deleteByTemplate(templateId: string): Promise<boolean> {
    const result = await db
      .delete(templateFieldAssignments)
      .where(eq(templateFieldAssignments.templateId, templateId))
      .returning();

    return result.length > 0;
  }

  async createMany(
    assignments: TemplateFieldAssignmentInsert[],
  ): Promise<TemplateFieldAssignment[]> {
    const rows = await db.insert(templateFieldAssignments).values(assignments).returning();

    return rows.map((row) => this.mapFieldAssignmentToSchema(row));
  }

  async updateOrder(
    templateId: string,
    assignments: { fieldId: string; order: number }[],
  ): Promise<void> {
    await db.transaction(async (tx) => {
      for (const { fieldId, order } of assignments) {
        await tx
          .update(templateFieldAssignments)
          .set({ order })
          .where(
            and(
              eq(templateFieldAssignments.templateId, templateId),
              eq(templateFieldAssignments.fieldId, fieldId),
            ),
          );
      }
    });
  }
}

export class DrizzleExportTemplateRepository implements IExportTemplateRepository {
  private mapFieldAssignmentToSchema(
    row: ExportTemplateFieldAssignmentSelect,
  ): ExportTemplateFieldAssignment {
    return {
      id: row.id,
      exportTemplateId: row.exportTemplateId,
      fieldId: row.fieldId,
      order: row.order,
      ...(row.title !== null ? { title: row.title } : {}),
    };
  }

  private mapToSchema(
    row: ExportTemplateSelect & { fields?: ExportTemplateFieldAssignment[] },
  ): ExportTemplate {
    return {
      id: row.id,
      deliberationTemplateId: row.deliberationTemplateId,
      namespace: row.namespace,
      name: row.name,
      description: row.description,
      fields: row.fields || [],
      version: row.version,
      isDefault: row.isDefault,
      isCustom: row.isCustom,
      ...(sanitizeDefinitionLineage(row.lineage ?? undefined) !== undefined
        ? { lineage: sanitizeDefinitionLineage(row.lineage ?? undefined) }
        : {}),
      ...(sanitizeDefinitionProvenance(row.provenance ?? undefined) !== undefined
        ? { provenance: sanitizeDefinitionProvenance(row.provenance ?? undefined) }
        : {}),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async create(data: CreateExportTemplate): Promise<ExportTemplate> {
    const [row] = await db.insert(exportTemplates).values(toExportTemplateInsert(data)).returning();

    if (!row) {
      throw new Error("Failed to create export template");
    }

    return this.mapToSchema(row);
  }

  async findById(id: string): Promise<ExportTemplate | null> {
    const [row] = await db.select().from(exportTemplates).where(eq(exportTemplates.id, id)).limit(1);

    if (!row) return null;

    const fields = await db
      .select()
      .from(exportTemplateFieldAssignments)
      .where(eq(exportTemplateFieldAssignments.exportTemplateId, id))
      .orderBy(asc(exportTemplateFieldAssignments.order));

    return this.mapToSchema({
      ...row,
      fields: fields.map((field) => this.mapFieldAssignmentToSchema(field)),
    });
  }

  async findByDeliberationTemplateId(deliberationTemplateId: string): Promise<ExportTemplate[]> {
    const rows = await db
      .select()
      .from(exportTemplates)
      .where(eq(exportTemplates.deliberationTemplateId, deliberationTemplateId))
      .orderBy(asc(exportTemplates.name));

    const exportTemplateIds = rows.map((row) => row.id);
    const fields =
      exportTemplateIds.length > 0
        ? await db
            .select()
            .from(exportTemplateFieldAssignments)
            .where(inArray(exportTemplateFieldAssignments.exportTemplateId, exportTemplateIds))
            .orderBy(
              asc(exportTemplateFieldAssignments.exportTemplateId),
              asc(exportTemplateFieldAssignments.order),
            )
        : [];

    const fieldsByTemplate = fields.reduce(
      (acc, field) => {
        const templateFields = acc[field.exportTemplateId] ?? [];
        templateFields.push(this.mapFieldAssignmentToSchema(field));
        acc[field.exportTemplateId] = templateFields;
        return acc;
      },
      {} as Record<string, ExportTemplateFieldAssignment[]>,
    );

    return rows.map((row) => this.mapToSchema({ ...row, fields: fieldsByTemplate[row.id] || [] }));
  }

  async findDefaultByDeliberationTemplateId(
    deliberationTemplateId: string,
  ): Promise<ExportTemplate | null> {
    const [row] = await db
      .select()
      .from(exportTemplates)
      .where(
        and(
          eq(exportTemplates.deliberationTemplateId, deliberationTemplateId),
          eq(exportTemplates.isDefault, true),
        ),
      )
      .limit(1);

    if (!row) return null;

    const fields = await db
      .select()
      .from(exportTemplateFieldAssignments)
      .where(eq(exportTemplateFieldAssignments.exportTemplateId, row.id))
      .orderBy(asc(exportTemplateFieldAssignments.order));

    return this.mapToSchema({
      ...row,
      fields: fields.map((field) => this.mapFieldAssignmentToSchema(field)),
    });
  }
}

export class DrizzleExportTemplateFieldAssignmentRepository
  implements IExportTemplateFieldAssignmentRepository
{
  private mapToSchema(row: ExportTemplateFieldAssignmentSelect): ExportTemplateFieldAssignment {
    return {
      id: row.id,
      exportTemplateId: row.exportTemplateId,
      fieldId: row.fieldId,
      order: row.order,
      ...(row.title !== null ? { title: row.title } : {}),
    };
  }

  async create(data: ExportTemplateFieldAssignmentInsert): Promise<ExportTemplateFieldAssignment> {
    const [row] = await db.insert(exportTemplateFieldAssignments).values(data).returning();

    if (!row) {
      throw new Error("Failed to create export template field assignment");
    }

    return this.mapToSchema(row);
  }

  async findByExportTemplateId(exportTemplateId: string): Promise<ExportTemplateFieldAssignment[]> {
    const rows = await db
      .select()
      .from(exportTemplateFieldAssignments)
      .where(eq(exportTemplateFieldAssignments.exportTemplateId, exportTemplateId))
      .orderBy(asc(exportTemplateFieldAssignments.order));

    return rows.map((row) => this.mapToSchema(row));
  }
}
