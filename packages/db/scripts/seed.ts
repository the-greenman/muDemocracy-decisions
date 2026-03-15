/**
 * Database Seed Script
 *
 * Seeds the database with initial data:
 * - Default decision fields (from src/seed-data/decision-fields.ts)
 * - Standard decision templates (from src/seed-data/decision-templates.ts)
 * - Sample expert templates
 *
 * Re-running this script will upsert fields and templates, applying any content
 * changes made to the seed-data files. Field assignments are insert-only (no updates).
 */

import { db, client } from "../src/client.js";
import { CORE_FIELDS } from "../src/seed-data/decision-fields.js";
import {
  prepareDefaultExportTemplatesForSeeding,
  prepareTemplatesForSeeding,
} from "../src/seed-data/decision-templates.js";
import {
  decisionFields,
  decisionTemplates,
  expertTemplates,
  exportTemplateFieldAssignments,
  exportTemplates,
  templateFieldAssignments,
} from "../src/schema";
import { and, eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...\n");

  // Seed Decision Fields (upsert — updates content on re-run)
  console.log("Seeding decision fields...");
  const fields = [] as Array<typeof decisionFields.$inferSelect>;
  for (const fieldSeed of CORE_FIELDS) {
    const inserted = await db
      .insert(decisionFields)
      .values(fieldSeed)
      .onConflictDoUpdate({
        target: decisionFields.id,
        set: {
          description: fieldSeed.description,
          extractionPrompt: fieldSeed.extractionPrompt,
          instructions: fieldSeed.instructions,
          placeholder: fieldSeed.placeholder,
          version: fieldSeed.version,
        },
      })
      .returning();
    if (inserted[0]) fields.push(inserted[0]);
  }

  console.log(`  ✓ Upserted ${fields.length} decision fields`);

  // Seed Decision Templates (insert-only — skip if exists by namespace+name+version)
  console.log("\nSeeding decision templates...");
  const seedTemplates = prepareTemplatesForSeeding();

  const templates = [] as Array<typeof decisionTemplates.$inferSelect>;
  for (let i = 0; i < seedTemplates.length; i++) {
    const templateSeed = seedTemplates[i]!;
    const { fields: templateFields, ...templateRecord } = templateSeed;
    const templateVersion = 1;
    const isDefault = i === 0;

    const inserted = await db
      .insert(decisionTemplates)
      .values({ ...templateRecord, version: templateVersion, isDefault })
      .onConflictDoUpdate({
        target: [
          decisionTemplates.namespace,
          decisionTemplates.name,
          decisionTemplates.version,
        ],
        set: {
          description: templateRecord.description,
          promptTemplate: templateRecord.promptTemplate,
          isDefault,
        },
      })
      .returning();

    void templateFields;
    if (inserted[0]) templates.push(inserted[0]);
  }

  console.log(`  ✓ Upserted ${templates.length} decision templates`);

  // Seed Template Field Assignments (insert-only — skip existing)
  console.log("\nSeeding template field assignments...");
  const templateIdByIdentity = new Map(
    templates.map((template) => [
      `${template.namespace}:${template.name}:${template.version ?? 1}`,
      template.id,
    ]),
  );

  for (const templateSeed of seedTemplates) {
    const templateId = templateIdByIdentity.get(`${templateSeed.namespace}:${templateSeed.name}:1`);

    if (!templateId || !templateSeed.fields?.length) {
      continue;
    }

    for (const assignment of templateSeed.fields) {
      const existing = await db
        .select()
        .from(templateFieldAssignments)
        .where(
          and(
            eq(templateFieldAssignments.templateId, templateId),
            eq(templateFieldAssignments.fieldId, assignment.fieldId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        continue;
      }

      await db.insert(templateFieldAssignments).values({
        templateId,
        fieldId: assignment.fieldId,
        order: assignment.order,
        required: assignment.required,
      });
    }

    console.log(`  ✓ Ensured field assignments for ${templateSeed.name} template`);
  }

  console.log("\nSeeding default export templates...");
  const seedExportTemplates = prepareDefaultExportTemplatesForSeeding();

  const exportTemplatesByIdentity = new Map<string, typeof exportTemplates.$inferSelect>();
  for (const exportTemplateSeed of seedExportTemplates) {
    const parentTemplateId = templateIdByIdentity.get(
      `${exportTemplateSeed.namespace}:${exportTemplateSeed.name.replace(/ Default Export$/, "")}:1`,
    );

    if (!parentTemplateId) {
      continue;
    }

    const { fields: exportFields, ...exportTemplateRecord } = exportTemplateSeed;
    const inserted = await db
      .insert(exportTemplates)
      .values({
        ...exportTemplateRecord,
        deliberationTemplateId: parentTemplateId,
        isDefault: true,
        version: 1,
      })
      .onConflictDoUpdate({
        target: [exportTemplates.namespace, exportTemplates.name, exportTemplates.version],
        set: {
          deliberationTemplateId: parentTemplateId,
          description: exportTemplateRecord.description,
          isDefault: true,
        },
      })
      .returning();

    if (inserted[0]) {
      exportTemplatesByIdentity.set(
        `${inserted[0].namespace}:${inserted[0].name}:${inserted[0].version ?? 1}`,
        inserted[0],
      );
    }

    void exportFields;
  }

  console.log(`  ✓ Upserted ${exportTemplatesByIdentity.size} default export templates`);

  console.log("\nSeeding export-template field assignments...");
  for (const exportTemplateSeed of seedExportTemplates) {
    const exportTemplateRow = exportTemplatesByIdentity.get(
      `${exportTemplateSeed.namespace}:${exportTemplateSeed.name}:1`,
    );

    if (!exportTemplateRow) {
      continue;
    }

    for (const assignment of exportTemplateSeed.fields) {
      const existing = await db
        .select()
        .from(exportTemplateFieldAssignments)
        .where(
          and(
            eq(exportTemplateFieldAssignments.exportTemplateId, exportTemplateRow.id),
            eq(exportTemplateFieldAssignments.fieldId, assignment.fieldId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        continue;
      }

      await db.insert(exportTemplateFieldAssignments).values({
        exportTemplateId: exportTemplateRow.id,
        fieldId: assignment.fieldId,
        order: assignment.order,
        ...(assignment.title !== undefined ? { title: assignment.title } : {}),
      });
    }

    console.log(`  ✓ Ensured field assignments for ${exportTemplateSeed.name}`);
  }

  // Seed Expert Templates
  console.log("\nSeeding expert templates...");
  const seedExperts = [
    {
      name: "Technical Architecture Review",
      type: "technical" as const,
      promptTemplate:
        "You are a senior technical architect. Review the following decision for technical soundness, scalability concerns, and potential pitfalls. Provide specific, actionable feedback.",
      mcpAccess: ["github", "docs"],
      isActive: true,
    },
    {
      name: "Legal Compliance Check",
      type: "legal" as const,
      promptTemplate:
        "You are a legal compliance specialist. Review this decision for potential legal risks, compliance requirements, and regulatory concerns. Flag any issues that need legal review.",
      mcpAccess: [],
      isActive: true,
    },
    {
      name: "Stakeholder Impact Analysis",
      type: "stakeholder" as const,
      promptTemplate:
        "You are a stakeholder management expert. Analyze how this decision might affect different stakeholders, identify communication needs, and suggest engagement strategies.",
      mcpAccess: [],
      isActive: true,
    },
  ];

  const experts = [] as Array<typeof expertTemplates.$inferSelect>;
  for (const expertSeed of seedExperts) {
    const existing = await db
      .select()
      .from(expertTemplates)
      .where(eq(expertTemplates.name, expertSeed.name))
      .limit(1);

    if (existing[0]) {
      experts.push(existing[0]);
      continue;
    }

    const inserted = await db.insert(expertTemplates).values(expertSeed).returning();
    if (inserted[0]) experts.push(inserted[0]);
  }

  console.log(`  ✓ Ensured ${experts.length} expert templates`);

  console.log("\n✅ Database seeded successfully!");

  await client.end({ timeout: 5 });
}

seed().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  try {
    await client.end({ timeout: 5 });
  } catch {
    // ignore
  }
  process.exit(1);
});
