import { Command } from 'commander';
import chalk from 'chalk';
import { createDraftGenerationService, createDecisionContextService, createLLMInteractionService, createMarkdownExportService } from '@repo/core';
import { createDecisionContextRepository, createDecisionTemplateRepository, createDecisionFieldRepository, createTemplateFieldAssignmentRepository } from '@repo/core';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';

const FIELD_META_KEY = '__fieldMeta';

type FieldMetaRecord = Record<string, { manuallyEdited?: boolean }>;

// Create service instances
const draftService = createDraftGenerationService();
const contextService = createDecisionContextService();
const llmInteractionService = createLLMInteractionService();
const markdownExportService = createMarkdownExportService();

// Create repository instances for direct access
const contextRepo = createDecisionContextRepository();
const templateRepo = createDecisionTemplateRepository();
const fieldRepo = createDecisionFieldRepository();
const fieldAssignmentRepo = createTemplateFieldAssignmentRepository();

async function resolveTemplateField(contextId: string, fieldName: string) {
  const context = await contextRepo.findById(contextId);
  if (!context) {
    throw new Error('Decision context not found');
  }

  const assignments = await fieldAssignmentRepo.findByTemplateId(context.templateId);
  for (const assignment of assignments) {
    const field = await fieldRepo.findById(assignment.fieldId);
    if (field?.name === fieldName) {
      return { context, field };
    }
  }

  throw new Error(`Field "${fieldName}" not found on the decision context template`);
}

function getFieldMeta(draftData: Record<string, unknown>): FieldMetaRecord {
  const meta = draftData[FIELD_META_KEY];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return {};
  }

  return meta as FieldMetaRecord;
}

function getVisibleDraftEntries(draftData: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(draftData).filter(([fieldId]) => fieldId !== FIELD_META_KEY);
}

export const draftCommand = new Command('draft')
  .description('Draft generation and management commands');

