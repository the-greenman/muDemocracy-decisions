import { Command } from "commander";
import { contextCommand } from "./context.js";
import { decisionsCommand } from "./decisions.js";
import { draftCommand } from "./draft.js";
import { meetingCommand } from "./meeting.js";
import { statusCommand } from "./status.js";
import { transcriptCommand } from "./transcript.js";

export function registerCommands(program: Command): void {
  program.addCommand(statusCommand);
  program.addCommand(meetingCommand);
  program.addCommand(contextCommand);
  program.addCommand(decisionsCommand);
  program.addCommand(draftCommand);
  program.addCommand(transcriptCommand);
}
