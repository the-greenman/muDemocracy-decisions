import { Command } from "commander";
import chalk from "chalk";
import { api, BASE_URL, type ApiStatusResponse } from "../client.js";

function formatAge(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const statusCommand = new Command("status")
  .description("Show API runtime status and LLM configuration")
  .action(async () => {
    let response: ApiStatusResponse;
    try {
      response = await api.get<ApiStatusResponse>("/api/status");
    } catch {
      console.error(chalk.red(`API unreachable at ${BASE_URL}`));
      console.error(chalk.gray("Is the API running? Try: pnpm up:stack"));
      process.exit(1);
    }
    console.log(chalk.green(`API status: ${response.status}  v${response.version}`));
    console.log(chalk.gray(`Started:             ${response.startedAt} (${formatAge(response.startedAt)})`));
    console.log(chalk.gray(`Timestamp:           ${response.timestamp}`));
    console.log(chalk.white(`Node environment:    ${response.nodeEnv}`));
    console.log(chalk.white(`Database configured: ${response.databaseConfigured ? "yes" : "no"}`));
    console.log(chalk.white(`LLM mode:            ${response.llm.mode}`));
    console.log(chalk.white(`LLM provider:        ${response.llm.provider}`));
    console.log(chalk.white(`LLM model:           ${response.llm.model}`));
  });
