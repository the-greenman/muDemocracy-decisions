import { mkdirSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const hooksDir = resolve(rootDir, ".githooks");
const gitHooksDir = resolve(rootDir, ".git", "hooks");
const hookNames = ["pre-commit", "pre-push"];

if (!existsSync(resolve(rootDir, ".git"))) {
  process.exit(0);
}

mkdirSync(gitHooksDir, { recursive: true });

for (const hookName of hookNames) {
  const hookSource = resolve(hooksDir, hookName);
  const hookTarget = resolve(gitHooksDir, hookName);

  const script = `#!/usr/bin/env sh
. "$(dirname "$0")/../../.githooks/${hookName}"
`;

  writeFileSync(hookTarget, script, "utf8");
  chmodSync(hookTarget, 0o755);

  if (existsSync(hookSource)) {
    chmodSync(hookSource, 0o755);
  }
}
