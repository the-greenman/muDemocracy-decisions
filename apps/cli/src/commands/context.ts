import { Command } from "commander";
import chalk from "chalk";
import { api, getContext, requireActiveMeeting, resolvedConnectionId, type GlobalContext } from "../client.js";
import { confirmAction } from "../runtime.js";

function printContext(ctx: GlobalContext) {
  console.log(chalk.white("Active context:"));
  console.log(chalk.gray(`  Meeting:          ${ctx.activeMeetingId ?? "(none)"}`));
  if (ctx.activeMeeting) {
    console.log(chalk.white(`                    ${ctx.activeMeeting.title}`));
  }
  console.log(chalk.gray(`  Decision:         ${ctx.activeDecisionId ?? "(none)"}`));
  if (ctx.activeDecision) {
    console.log(chalk.white(`                    ${ctx.activeDecision.suggestedTitle}`));
  }
  console.log(chalk.gray(`  Decision context: ${ctx.activeDecisionContextId ?? "(none)"}`));
  console.log(chalk.gray(`  Active field:     ${ctx.activeField ?? "(none)"}`));
}

export const contextCommand = new Command("context").description("Active session context");

contextCommand
  .command("show")
  .description("Show current active context")
  .action(async () => {
    const ctx = await getContext();
    console.log(chalk.gray(`  Connection:       ${resolvedConnectionId() ?? "(unknown)"}`));
    printContext(ctx);
  });

contextCommand
  .command("set-meeting")
  .description("Set active meeting")
  .argument("<id>", "Meeting ID")
  .action(async (id: string) => {
    const ctx = await api.post<GlobalContext>("/api/context/meeting", { meetingId: id });
    console.log(chalk.green("✓ Active meeting set"));
    printContext(ctx);
  });

contextCommand
  .command("clear-meeting")
  .description("Clear active meeting (and decision context)")
  .option("--yes", "Skip confirmation prompt")
  .action(async (opts: { yes?: boolean }) => {
    if (!opts.yes) {
      const confirmed = await confirmAction("Clear the active meeting and decision context?");
      if (!confirmed) {
        console.log(chalk.yellow("Clear meeting cancelled"));
        return;
      }
    }
    const ctx = await api.delete<GlobalContext>("/api/context/meeting");
    console.log(chalk.green("✓ Active meeting cleared"));
    printContext(ctx);
  });

contextCommand
  .command("set-decision")
  .description("Set active decision (creates a decision context if needed)")
  .argument("<flagged-decision-id>", "Flagged decision ID")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .option("-t, --template-id <id>", "Template ID to use when creating context")
  .action(async (flaggedDecisionId: string, opts: { meetingId?: string; templateId?: string }) => {
    const meetingId = opts.meetingId ?? (await requireActiveMeeting());
    const body: Record<string, unknown> = { flaggedDecisionId };
    if (opts.templateId) body.templateId = opts.templateId;
    const ctx = await api.post<GlobalContext>(`/api/meetings/${meetingId}/context/decision`, body);
    console.log(chalk.green("✓ Active decision set"));
    printContext(ctx);
  });

contextCommand
  .command("clear-decision")
  .description("Clear active decision context")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .option("--yes", "Skip confirmation prompt")
  .action(async (opts: { meetingId?: string; yes?: boolean }) => {
    const meetingId = opts.meetingId ?? (await requireActiveMeeting());
    if (!opts.yes) {
      const confirmed = await confirmAction(
        `Clear the active decision context for meeting ${meetingId}?`,
      );
      if (!confirmed) {
        console.log(chalk.yellow("Clear decision cancelled"));
        return;
      }
    }
    const ctx = await api.delete<GlobalContext>(`/api/meetings/${meetingId}/context/decision`);
    console.log(chalk.green("✓ Active decision cleared"));
    printContext(ctx);
  });

contextCommand
  .command("set-field")
  .description("Set active field focus")
  .argument("<field-id>", "Field ID")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .action(async (fieldId: string, opts: { meetingId?: string }) => {
    const meetingId = opts.meetingId ?? (await requireActiveMeeting());
    const ctx = await api.post<GlobalContext>(`/api/meetings/${meetingId}/context/field`, {
      fieldId,
    });
    console.log(chalk.green("✓ Active field set"));
    printContext(ctx);
  });

contextCommand
  .command("clear-field")
  .description("Clear active field focus")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .option("--yes", "Skip confirmation prompt")
  .action(async (opts: { meetingId?: string; yes?: boolean }) => {
    const meetingId = opts.meetingId ?? (await requireActiveMeeting());
    if (!opts.yes) {
      const confirmed = await confirmAction(
        `Clear the active field focus for meeting ${meetingId}?`,
      );
      if (!confirmed) {
        console.log(chalk.yellow("Clear field cancelled"));
        return;
      }
    }
    const ctx = await api.delete<GlobalContext>(`/api/meetings/${meetingId}/context/field`);
    console.log(chalk.green("✓ Active field cleared"));
    printContext(ctx);
  });
