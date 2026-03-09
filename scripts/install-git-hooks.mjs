import { mkdirSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const hooksDir = resolve(rootDir, ".githooks");
const gitHooksDir = resolve(rootDir, ".git", "hooks");
const preCommitSource = resolve(hooksDir, "pre-commit");
const preCommitTarget = resolve(gitHooksDir, "pre-commit");

if (!existsSync(resolve(rootDir, ".git"))) {
  process.exit(0);
}

mkdirSync(gitHooksDir, { recursive: true });
const script = `#!/usr/bin/env sh
. "$(dirname "$0")/../../.githooks/pre-commit"
`;
writeFileSync(preCommitTarget, script, "utf8");
chmodSync(preCommitTarget, 0o755);

if (existsSync(preCommitSource)) {
  chmodSync(preCommitSource, 0o755);
}
