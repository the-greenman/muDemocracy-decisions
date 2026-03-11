import { Command } from "commander";
import chalk from "chalk";
import { api, type ApiStatusResponse } from "../client.js";

export const statusCommand = new Command("status")
  .description("Show API runtime status and LLM configuration")
  .action(async () => {
    const response = await api.get<ApiStatusResponse>("/api/status");
    console.log(chalk.green(`API status: ${response.status}`));
    console.log(chalk.gray(`Timestamp:           ${response.timestamp}`));
    console.log(chalk.white(`Node environment:    ${response.nodeEnv}`));
    console.log(chalk.white(`Database configured: ${response.databaseConfigured ? "yes" : "no"}`));
    console.log(chalk.white(`LLM mode:            ${response.llm.mode}`));
    console.log(chalk.white(`LLM provider:        ${response.llm.provider}`));
    console.log(chalk.white(`LLM model:           ${response.llm.model}`));
  });
