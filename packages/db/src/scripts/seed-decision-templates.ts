/**
 * Seeding script for Decision Templates
 * Populates the database with the 6 core decision templates
 */

import {
  DrizzleDecisionTemplateRepository,
  DrizzleTemplateFieldAssignmentRepository,
} from "../repositories/decision-template-repository";
import { prepareTemplatesForSeeding } from "../seed-data/decision-templates";

async function seedDecisionTemplates(): Promise<void> {
  console.log("Starting to seed decision templates...");

  const templateRepo = new DrizzleDecisionTemplateRepository();
  const fieldAssignmentRepo = new DrizzleTemplateFieldAssignmentRepository();

  try {
    // Get the prepared templates
    const templates = prepareTemplatesForSeeding();

    // Check if templates already exist
    const existingTemplates = await templateRepo.findAll();
    if (existingTemplates.length > 0) {
      console.log(`Found ${existingTemplates.length} existing templates. Skipping seeding.`);
      return;
    }

    // Create templates one by one to handle field assignments
    const createdTemplates = [];
    for (const templateData of templates) {
      // Extract fields from template data
      const { fields, ...templateWithoutFields } = templateData as any;

      // Create the template
      const template = await templateRepo.create(templateWithoutFields);
      console.log(`Created template: ${template.name}`);

      // Create field assignments if any
      if (fields && fields.length > 0) {
        const fieldAssignments = fields.map((field: any) => ({
          ...field,
          templateId: template.id,
        }));
        await fieldAssignmentRepo.createMany(fieldAssignments);
        console.log(`  - Added ${fieldAssignments.length} field assignments`);
      }

      createdTemplates.push(template);
    }

    // Set the first template (Standard) as default
    if (createdTemplates.length > 0) {
      const [defaultTemplate] = createdTemplates;
      if (!defaultTemplate) {
        throw new Error("Expected a default template to be available");
      }

      await templateRepo.setDefault(defaultTemplate.id);
      console.log(`Set "${defaultTemplate.name}" as the default template`);
    }

    console.log(`Successfully seeded ${createdTemplates.length} decision templates!`);
  } catch (error) {
    console.error("Error seeding decision templates:", error);
    throw error;
  }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedDecisionTemplates()
    .then(() => {
      console.log("Seeding completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

export { seedDecisionTemplates };
