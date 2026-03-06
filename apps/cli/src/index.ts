import { Command } from 'commander';
import chalk from 'chalk';
import { meetingCommand } from './commands/meeting';
import { transcriptCommand } from './commands/transcript';
import { decisionCommand } from './commands/decision';
import { fieldCommand } from './commands/field';
import { templateCommand } from './commands/template';
import { decisionsCommand } from './commands/decisions';
import { draftCommand } from './commands/draft';
import { contextCommand } from './commands/context';

const program = new Command();

program
  .name('decision-logger')
  .description('CLI for the Decision Logger system')
  .version('1.0.0');

// Add sub-commands
program.addCommand(meetingCommand);
program.addCommand(transcriptCommand);
program.addCommand(decisionCommand);
program.addCommand(fieldCommand);
program.addCommand(templateCommand);
program.addCommand(decisionsCommand);
program.addCommand(draftCommand);
program.addCommand(contextCommand);

// Global error handler
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
  writeOut: (str) => process.stdout.write(str),
});

async function main() {
  // Parse arguments (async-aware)
  await program.parseAsync(process.argv);

  // Force exit after command completes.
  // Some dependencies (e.g. DB connection pools) keep the event loop alive.
  process.exit(0);
}

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

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
