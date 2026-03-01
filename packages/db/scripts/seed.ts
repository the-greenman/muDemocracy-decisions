/**
 * Database Seed Script
 * 
 * Seeds the database with initial data:
 * - Default decision fields
 * - Standard decision templates
 * - Sample expert templates
 */

import { db } from '../src/client.js';
import { 
  decisionFields, 
  decisionTemplates, 
  expertTemplates,
  templateFieldAssignments 
} from '../src/schema';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Seed Decision Fields
  console.log('Seeding decision fields...');
  const fields = await db.insert(decisionFields).values([
    {
      name: 'decision_statement',
      description: 'The core decision being made',
      category: 'outcome',
      extractionPrompt: 'Extract the main decision statement from the discussion',
      fieldType: 'textarea',
      placeholder: 'What decision are we making?',
      version: 1,
      isCustom: false,
    },
    {
      name: 'rationale',
      description: 'Why this decision was made',
      category: 'context',
      extractionPrompt: 'Extract the reasoning and context for this decision',
      fieldType: 'textarea',
      placeholder: 'Why are we making this decision?',
      version: 1,
      isCustom: false,
    },
    {
      name: 'alternatives_considered',
      description: 'Other options that were discussed',
      category: 'evaluation',
      extractionPrompt: 'Extract alternatives or options discussed',
      fieldType: 'textarea',
      placeholder: 'What other options were considered?',
      version: 1,
      isCustom: false,
    },
    {
      name: 'decision_maker',
      description: 'Who made or is responsible for this decision',
      category: 'metadata',
      extractionPrompt: 'Extract who is making or responsible for this decision',
      fieldType: 'text',
      placeholder: 'Decision owner',
      version: 1,
      isCustom: false,
    },
    {
      name: 'implementation_notes',
      description: 'How this decision will be implemented',
      category: 'outcome',
      extractionPrompt: 'Extract implementation details or next steps',
      fieldType: 'textarea',
      placeholder: 'How will this be implemented?',
      version: 1,
      isCustom: false,
    },
  ]).returning();

  console.log(`  ✓ Created ${fields.length} decision fields`);

  // Seed Decision Templates
  console.log('\nSeeding decision templates...');
  const templates = await db.insert(decisionTemplates).values([
    {
      name: 'Standard Decision',
      description: 'General purpose decision template for any type of decision',
      category: 'standard',
      version: 1,
      isDefault: true,
      isCustom: false,
    },
    {
      name: 'Technology Selection',
      description: 'Template for choosing between technical options or tools',
      category: 'technology',
      version: 1,
      isDefault: false,
      isCustom: false,
    },
    {
      name: 'Strategic Initiative',
      description: 'Template for strategic business or product decisions',
      category: 'strategy',
      version: 1,
      isDefault: false,
      isCustom: false,
    },
  ]).returning();

  console.log(`  ✓ Created ${templates.length} decision templates`);

  // Seed Template Field Assignments
  console.log('\nSeeding template field assignments...');
  const standardTemplate = templates.find((template) => template.name === 'Standard Decision');
  const decisionStatementField = fields.find((field) => field.name === 'decision_statement');
  const rationaleField = fields.find((field) => field.name === 'rationale');

  if (standardTemplate && decisionStatementField && rationaleField) {
    await db.insert(templateFieldAssignments).values([
      {
        templateId: standardTemplate.id,
        fieldId: decisionStatementField.id,
        order: 0,
        required: true,
        customLabel: 'Decision',
      },
      {
        templateId: standardTemplate.id,
        fieldId: rationaleField.id,
        order: 1,
        required: true,
        customLabel: 'Rationale',
      },
    ]);
    console.log('  ✓ Created field assignments for Standard Decision template');
  }

  // Seed Expert Templates
  console.log('\nSeeding expert templates...');
  const experts = await db.insert(expertTemplates).values([
    {
      name: 'Technical Architecture Review',
      type: 'technical',
      promptTemplate: 'You are a senior technical architect. Review the following decision for technical soundness, scalability concerns, and potential pitfalls. Provide specific, actionable feedback.',
      mcpAccess: ['github', 'docs'],
      isActive: true,
    },
    {
      name: 'Legal Compliance Check',
      type: 'legal',
      promptTemplate: 'You are a legal compliance specialist. Review this decision for potential legal risks, compliance requirements, and regulatory concerns. Flag any issues that need legal review.',
      mcpAccess: [],
      isActive: true,
    },
    {
      name: 'Stakeholder Impact Analysis',
      type: 'stakeholder',
      promptTemplate: 'You are a stakeholder management expert. Analyze how this decision might affect different stakeholders, identify communication needs, and suggest engagement strategies.',
      mcpAccess: [],
      isActive: true,
    },
  ]).returning();

  console.log(`  ✓ Created ${experts.length} expert templates`);

  console.log('\n✅ Database seeded successfully!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
