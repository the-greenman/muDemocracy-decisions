import { Command } from 'commander';
import chalk from 'chalk';
import { meetingCommand } from './commands/meeting';

const program = new Command();

program
  .name('decision-logger')
  .description('CLI for the Decision Logger system')
  .version('1.0.0');

// Add sub-commands
program.addCommand(meetingCommand);

// Global error handler
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
  writeOut: (str) => process.stdout.write(str),
});

// Parse arguments
program.parse();
