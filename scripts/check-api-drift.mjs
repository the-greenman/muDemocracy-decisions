#!/usr/bin/env node
/**
 * Check that apps/api/openapi.yaml is up-to-date with the current source.
 *
 * Runs after `pnpm build` (requires apps/api/dist/index.js to exist).
 * Fails if the committed openapi.yaml would change on regeneration, prompting
 * the developer to run `pnpm api:generate` and commit the result.
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const specPath = resolve(rootDir, "apps/api/openapi.yaml");

function hashFile(path) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const before = hashFile(specPath);

execSync("pnpm --filter @repo/api run generate:openapi", {
  cwd: rootDir,
  stdio: "inherit",
});

const after = hashFile(specPath);

if (before !== after) {
  if (before === null) {
    console.error("OpenAPI spec does not exist. Run `pnpm api:generate` and commit apps/api/openapi.yaml.");
  } else {
    console.error("OpenAPI spec drift detected: apps/api/openapi.yaml changed after regeneration.");
    console.error("Run `pnpm api:generate` and commit the updated openapi.yaml before pushing.");
  }
  process.exit(1);
}

console.log("OpenAPI spec drift check passed.");
