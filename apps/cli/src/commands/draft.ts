import { Command } from 'commander';
import chalk from 'chalk';
import { createDraftGenerationService, createDecisionContextService, createLLMInteractionService, createMarkdownExportService } from '@repo/core';
import { createDecisionContextRepository, createDecisionTemplateRepository, createDecisionFieldRepository, createTemplateFieldAssignmentRepository } from '@repo/core';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';

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

      const oldLockedFields = context.lockedFields || [];
      const newLockedFields = oldLockedFields.filter((fieldId) => allowedFieldIds.has(fieldId));

      const newActiveField = context.activeField && allowedFieldIds.has(context.activeField)
        ? context.activeField
        : undefined;

      const removedDraftKeys = Object.keys(oldDraftData).length - Object.keys(newDraftData).length;
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
      
      console.log(chalk.white('\nDraft Summary:'));
      Object.entries(draftData).forEach(([fieldId, value]) => {
        const isLocked = lockedFields.includes(fieldId);
        const prefix = isLocked ? chalk.red('[LOCKED] ') : chalk.green('          ');
        console.log(`${prefix}${fieldId}: ${value}`);
      });
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
      
      if (Object.keys(draftData).length === 0) {
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
      Object.entries(draftData).forEach(([fieldId, value]) => {
        const isLocked = lockedFields.includes(fieldId);
        const fieldName = fieldMap.get(fieldId) || fieldId;
        const prefix = isLocked ? chalk.red('[LOCKED] ') : chalk.green('          ');
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
