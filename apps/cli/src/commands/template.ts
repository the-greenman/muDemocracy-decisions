import { Command } from 'commander';
import chalk from 'chalk';
import { DecisionTemplateService } from '@repo/core';
import { DrizzleDecisionTemplateRepository, DrizzleTemplateFieldAssignmentRepository } from '@repo/db';

// Create service instance
const templateRepo = new DrizzleDecisionTemplateRepository();
const fieldAssignmentRepo = new DrizzleTemplateFieldAssignmentRepository();
const templateService = new DecisionTemplateService(templateRepo, fieldAssignmentRepo);

export const templateCommand = new Command('template')
  .description('Decision template management commands');

// List templates command
templateCommand
  .command('list')
  .description('List all decision templates')
  .action(async () => {
    try {
      const templates = await templateService.getAllTemplates();
      
      if (templates.length === 0) {
        console.log(chalk.yellow('No templates found'));
        return;
      }

      console.log(chalk.white('Decision Templates:'));
      console.log('');
      
      templates.forEach((template) => {
        console.log(chalk.gray(`${template.id}`));
        console.log(chalk.white(`Name: ${template.name}`));
        if (template.description) {
          console.log(chalk.gray(`  ${template.description}`));
        }
        console.log(chalk.blue(`  Category: ${template.category}`));
        console.log(chalk.gray(`  Fields: ${template.fields.length}`));
        if (template.isDefault) {
          console.log(chalk.green('  ✓ Default'));
        }
        if (template.isCustom) {
          console.log(chalk.yellow('  Custom'));
        }
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Show template command
templateCommand
  .command('show')
  .description('Show template details')
  .argument('<id>', 'Template ID or name')
  .action(async (id) => {
    try {
      // Try to find by ID first, then by name
      let template = await templateService.getTemplate(id);
      if (!template) {
        const allTemplates = await templateService.getAllTemplates();
        template = allTemplates.find(t => t.name.toLowerCase() === id.toLowerCase()) || null;
      }
      
      if (!template) {
        console.error(chalk.red('Template not found'));
        process.exit(1);
      }

      console.log(chalk.white('Template Details:'));
      console.log('');
      console.log(chalk.gray(`ID: ${template.id}`));
      console.log(chalk.white(`Name: ${template.name}`));
      console.log(chalk.white(`Category: ${template.category}`));
      
      if (template.description) {
        console.log(chalk.white(`Description: ${template.description}`));
      }
      
      console.log(chalk.gray(`Version: ${template.version}`));
      console.log(chalk.gray(`Fields: ${template.fields.length}`));
      
      if (template.isDefault) {
        console.log(chalk.green('✓ Default Template'));
      }
      
      if (template.fields.length > 0) {
        console.log(chalk.blue('\nFields:'));
        template.fields.forEach((field, index) => {
          const required = field.required ? chalk.red('*') : chalk.gray(' ');
          console.log(`${required} ${index + 1}. ${field.fieldId}`);
          
          if (field.customLabel) {
            console.log(chalk.white(`   Label: ${field.customLabel}`));
          }
          
          if (field.customDescription) {
            console.log(chalk.gray(`   ${field.customDescription}`));
          }
          
          console.log(chalk.gray(`   Order: ${field.order}`));
          console.log('');
        });
      }
      
      console.log(chalk.gray(`Created: ${template.createdAt}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