// Set template command
draftCommand
  .command('set-template')
  .description('Change the template for a decision context and keep only fields that exist in the new template')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .requiredOption('-t, --template-id <id>', 'New decision template ID')
  .action(async (options) => {
    try {
      const context = await contextRepo.findById(options.contextId);
      if (!context) {
        console.error(chalk.red('Decision context not found'));
        return;
      }

      const template = await templateRepo.findById(options.templateId);
      if (!template) {
        console.error(chalk.red('Decision template not found'));
        return;
      }

      const assignments = await fieldAssignmentRepo.findByTemplateId(template.id);
      const allowedFieldIds = new Set(assignments.map(a => a.fieldId));

      const oldDraftData = context.draftData || {};
      const newDraftData: Record<string, any> = {};
      for (const [key, value] of Object.entries(oldDraftData)) {
        if (allowedFieldIds.has(key)) {
          newDraftData[key] = value;
        }
      }
      const existingFieldMeta = getFieldMeta(oldDraftData);
      const filteredFieldMeta = Object.fromEntries(
        Object.entries(existingFieldMeta).filter(([fieldId]) => allowedFieldIds.has(fieldId))
      );
      if (Object.keys(filteredFieldMeta).length > 0) {
        newDraftData[FIELD_META_KEY] = filteredFieldMeta;
      }

      const oldLockedFields = context.lockedFields || [];
      const newLockedFields = oldLockedFields.filter((fieldId) => allowedFieldIds.has(fieldId));

      const newActiveField = context.activeField && allowedFieldIds.has(context.activeField)
        ? context.activeField
        : undefined;

      const removedDraftKeys = getVisibleDraftEntries(oldDraftData).length - getVisibleDraftEntries(newDraftData).length;
      const removedLocked = oldLockedFields.length - newLockedFields.length;

      const updated = await contextRepo.update(context.id, {
        templateId: template.id,
        draftData: newDraftData,
        lockedFields: newLockedFields,
        activeField: newActiveField,
      });

      if (!updated) {
        console.error(chalk.red('Failed to update decision context'));
        return;
      }

      console.log(chalk.green('✓ Template updated successfully'));
      console.log(chalk.gray(`Context ID: ${updated.id}`));
      console.log(chalk.gray(`Template ID: ${updated.templateId}`));
      console.log(chalk.gray(`Removed draft fields: ${removedDraftKeys}`));
      console.log(chalk.gray(`Removed locks: ${removedLocked}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Generate draft command
draftCommand
  .command('generate')
  .description('Generate or regenerate full draft (respects locks)')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .option('-g, --guidance <text>', 'Guidance text for LLM')
  .action(async (options) => {
    try {
      console.log(chalk.blue('Generating draft...'));
      
      const guidance = options.guidance ? [{
        content: options.guidance,
        source: 'user_text' as const,
      }] : undefined;

      const updatedContext = await draftService.generateDraft(options.contextId, guidance);
      
      console.log(chalk.green('✓ Draft generated successfully'));
      console.log(chalk.gray(`Context ID: ${updatedContext.id}`));
      
      // Show draft summary
      const draftData = updatedContext.draftData || {};
      const lockedFields = updatedContext.lockedFields || [];
      const fieldMeta = getFieldMeta(draftData);
      
      console.log(chalk.white('\nDraft Summary:'));
      getVisibleDraftEntries(draftData).forEach(([fieldId, value]) => {
        const isLocked = lockedFields.includes(fieldId);
        const isManuallyEdited = fieldMeta[fieldId]?.manuallyEdited === true;
        const indicators = [isLocked ? '[LOCKED]' : null, isManuallyEdited ? '[MANUALLY EDITED]' : null]
          .filter(Boolean)
          .join(' ');
        const prefix = indicators ? `${indicators} ` : '';
        console.log(`${prefix}${fieldId}: ${value}`);
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

draftCommand
  .command('regenerate-field')
  .description('Regenerate a single draft field with optional guidance')
  .argument('<field-name>', 'Template field name to regenerate')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .option('-g, --guidance <text>', 'Additional field-specific guidance text')
  .action(async (fieldName, options) => {
    try {
      const { field } = await resolveTemplateField(options.contextId, fieldName);
      const guidance = options.guidance ? [{
        fieldId: field.id,
        content: options.guidance,
        source: 'user_text' as const,
      }] : undefined;

      const value = await draftService.regenerateField(options.contextId, field.id, guidance);

      console.log(chalk.green(`✓ Regenerated field ${field.name}`));
      console.log(chalk.gray(`Field ID: ${field.id}`));
      console.log(chalk.white(value));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

draftCommand
  .command('edit-field')
  .description('Set a single draft field value manually')
  .argument('<field-name>', 'Template field name to edit')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .requiredOption('-v, --value <value>', 'New field value')
  .action(async (fieldName, options) => {
    try {
      const { field } = await resolveTemplateField(options.contextId, fieldName);
      const updated = await contextService.setFieldValue(options.contextId, field.id, options.value);
      if (!updated) {
        console.error(chalk.red('Decision context not found'));
        return;
      }

      console.log(chalk.green(`✓ Updated field ${field.name}`));
      console.log(chalk.gray(`Field ID: ${field.id}`));
      console.log(chalk.white(String(updated.draftData?.[field.id] ?? '')));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Show draft command
draftCommand
  .command('show')
  .description('Display current draft data with lock status')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .action(async (options) => {
    try {
      const context = await contextRepo.findById(options.contextId);
      if (!context) {
        console.error(chalk.red('Decision context not found'));
        return;
      }

      console.log(chalk.white(`Draft for Context: ${context.id}`));
      console.log(chalk.gray(`Created: ${context.createdAt}`));
      console.log(chalk.gray(`Updated: ${context.updatedAt}`));
      console.log('');

      const draftData = context.draftData || {};
      const lockedFields = context.lockedFields || [];
      const fieldMeta = getFieldMeta(draftData);
      
      if (getVisibleDraftEntries(draftData).length === 0) {
        console.log(chalk.yellow('No draft data yet. Use "draft generate" to create a draft.'));
        return;
      }

      // Get field names from template
      const template = await templateRepo.findById(context.templateId);
      const fieldMap = new Map();
      if (template) {
        const assignments = await fieldAssignmentRepo.findByTemplateId(template.id);
        for (const assignment of assignments) {
          const field = await fieldRepo.findById(assignment.fieldId);
          if (field) {
            fieldMap.set(field.id, field.name);
          }
        }
      }

      console.log(chalk.white('Draft Fields:'));
      getVisibleDraftEntries(draftData).forEach(([fieldId, value]) => {
        const isLocked = lockedFields.includes(fieldId);
        const isManuallyEdited = fieldMeta[fieldId]?.manuallyEdited === true;
        const fieldName = fieldMap.get(fieldId) || fieldId;
        const indicators = [isLocked ? '[LOCKED]' : null, isManuallyEdited ? '[MANUALLY EDITED]' : null]
          .filter(Boolean)
          .join(' ');
        const prefix = indicators ? `${indicators} ` : '';
        const displayValue = value || chalk.gray('(awaiting generation)');
        console.log(`${prefix}${fieldName}: ${displayValue}`);
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Export draft command
draftCommand
  .command('export')
  .description('Render draft to markdown (stdout or file)')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .option('-o, --output <path>', 'Output file path (optional, prints to stdout if not provided)')
  .option('--no-metadata', 'Exclude metadata header and footer')
  .option('--no-timestamps', 'Exclude timestamps from metadata')
  .option('--no-participants', 'Exclude participants from metadata')
  .option('--field-order <order>', 'Field ordering: template or alphabetical', 'template')
  .option('--lock-indicator <type>', 'Locked field indicator: prefix, suffix, or none', 'prefix')
  .action(async (options) => {
    try {
      const markdown = await markdownExportService.exportToMarkdown(options.contextId, {
        includeMetadata: options.metadata !== false,
        includeTimestamps: options.timestamps !== false,
        includeParticipants: options.participants !== false,
        fieldOrder: options.fieldOrder as 'template' | 'alphabetical',
        lockedFieldIndicator: options.lockIndicator as 'prefix' | 'suffix' | 'none'
      });

      if (options.output) {
        await writeFile(resolve(options.output), markdown, 'utf-8');
        console.log(chalk.green(`✓ Exported to ${options.output}`));
      } else {
        console.log(markdown);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Debug command
draftCommand
  .command('debug')
  .description('Print last LLM interaction (prompt + response)')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .option('-f, --field-id <id>', 'Show interaction for specific field (optional)')
  .action(async (options) => {
    try {
      const interactions = options.fieldId
        ? await llmInteractionService.findByField(options.contextId, options.fieldId)
        : await llmInteractionService.findByDecisionContext(options.contextId);

      if (interactions.length === 0) {
        console.log(chalk.yellow('No LLM interactions found for this context'));
        return;
      }

      // Show the most recent interaction
      const interaction = interactions[interactions.length - 1];
      
      if (!interaction) {
        console.log(chalk.yellow('No interaction data available'));
        return;
      }
      
      console.log(chalk.white(`LLM Interaction Debug`));
      console.log(chalk.gray(`ID: ${interaction.id}`));
      console.log(chalk.gray(`Operation: ${interaction.operation}`));
      console.log(chalk.gray(`Provider: ${interaction.provider}`));
      console.log(chalk.gray(`Model: ${interaction.model}`));
      console.log(chalk.gray(`Latency: ${interaction.latencyMs}ms`));
      console.log(chalk.gray(`Created: ${interaction.createdAt}`));
      
      if (interaction.fieldId) {
        console.log(chalk.gray(`Field ID: ${interaction.fieldId}`));
      }
      
      console.log(chalk.blue('\n--- PROMPT ---'));
      console.log(interaction.promptText);
      
      console.log(chalk.blue('\n--- RESPONSE ---'));
      console.log(interaction.responseText);
      
      if (interaction.parsedResult) {
        console.log(chalk.blue('\n--- PARSED RESULT ---'));
        console.log(JSON.stringify(interaction.parsedResult, null, 2));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// List draft versions command
draftCommand
  .command('versions')
  .description('List saved draft snapshots with timestamps and field counts')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .action(async (options) => {
    try {
      const versions = await contextService.listVersions(options.contextId);
      if (versions.length === 0) {
        console.log(chalk.yellow('No draft versions saved yet'));
        return;
      }

      console.log(chalk.white(`Draft Versions for Context: ${options.contextId}`));
      console.log('');
      versions.forEach((version) => {
        console.log(chalk.gray(`v${version.version}`));
        console.log(chalk.white(`  Saved At: ${version.savedAt}`));
        console.log(chalk.white(`  Field Count: ${version.fieldCount}`));
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Rollback draft command
draftCommand
  .command('rollback')
  .description('Restore draft data from a saved version')
  .argument('<version>', 'Draft version number to restore')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .action(async (version, options) => {
    try {
      const parsedVersion = Number.parseInt(version, 10);
      if (!Number.isInteger(parsedVersion) || parsedVersion < 1) {
        throw new Error('Version must be a positive integer');
      }

      const updated = await contextService.rollback(options.contextId, parsedVersion);
      if (!updated) {
        console.error(chalk.red('Decision context not found'));
        return;
      }

      console.log(chalk.green(`✓ Restored draft version ${parsedVersion}`));
      console.log(chalk.gray(`Context ID: ${updated.id}`));
      console.log(chalk.gray(`Updated: ${updated.updatedAt}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Lock field command
draftCommand
  .command('lock-field')
  .description('Lock a field to prevent regeneration')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .requiredOption('-f, --field-id <id>', 'Field ID to lock')
  .action(async (options) => {
    try {
      await contextService.lockField(options.contextId, options.fieldId);
      console.log(chalk.green(`✓ Field ${options.fieldId} locked`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Unlock field command
draftCommand
  .command('unlock-field')
  .description('Unlock a field to allow regeneration')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .requiredOption('-f, --field-id <id>', 'Field ID to unlock')
  .action(async (options) => {
    try {
      await contextService.unlockField(options.contextId, options.fieldId);
      console.log(chalk.green(`✓ Field ${options.fieldId} unlocked`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });
