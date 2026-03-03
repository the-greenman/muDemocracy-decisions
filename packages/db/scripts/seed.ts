/**
 * Database Seed Script
 * 
 * Seeds the database with initial data:
 * - Default decision fields
 * - Standard decision templates
 * - Sample expert templates
 */

import { db, client } from '../src/client.js';
import { 
  decisionFields, 
  decisionTemplates, 
  expertTemplates,
  templateFieldAssignments 
} from '../src/schema';
import { and, eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Seed Decision Fields
  console.log('Seeding decision fields...');
  const CORE_FIELD_IDS = {
    DECISION_STATEMENT: '550e8400-e29b-41d4-a716-446655440001',
    CONTEXT: '550e8400-e29b-41d4-a716-446655440002',
    OPTIONS: '550e8400-e29b-41d4-a716-446655440003',
    CRITERIA: '550e8400-e29b-41d4-a716-446655440004',
    ANALYSIS: '550e8400-e29b-41d4-a716-446655440005',
    OUTCOME: '550e8400-e29b-41d4-a716-446655440006',
    RISKS: '550e8400-e29b-41d4-a716-446655440007',
    TIMELINE: '550e8400-e29b-41d4-a716-446655440008',
    STAKEHOLDERS: '550e8400-e29b-41d4-a716-446655440009',
    RESOURCES: '550e8400-e29b-41d4-a716-446655440010',
  } as const;

  const seedFields: Array<typeof decisionFields.$inferInsert> = [
    {
      id: CORE_FIELD_IDS.DECISION_STATEMENT,
      namespace: 'core',
      name: 'decision_statement',
      description: 'The core decision being made',
      category: 'outcome' as const,
      extractionPrompt: 'Extract the main decision statement from the discussion',
      fieldType: 'textarea' as const,
      placeholder: 'What decision are we making?',
      version: 1,
      isCustom: false,
    },
    {
      id: CORE_FIELD_IDS.CONTEXT,
      namespace: 'core',
      name: 'context',
      description: 'Background information and circumstances that led to this decision',
      category: 'context' as const,
      extractionPrompt: 'Extract the relevant context and background information for this decision',
      fieldType: 'textarea' as const,
      placeholder: 'What context is needed to understand this decision?',
      version: 1,
      isCustom: false,
    },
    {
      id: CORE_FIELD_IDS.OPTIONS,
      namespace: 'core',
      name: 'options',
      description: 'Other options that were discussed',
      category: 'evaluation' as const,
      extractionPrompt: 'Extract alternatives or options discussed',
      fieldType: 'textarea' as const,
      placeholder: 'What other options were considered?',
      version: 1,
      isCustom: false,
    },
    {
      id: CORE_FIELD_IDS.CRITERIA,
      namespace: 'core',
      name: 'criteria',
      description: 'Factors to consider when evaluating options',
      category: 'evaluation' as const,
      extractionPrompt: 'Extract evaluation criteria or constraints mentioned when comparing options',
      fieldType: 'textarea' as const,
      placeholder: 'What criteria matter for this decision?',
      version: 1,
      isCustom: false,
    },
    {
      id: CORE_FIELD_IDS.ANALYSIS,
      namespace: 'core',
      name: 'analysis',
      description: 'Reasoning, trade-offs, and analysis of the options',
      category: 'evaluation' as const,
      extractionPrompt: 'Extract analysis, trade-offs, and reasoning comparing the available options',
      fieldType: 'textarea' as const,
      placeholder: 'What analysis supports the decision?',
      version: 1,
      isCustom: false,
    },
    {
      id: CORE_FIELD_IDS.OUTCOME,
      namespace: 'core',
      name: 'outcome',
      description: 'Final decision and rationale',
      category: 'outcome' as const,
      extractionPrompt: 'Extract the final decision outcome and rationale',
      fieldType: 'textarea' as const,
      placeholder: 'What did we decide and why?',
      version: 1,
      isCustom: false,
    },
    {
      id: CORE_FIELD_IDS.RISKS,
      namespace: 'core',
      name: 'risks',
      description: 'Risks, concerns, and mitigations related to this decision',
      category: 'evaluation' as const,
      extractionPrompt: 'Extract risks, concerns, and mitigations discussed',
      fieldType: 'textarea' as const,
      placeholder: 'What risks were identified?',
      version: 1,
      isCustom: false,
    },
    {
      id: CORE_FIELD_IDS.TIMELINE,
      namespace: 'core',
      name: 'timeline',
      description: 'Timeline, milestones, and sequencing for implementing the decision',
      category: 'metadata' as const,
      extractionPrompt: 'Extract timeline, milestones, and sequencing details mentioned',
      fieldType: 'textarea' as const,
      placeholder: 'What is the timeline for implementation?',
      version: 1,
      isCustom: false,
    },
    {
      id: CORE_FIELD_IDS.STAKEHOLDERS,
      namespace: 'core',
      name: 'stakeholders',
      description: 'People, teams, or systems affected by this decision',
      category: 'metadata' as const,
      extractionPrompt: 'Extract who is affected by this decision and any stakeholders mentioned',
      fieldType: 'textarea' as const,
      placeholder: 'Who is impacted?',
      version: 1,
      isCustom: false,
    },
    {
      id: CORE_FIELD_IDS.RESOURCES,
      namespace: 'core',
      name: 'resources',
      description: 'Resources required to implement the decision (people, tools, budget)',
      category: 'metadata' as const,
      extractionPrompt: 'Extract resources required to implement the decision (people, tools, budget)',
      fieldType: 'textarea' as const,
      placeholder: 'What resources are required?',
      version: 1,
      isCustom: false,
    },
  ];

  const fields = [] as Array<(typeof decisionFields.$inferSelect)>;
  for (const fieldSeed of seedFields) {
    const existing = await db
      .select()
      .from(decisionFields)
      .where(
        fieldSeed.id
          ? eq(decisionFields.id, fieldSeed.id)
          : and(
              eq(decisionFields.namespace, fieldSeed.namespace ?? 'core'),
              eq(decisionFields.name, fieldSeed.name ?? ''),
              eq(decisionFields.version, fieldSeed.version ?? 1)
            )
      )
      .limit(1);

    if (existing[0]) {
      fields.push(existing[0]);
      continue;
    }

    const inserted = await db.insert(decisionFields).values(fieldSeed).returning();
    if (inserted[0]) fields.push(inserted[0]);
  }

  console.log(`  ✓ Ensured ${fields.length} decision fields`);

  // Seed Decision Templates
  console.log('\nSeeding decision templates...');
  const seedTemplates = [
    {
      name: 'Standard Decision',
      description: 'General purpose decision template for any type of decision',
      category: 'standard' as const,
      version: 1,
      isDefault: true,
      isCustom: false,
    },
    {
      name: 'Technology Selection',
      description: 'Template for choosing between technical options or tools',
      category: 'technology' as const,
      version: 1,
      isDefault: false,
      isCustom: false,
    },
    {
      name: 'Strategic Initiative',
      description: 'Template for strategic business or product decisions',
      category: 'strategy' as const,
      version: 1,
      isDefault: false,
      isCustom: false,
    },
  ];

  const templates = [] as Array<(typeof decisionTemplates.$inferSelect)>;
  for (const templateSeed of seedTemplates) {
    const existing = await db
      .select()
      .from(decisionTemplates)
      .where(and(eq(decisionTemplates.name, templateSeed.name), eq(decisionTemplates.version, templateSeed.version)))
      .limit(1);

    if (existing[0]) {
      templates.push(existing[0]);
      continue;
    }

    const inserted = await db.insert(decisionTemplates).values(templateSeed).returning();
    if (inserted[0]) templates.push(inserted[0]);
  }

  console.log(`  ✓ Ensured ${templates.length} decision templates`);

  // Seed Template Field Assignments
  console.log('\nSeeding template field assignments...');
  const standardTemplate = templates.find((template) => template.name === 'Standard Decision');
  const decisionStatementField = fields.find((field) => field.name === 'decision_statement');
  const contextField = fields.find((field) => field.name === 'context');

  if (standardTemplate && decisionStatementField && contextField) {
    const seedAssignments = [
      {
        templateId: standardTemplate.id,
        fieldId: decisionStatementField.id,
        order: 0,
        required: true,
        customLabel: 'Decision',
      },
      {
        templateId: standardTemplate.id,
        fieldId: contextField.id,
        order: 1,
        required: true,
        customLabel: 'Context',
      },
    ];

    for (const a of seedAssignments) {
      const existing = await db
        .select()
        .from(templateFieldAssignments)
        .where(and(eq(templateFieldAssignments.templateId, a.templateId), eq(templateFieldAssignments.fieldId, a.fieldId)))
        .limit(1);

      if (existing[0]) continue;
      await db.insert(templateFieldAssignments).values(a);
    }

    console.log('  ✓ Ensured field assignments for Standard Decision template');
  }

  // Seed Expert Templates
  console.log('\nSeeding expert templates...');
  const seedExperts = [
    {
      name: 'Technical Architecture Review',
      type: 'technical' as const,
      promptTemplate: 'You are a senior technical architect. Review the following decision for technical soundness, scalability concerns, and potential pitfalls. Provide specific, actionable feedback.',
      mcpAccess: ['github', 'docs'],
      isActive: true,
    },
    {
      name: 'Legal Compliance Check',
      type: 'legal' as const,
      promptTemplate: 'You are a legal compliance specialist. Review this decision for potential legal risks, compliance requirements, and regulatory concerns. Flag any issues that need legal review.',
      mcpAccess: [],
      isActive: true,
    },
    {
      name: 'Stakeholder Impact Analysis',
      type: 'stakeholder' as const,
      promptTemplate: 'You are a stakeholder management expert. Analyze how this decision might affect different stakeholders, identify communication needs, and suggest engagement strategies.',
      mcpAccess: [],
      isActive: true,
    },
  ];

  const experts = [] as Array<(typeof expertTemplates.$inferSelect)>;
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

  console.log('\n✅ Database seeded successfully!');

  await client.end({ timeout: 5 });
}

seed()
  .catch(async (err) => {
    console.error('❌ Seed failed:', err);
    try {
      await client.end({ timeout: 5 });
    } catch {
      // ignore
    }
    process.exit(1);
  });
