import { Command } from 'commander';
import chalk from 'chalk';
import { createMeetingService } from '@repo/core';

// Create service instance
const meetingService = createMeetingService();

export const meetingCommand = new Command('meeting')
  .description('Meeting management commands');

// Create meeting command
meetingCommand
  .command('create')
  .description('Create a new meeting')
  .argument('<title>', 'Meeting title')
  .option('-d, --date <date>', 'Meeting date (YYYY-MM-DD)', new Date().toISOString().split('T')[0])
  .option('-p, --participants <participants>', 'Comma-separated list of participants')
  .action(async (title, options) => {
    try {
      if (!options.participants) {
        console.error(chalk.red('Error: Participants are required'));
        process.exit(1);
      }

      const participants = options.participants.split(',').map((p: string) => p.trim());
      const date = new Date(options.date).toISOString();
      
      const meeting = await meetingService.create({
        title,
        date,
        participants,
      });

      console.log(chalk.green('✓ Meeting created successfully'));
      console.log(chalk.gray(`ID: ${meeting.id}`));
      console.log(chalk.white(`Title: ${meeting.title}`));
      console.log(chalk.white(`Date: ${meeting.date}`));
      console.log(chalk.white(`Participants: ${meeting.participants.join(', ')}`));
      console.log(chalk.gray(`Status: ${meeting.status}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// List meetings command
meetingCommand
  .command('list')
  .description('List all meetings')
  .action(async () => {
    try {
      const meetings = await meetingService.findAll();
      
      if (meetings.length === 0) {
        console.log(chalk.yellow('No meetings found'));
        return;
      }

      console.log(chalk.white('Meetings:'));
      console.log('');
      
      meetings.forEach((meeting, index) => {
        console.log(chalk.gray(`${index + 1}. ${meeting.id}`));
        console.log(chalk.white(`   Title: ${meeting.title}`));
        console.log(chalk.white(`   Date: ${meeting.date}`));
        console.log(chalk.white(`   Participants: ${meeting.participants.join(', ')}`));
        console.log(chalk.gray(`   Status: ${meeting.status}`));
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Show meeting command
meetingCommand
  .command('show')
  .description('Show meeting details')
  .argument('<id>', 'Meeting ID')
  .action(async (id) => {
    try {
      const meeting = await meetingService.findById(id);
      
      if (!meeting) {
        console.error(chalk.red('Meeting not found'));
        process.exit(1);
      }

      console.log(chalk.white('Meeting Details:'));
      console.log('');
      console.log(chalk.gray(`ID: ${meeting.id}`));
      console.log(chalk.white(`Title: ${meeting.title}`));
      console.log(chalk.white(`Date: ${meeting.date}`));
      console.log(chalk.white(`Participants: ${meeting.participants.join(', ')}`));
      console.log(chalk.gray(`Status: ${meeting.status}`));
      console.log(chalk.gray(`Created: ${meeting.createdAt}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Update meeting command
meetingCommand
  .command('update')
  .description('Update meeting title or participants')
  .argument('<id>', 'Meeting ID')
  .option('-t, --title <title>', 'New meeting title')
  .option('-p, --participants <participants>', 'Comma-separated list of participants')
  .action(async (id, options) => {
    try {
      if (!options.title && !options.participants) {
        console.error(chalk.red('Error: At least one of --title or --participants must be provided'));
        process.exit(1);
      }

      const updateData: Partial<{ title: string; participants: string[] }> = {};
      
      if (options.title) {
        updateData.title = options.title;
      }
      
      if (options.participants) {
        updateData.participants = options.participants.split(',').map((p: string) => p.trim());
      }

      const meeting = await meetingService.update(id, updateData);

      console.log(chalk.green('✓ Meeting updated successfully'));
      console.log(chalk.gray(`ID: ${meeting.id}`));
      console.log(chalk.white(`Title: ${meeting.title}`));
      console.log(chalk.white(`Date: ${meeting.date}`));
      console.log(chalk.white(`Participants: ${meeting.participants.join(', ')}`));
      console.log(chalk.gray(`Status: ${meeting.status}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
