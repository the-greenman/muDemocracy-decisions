import { Command } from 'commander';
import chalk from 'chalk';
import { FlaggedDecisionService } from '@repo/core';
import { DrizzleFlaggedDecisionRepository } from '@repo/db';

// Create service instance
const repo = new DrizzleFlaggedDecisionRepository();
const decisionService = new FlaggedDecisionService(repo);

export const decisionsCommand = new Command('decisions')
  .description('Flagged decision management commands');

// Show decision command
decisionsCommand
  .command('show')
  .description('Show flagged decision details')
  .argument('<id>', 'Flagged decision ID')
  .action(async (id) => {
    try {
      const decision = await repo.findById(id);
      
      if (!decision) {
        console.error(chalk.red('Decision not found'));
        process.exit(1);
      }

      console.log(chalk.white('Flagged Decision Details:'));
      console.log('');
      console.log(chalk.gray(`ID: ${decision.id}`));
      console.log(chalk.white(`Title: ${decision.suggestedTitle}`));
      console.log(chalk.white(`Meeting: ${decision.meetingId}`));
      
      if (decision.contextSummary) {
        console.log(chalk.white(`Context: ${decision.contextSummary}`));
      }
      
      console.log(chalk.blue(`Confidence: ${(decision.confidence * 100).toFixed(1)}%`));
      console.log(chalk.gray(`Status: ${decision.status}`));
      
      if (decision.chunkIds && decision.chunkIds.length > 0) {
        console.log(chalk.gray(`Source Chunks: ${decision.chunkIds.join(', ')}`));
      }
      
      if (decision.suggestedTemplateId) {
        console.log(chalk.gray(`Suggested Template: ${decision.suggestedTemplateId}`));
        console.log(chalk.gray(`Template Confidence: ${(decision.templateConfidence! * 100).toFixed(1)}%`));
      }
      
      console.log(chalk.gray(`Created: ${decision.createdAt}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Flag decision command
decisionsCommand
  .command('flag')
  .description('Manually flag a decision from transcript segments')
  .argument('<meeting-id>', 'Meeting ID')
  .requiredOption('-t, --title <title>', 'Decision title')
  .option('-s, --segments <segments>', 'Comma-separated list of chunk IDs')
  .option('-c, --context <context>', 'Context summary')
  .option('--template <templateId>', 'Suggested template ID')
  .action(async (meetingId, options) => {
    try {
      const decision = await decisionService.createFlaggedDecision({
        meetingId,
        suggestedTitle: options.title,
        contextSummary: options.context,
        chunkIds: options.segments ? options.segments.split(',').map((s: string) => s.trim()) : [],
        suggestedTemplateId: options.template,
        templateConfidence: options.template ? 0.8 : undefined,
        confidence: 1.0, // Manual flags have high confidence
        priority: 0, // Default priority
      });

      console.log(chalk.green('✓ Decision flagged successfully'));
      console.log(chalk.gray(`ID: ${decision.id}`));
      console.log(chalk.white(`Title: ${decision.suggestedTitle}`));
      console.log(chalk.gray(`Status: ${decision.status}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Update decision command
decisionsCommand
  .command('update')
  .description('Update a flagged decision')
  .argument('<id>', 'Decision ID')
  .option('-t, --title <title>', 'New title')
  .option('-s, --status <status>', 'New status')
  .action(async (id, options) => {
    try {
      const updateData: any = {};
      if (options.title) updateData.suggestedTitle = options.title;
      if (options.status) updateData.status = options.status;
      
      const decision = await repo.update(id, updateData);
      
      if (decision) {
        console.log(chalk.green('✓ Decision updated successfully'));
        console.log(chalk.gray(`ID: ${decision.id}`));
        console.log(chalk.white(`Title: ${decision.suggestedTitle}`));
        console.log(chalk.gray(`Status: ${decision.status}`));
      } else {
        console.error(chalk.red('Failed to update decision'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Priority command
decisionsCommand
  .command('priority')
  .description('Set decision priority')
  .argument('<id>', 'Decision ID')
  .requiredOption('-p, --priority <number>', 'Priority level (1-5)', '3')
  .action(async (id, options) => {
    try {
      const priority = parseInt(options.priority);
      if (isNaN(priority) || priority < 1 || priority > 5) {
        console.error(chalk.red('Priority must be a number between 1 and 5'));
        process.exit(1);
      }
      
      await repo.updatePriority(id, priority);
      
      console.log(chalk.green(`✓ Priority set to ${priority}`));
      console.log(chalk.gray(`Decision ID: ${id}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Dismiss command
decisionsCommand
  .command('dismiss')
  .description('Dismiss a flagged decision')
  .argument('<id>', 'Decision ID')
  .option('-r, --reason <reason>', 'Dismissal reason')
  .action(async (id, options) => {
    try {
      await decisionService.updateDecisionStatus(id, 'dismissed');
      
      console.log(chalk.green('✓ Decision dismissed'));
      console.log(chalk.gray(`Decision ID: ${id}`));
      if (options.reason) {
        console.log(chalk.gray(`Reason: ${options.reason}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
