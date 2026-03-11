import { Command } from "commander";
import chalk from "chalk";
import { meetingCommand } from "./commands/meeting.js";
import { transcriptCommand } from "./commands/transcript.js";
import { decisionsCommand } from "./commands/decisions.js";
import { contextCommand } from "./commands/context.js";
import { draftCommand } from "./commands/draft.js";
import { statusCommand } from "./commands/status.js";
import { setCliVerbose } from "./runtime.js";

const program = new Command();

program
  .name("dlogger")
  .description("CLI for the Decision Logger system")
  .version("1.0.0")
  .option("--verbose", "Print raw HTTP request/response details for debugging");

program.addCommand(meetingCommand);
program.addCommand(transcriptCommand);
program.addCommand(decisionsCommand);
program.addCommand(contextCommand);
program.addCommand(draftCommand);
program.addCommand(statusCommand);

program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
  writeOut: (str) => process.stdout.write(str),
});

async function main() {
  program.hook("preAction", (thisCommand) => {
    const opts = thisCommand.optsWithGlobals<{ verbose?: boolean }>();
    setCliVerbose(Boolean(opts.verbose));
  });
  await program.parseAsync(process.argv);
  process.exit(0);
}

process.on("uncaughtException", (error) => {
  console.error(chalk.red("Error:"), error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error(chalk.red("Error:"), msg);
  process.exit(1);
});

main().catch((error) => {
  console.error(chalk.red("Error:"), error instanceof Error ? error.message : String(error));
  process.exit(1);
});
