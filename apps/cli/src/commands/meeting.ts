import { Command } from "commander";
import chalk from "chalk";
import { api, type Meeting } from "../client.js";
import { promptRequiredList, withSpinner } from "../runtime.js";

function printMeeting(m: Meeting) {
  console.log(chalk.gray(`ID:           ${m.id}`));
  console.log(chalk.white(`Title:        ${m.title}`));
  console.log(chalk.white(`Date:         ${m.date}`));
  console.log(chalk.white(`Participants: ${m.participants.join(", ")}`));
  console.log(chalk.gray(`Status:       ${m.status}`));
}

export const meetingCommand = new Command("meeting").description("Meeting management");

meetingCommand
  .command("create")
  .description("Create a new meeting")
  .argument("<title>", "Meeting title")
  .option("-p, --participants <list>", "Comma-separated participants")
  .option("-d, --date <date>", "Meeting date (YYYY-MM-DD)", new Date().toISOString().split("T")[0])
  .action(async (title: string, opts: { participants?: string; date: string }) => {
    const participantsInput = await promptRequiredList(
      "Participants (comma-separated):",
      opts.participants,
    );
    if (!participantsInput) {
      throw new Error(
        'Participants are required. Pass --participants "Alice,Bob" or provide them interactively.',
      );
    }

    const meeting = await withSpinner("Creating meeting…", () =>
      api.post<Meeting>("/api/meetings", {
        title,
        date: `${opts.date}T00:00:00Z`,
        participants: participantsInput.split(",").map((p) => p.trim()),
      }),
    );
    console.log(chalk.green("✓ Meeting created"));
    printMeeting(meeting);
  });

meetingCommand
  .command("list")
  .description("List all meetings")
  .action(async () => {
    const { meetings } = await api.get<{ meetings: Meeting[] }>("/api/meetings");
    if (meetings.length === 0) {
      console.log(chalk.yellow("No meetings found"));
      return;
    }
    meetings.forEach((m, i) => {
      console.log(chalk.gray(`\n${i + 1}. ${m.id}`));
      printMeeting(m);
    });
  });

meetingCommand
  .command("show")
  .description("Show meeting details")
  .argument("<id>", "Meeting ID")
  .action(async (id: string) => {
    const meeting = await api.get<Meeting>(`/api/meetings/${id}`);
    printMeeting(meeting);
  });
