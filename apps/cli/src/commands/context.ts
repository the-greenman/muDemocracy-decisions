import { Command } from 'commander';
import chalk from 'chalk';
import { createGlobalContextService } from '@repo/core';

const globalContextService = createGlobalContextService();

function printContextValue(label: string, value?: string) {
  console.log(chalk.white(`${label}: ${value ?? 'none'}`));
}

export const contextCommand = new Command('context')
  .description('Global context management commands');

contextCommand
  .command('show')
  .description('Show the active global context')
  .action(async () => {
    try {
      const context = await globalContextService.getContext();

      console.log(chalk.white('Active Context:'));
      console.log('');
      printContextValue('Meeting ID', context.activeMeetingId);
      if (context.activeMeeting) {
        console.log(chalk.gray(`Meeting Title: ${context.activeMeeting.title}`));
      }

      printContextValue('Flagged Decision ID', context.activeDecisionId);
      if (context.activeDecision) {
        console.log(chalk.gray(`Decision Title: ${context.activeDecision.suggestedTitle}`));
      }

      printContextValue('Decision Context ID', context.activeDecisionContextId);
      if (context.activeTemplate) {
        console.log(chalk.gray(`Template: ${context.activeTemplate.name} (${context.activeTemplate.id})`));
      }

      printContextValue('Field', context.activeField);
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

contextCommand
  .command('set-meeting')
  .description('Set the active meeting')
  .argument('<id>', 'Meeting ID')
  .action(async (id) => {
    try {
      await globalContextService.setActiveMeeting(id);
      console.log(chalk.green('✓ Active meeting updated'));
      console.log(chalk.gray(`Meeting ID: ${id}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

contextCommand
  .command('set-decision')
  .description('Set the active flagged decision')
  .argument('<flagged-id>', 'Flagged decision ID')
  .option('-t, --template <id>', 'Template ID to use when creating a decision context')
  .action(async (flaggedId, options) => {
    try {
      const decisionContext = await globalContextService.setActiveDecision(flaggedId, options.template);
      console.log(chalk.green('✓ Active decision updated'));
      console.log(chalk.gray(`Flagged Decision ID: ${flaggedId}`));
      console.log(chalk.gray(`Decision Context ID: ${decisionContext.id}`));
      console.log(chalk.white(`Template ID: ${decisionContext.templateId}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

contextCommand
  .command('set-field')
  .description('Set the active field on the current decision context')
  .argument('<field-name>', 'Decision field name')
  .action(async (fieldName) => {
    try {
      await globalContextService.setActiveField(fieldName);
      console.log(chalk.green('✓ Active field updated'));
      console.log(chalk.gray(`Field: ${fieldName}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

contextCommand
  .command('clear-field')
  .description('Clear the active field')
  .action(async () => {
    try {
      await globalContextService.clearField();
      console.log(chalk.green('✓ Active field cleared'));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

contextCommand
  .command('clear-decision')
  .description('Clear the active decision and field state')
  .action(async () => {
    try {
      await globalContextService.clearDecision();
      console.log(chalk.green('✓ Active decision cleared'));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

contextCommand
  .command('clear-meeting')
  .description('Clear the active meeting and any nested decision state')
  .action(async () => {
    try {
      await globalContextService.clearMeeting();
      console.log(chalk.green('✓ Active meeting cleared'));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
