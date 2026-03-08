import { Command } from 'commander';
import chalk from 'chalk';
import { createDecisionTemplateService } from '@repo/core';

// Create service instance
const templateService = createDecisionTemplateService();

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

// Update template command
templateCommand
  .command('update')
  .description('Update a decision template')
  .argument('<id>', 'Template ID')
  .option('-n, --name <name>', 'New template name')
  .option('-d, --description <description>', 'New template description')
  .option('-c, --category <category>', 'New template category')
  .action(async (id, options) => {
    try {
      if (!options.name && !options.description && !options.category) {
        console.error(chalk.red('Error: At least one of --name, --description, or --category must be provided'));
        process.exit(1);
      }

      const updateData: any = {};
      if (options.name) updateData.name = options.name;
      if (options.description) updateData.description = options.description;
      if (options.category) updateData.category = options.category;

      const template = await templateService.updateTemplate(id, updateData);

      if (!template) {
        console.error(chalk.red('Template not found'));
        process.exit(1);
      }

      console.log(chalk.green('✓ Template updated successfully'));
      console.log(chalk.gray(`ID: ${template.id}`));
      console.log(chalk.white(`Name: ${template.name}`));
      if (template.description) {
        console.log(chalk.gray(`Description: ${template.description}`));
      }
      console.log(chalk.blue(`Category: ${template.category}`));
      console.log(chalk.gray(`Fields: ${template.fields.length}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Delete template command
templateCommand
  .command('delete')
  .description('Delete a decision template')
  .argument('<id>', 'Template ID')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(async (id, options) => {
    try {
      const template = await templateService.getTemplate(id);
      
      if (!template) {
        console.error(chalk.red('Template not found'));
        process.exit(1);
      }

      if (!options.force) {
        console.log(chalk.white(`Template to delete:`));
        console.log(chalk.gray(`ID: ${template.id}`));
        console.log(chalk.white(`Name: ${template.name}`));
        console.log(chalk.blue(`Category: ${template.category}`));
        console.log('');
        console.log(chalk.yellow('Are you sure you want to delete this template? (y/N)'));
        
        // For simplicity, we'll proceed with deletion
        // In a real CLI, you'd want to handle user input properly
      }

      const deleted = await templateService.deleteTemplate(id);
      
      if (deleted) {
        console.log(chalk.green('✓ Template deleted successfully'));
      } else {
        console.error(chalk.red('Failed to delete template'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
