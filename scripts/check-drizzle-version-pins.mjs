import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const packageJsonPath = resolve(rootDir, "packages/db/package.json");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const requiredPins = {
  dependencies: {
    "drizzle-orm": "0.29.5",
  },
  devDependencies: {
    "drizzle-kit": "0.20.18",
  },
};

const failures = [];

for (const [section, dependencies] of Object.entries(requiredPins)) {
  const packageSection = packageJson[section] ?? {};

  for (const [packageName, expectedVersion] of Object.entries(dependencies)) {
    const actualVersion = packageSection[packageName];

    if (actualVersion !== expectedVersion) {
      failures.push(
        `${section}.${packageName} must be pinned to ${expectedVersion}; found ${actualVersion ?? "missing"}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Drizzle package pins are out of compliance.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Drizzle package pin check passed.");
