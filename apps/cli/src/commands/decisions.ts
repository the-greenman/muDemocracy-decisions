import { Command } from "commander";
import chalk from "chalk";
import {
  api,
  requireActiveMeeting,
  type FlaggedDecision,
  type FlaggedDecisionListItem,
} from "../client.js";
import { promptRequiredString, withSpinner } from "../runtime.js";

function printDecision(d: FlaggedDecision | FlaggedDecisionListItem, index?: number) {
  const prefix = index !== undefined ? `${index + 1}. ` : "";
  console.log(chalk.gray(`${prefix}${d.id}`));
  console.log(chalk.white(`   Title:      ${d.suggestedTitle}`));
  console.log(chalk.white(`   Status:     ${d.status}`));
  console.log(chalk.white(`   Priority:   ${d.priority}`));
  console.log(chalk.white(`   Confidence: ${(d.confidence * 100).toFixed(0)}%`));
  if (d.contextSummary) {
    console.log(chalk.gray(`   Context:    ${d.contextSummary}`));
  }
  if ("contextId" in d) {
    console.log(chalk.white(`   Draft:      ${d.contextId ? "yes" : "no"}`));
    if (d.contextId) {
      console.log(chalk.gray(`   Context ID: ${d.contextId}`));
      console.log(chalk.white(`   Draft state:${d.contextStatus ?? "unknown"}`));
      console.log(chalk.white(`   Fields:     ${d.draftFieldCount}`));
      console.log(chalk.white(`   Versions:   ${d.versionCount}`));
    }
  }
}

export const decisionsCommand = new Command("decisions").description("Flagged decision management");

decisionsCommand
  .command("list")
  .description("List flagged decisions for a meeting")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .option("-s, --status <status>", "Filter by status: pending|accepted|rejected|dismissed")
  .action(async (opts: { meetingId?: string; status?: string }, command: Command) => {
    const resolvedOpts = command.opts<{ meetingId?: string; status?: string }>();
    const meetingId = resolvedOpts.meetingId || opts.meetingId || (await requireActiveMeeting());
    const status = resolvedOpts.status ?? opts.status;
    const qs = status ? `?status=${status}` : "";
    const { decisions } = await api.get<{ decisions: FlaggedDecisionListItem[] }>(
      `/api/meetings/${meetingId}/flagged-decisions${qs}`,
    );
    if (decisions.length === 0) {
      console.log(chalk.yellow("No flagged decisions found"));
      return;
    }
    console.log(chalk.white(`Flagged decisions for meeting ${meetingId}:\n`));
    decisions.forEach((d, i) => {
      printDecision(d, i);
      console.log("");
    });
  });

decisionsCommand
  .command("flag")
  .description("Manually flag a decision")
  .option("-t, --title <title>", "Decision title")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .option("-c, --context <summary>", "Context summary")
  .action(
    async (opts: { title?: string; meetingId?: string; context?: string }, command: Command) => {
      const resolvedOpts = command.opts<{ title?: string; meetingId?: string; context?: string }>();
      const meetingId = resolvedOpts.meetingId || opts.meetingId || (await requireActiveMeeting());
      const title = await promptRequiredString("Decision title:", resolvedOpts.title ?? opts.title);
      if (!title) {
        throw new Error(
          'Decision title is required. Pass --title "Approve migration" or provide it interactively.',
        );
      }
      const contextSummary = resolvedOpts.context ?? opts.context ?? "";
      const decision = await withSpinner("Flagging decision…", () =>
        api.post<FlaggedDecision>(`/api/meetings/${meetingId}/flagged-decisions`, {
          suggestedTitle: title,
          contextSummary,
          confidence: 1.0,
          priority: 0,
          chunkIds: [],
        }),
      );
      console.log(chalk.green("✓ Decision flagged"));
      printDecision(decision);
    },
  );

decisionsCommand
  .command("update")
  .description("Update a flagged decision")
  .argument("<id>", "Flagged decision ID")
  .option("-t, --title <title>", "New title")
  .option("-s, --status <status>", "New status: pending|accepted|rejected|dismissed")
  .option("-p, --priority <n>", "New priority (integer)")
  .action(async (id: string, opts: { title?: string; status?: string; priority?: string }) => {
    const body: Record<string, unknown> = {};
    if (opts.title) body.suggestedTitle = opts.title;
    if (opts.status) body.status = opts.status;
    if (opts.priority !== undefined) body.priority = parseInt(opts.priority, 10);

    const decision = await api.patch<FlaggedDecision>(`/api/flagged-decisions/${id}`, body);
    console.log(chalk.green("✓ Decision updated"));
    printDecision(decision);
  });
