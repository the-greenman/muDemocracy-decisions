import { Command } from 'commander';
import chalk from 'chalk';
import { DecisionFieldService } from '@repo/core';
import { DrizzleDecisionFieldRepository } from '@repo/db';

// Create service instance
const repo = new DrizzleDecisionFieldRepository();
const fieldService = new DecisionFieldService(repo);

export const fieldCommand = new Command('field')
  .description('Decision field management commands');

// List fields command
fieldCommand
  .command('list')
  .description('List all decision fields')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (options) => {
    try {
      const fields = options.category 
        ? await fieldService.getFieldsByCategory(options.category)
        : await fieldService.getAllFields();
      
      if (fields.length === 0) {
        console.log(chalk.yellow('No fields found'));
        return;
      }

      console.log(chalk.white('Decision Fields:'));
      console.log('');
      
      // Group by category
      const grouped = fields.reduce((acc, field) => {
        const category = field.category || 'unknown';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(field);
        return acc;
      }, {} as Record<string, typeof fields>);

      Object.entries(grouped).forEach(([category, categoryFields]) => {
        console.log(chalk.blue(`${category.toUpperCase()}:`));
        categoryFields.forEach((field) => {
          console.log(chalk.gray(`  • ${field.id}`));
          console.log(chalk.white(`    ${field.name}`));
          if (field.description) {
            console.log(chalk.gray(`    ${field.description}`));
          }
          console.log(chalk.gray(`    Type: ${field.fieldType}`));
          console.log('');
        });
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Show field command
fieldCommand
  .command('show')
  .description('Show field details')
  .argument('<id>', 'Field ID')
  .action(async (id) => {
    try {
      const field = await fieldService.getField(id);
      
      if (!field) {
        console.error(chalk.red('Field not found'));
        process.exit(1);
      }

      console.log(chalk.white('Field Details:'));
      console.log('');
      console.log(chalk.gray(`ID: ${field.id}`));
      console.log(chalk.white(`Name: ${field.name}`));
      console.log(chalk.white(`Category: ${field.category}`));
      console.log(chalk.white(`Type: ${field.fieldType}`));
      
      if (field.description) {
        console.log(chalk.white(`Description: ${field.description}`));
      }
      
      if (field.placeholder) {
        console.log(chalk.gray(`Placeholder: ${field.placeholder}`));
      }
      
      if (field.extractionPrompt) {
        console.log(chalk.blue('\nExtraction Prompt:'));
        console.log(chalk.gray(field.extractionPrompt));
      }
      
      if (field.validationRules && Object.keys(field.validationRules).length > 0) {
        console.log(chalk.blue('\nValidation Rules:'));
        console.log(chalk.gray(JSON.stringify(field.validationRules, null, 2)));
      }
      
      console.log(chalk.gray(`\nVersion: ${field.version}`));
      console.log(chalk.gray(`Custom: ${field.isCustom ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`Created: ${field.createdAt}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
