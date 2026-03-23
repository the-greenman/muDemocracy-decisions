#!/usr/bin/env node
/**
 * Bump the API semver version in apps/api/package.json.
 *
 * Usage:
 *   node scripts/bump-api-version.mjs          # patch (default)
 *   node scripts/bump-api-version.mjs --patch
 *   node scripts/bump-api-version.mjs --minor
 *   node scripts/bump-api-version.mjs --major
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const pkgPath = resolve(rootDir, "apps/api/package.json");

const args = process.argv.slice(2);
const segment = args.includes("--major") ? "major" : args.includes("--minor") ? "minor" : "patch";

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const current = pkg.version;

const [major, minor, patch] = current.split(".").map(Number);

let next;
if (segment === "major") next = `${major + 1}.0.0`;
else if (segment === "minor") next = `${major}.${minor + 1}.0`;
else next = `${major}.${minor}.${patch + 1}`;

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

console.log(`API version: ${current} → ${next} (${segment})`);
