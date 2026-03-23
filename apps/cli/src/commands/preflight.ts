import * as net from "node:net";
import { Command } from "commander";
import chalk from "chalk";
import { BASE_URL } from "../client.js";

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (e: NodeJS.ErrnoException) => resolve(e.code === "EADDRINUSE"));
    server.once("listening", () => server.close(() => resolve(false)));
    server.listen(port, "127.0.0.1");
  });
}

function portFromUrl(url: string): number | null {
  try {
    const parsed = new URL(url);
    if (parsed.port) return parseInt(parsed.port, 10);
    return parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}

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

async function checkPort(
  port: number,
  label: string,
  healthUrl?: string,
): Promise<boolean> {
  const inUse = await isPortInUse(port);

  if (!inUse) {
    console.log(chalk.green(`  Port ${port} (${label}): free`));
    return true;
  }

  // Port is occupied — try to identify what's there
  if (healthUrl) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const body = (await res.json()) as { status?: string; startedAt?: string };
        const age = body.startedAt ? ` (started ${formatAge(body.startedAt)})` : "";
        console.log(
          chalk.yellow(`  Port ${port} (${label}): occupied — ${label} already responding${age}`),
        );
        console.error(
          chalk.red(`\n  ✗ Port ${port} is in use. Stop it before starting a new instance.\n`),
        );
        return false;
      }
    } catch {
      // health check failed — something else is there
    }
  }

  console.error(
    chalk.red(
      `  Port ${port} (${label}): occupied by an unknown process\n  ✗ Stop whatever is on port ${port} before starting services.\n`,
    ),
  );
  return false;
}

export const preflightCommand = new Command("preflight")
  .description("Check that required ports are free before starting services")
  .option("--api-port <number>", "API port to check (overrides API_BASE_URL)")
  .option("--web-port <number>", "Web dev server port to check", "5173")
  .option("--api-only", "Only check the API port")
  .option("--web-only", "Only check the web port")
  .action(async (opts: { apiPort?: string; webPort?: string; apiOnly?: boolean; webOnly?: boolean }) => {
    const apiPort = opts.apiPort
      ? parseInt(opts.apiPort, 10)
      : (portFromUrl(BASE_URL) ?? 3001);
    const webPort = parseInt(opts.webPort ?? "5173", 10);

    const checks: Array<Promise<boolean>> = [];

    if (!opts.webOnly) {
      checks.push(checkPort(apiPort, "API", `${BASE_URL}/api/status`));
    }
    if (!opts.apiOnly) {
      checks.push(checkPort(webPort, "web", `http://localhost:${webPort}`));
    }

    const results = await Promise.all(checks);
    if (results.some((ok) => !ok)) {
      process.exit(1);
    }
  });
