import { Command } from 'commander';
import chalk from 'chalk';
import { meetingCommand } from './commands/meeting';
import { transcriptCommand } from './commands/transcript';
import { decisionCommand } from './commands/decision';

const program = new Command();

program
  .name('decision-logger')
  .description('CLI for the Decision Logger system')
  .version('1.0.0');

// Add sub-commands
program.addCommand(meetingCommand);
program.addCommand(transcriptCommand);
program.addCommand(decisionCommand);

// Global error handler
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
  writeOut: (str) => process.stdout.write(str),
});

// Parse arguments
program.parse();

// If we reach here, the command completed successfully
// Give it a moment for any async operations, then exit
setTimeout(() => {
  process.exit(0);
}, 50);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});
