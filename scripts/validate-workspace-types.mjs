import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

const tsconfigFiles = [
  "apps/api/tsconfig.json",
  "apps/api/tsconfig.typecheck.json",
  "apps/cli/tsconfig.json",
  "apps/web/tsconfig.json",
  "packages/core/tsconfig.json",
  "packages/core/tsconfig.declarations.json",
  "packages/db/tsconfig.json",
  "packages/db/tsconfig.declarations.json",
  "packages/schema/tsconfig.json",
  "tsconfig.json",
  "tsconfig.base.json",
];

const packageJsonFiles = [
  "apps/api/package.json",
  "apps/cli/package.json",
  "apps/web/package.json",
  "packages/core/package.json",
  "packages/db/package.json",
  "packages/schema/package.json",
  "package.json",
];

const errors = [];

function readJson(relativePath) {
  const absolutePath = resolve(rootDir, relativePath);
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

for (const relativePath of tsconfigFiles) {
  const config = readJson(relativePath);
  const compilerOptions = config.compilerOptions ?? {};
  const paths = compilerOptions.paths ?? {};
  const isTypecheckConfig = basename(relativePath).includes("typecheck");
  const isDeclarationConfig = basename(relativePath).includes("declarations");

  for (const [alias, targets] of Object.entries(paths)) {
    if (!alias.startsWith("@repo/")) {
      continue;
    }

    const targetList = Array.isArray(targets) ? targets : [targets];
    const distDeclarationTargets = targetList.filter(
      (target) => typeof target === "string" && /dist\/.*\.d\.ts$/u.test(target)
    );

    if (!isTypecheckConfig && !isDeclarationConfig && distDeclarationTargets.length > 0) {
      errors.push(
        `${relativePath}: build/dev tsconfig must not map ${alias} to declaration outputs (${distDeclarationTargets.join(", ")}). Use runtime package exports instead.`
      );
    }
  }
}

for (const relativePath of packageJsonFiles) {
  const pkg = readJson(relativePath);

  const buildScript = pkg.scripts?.build;
  if (typeof buildScript === "string") {
    const hasTsup = buildScript.includes("tsup");
    const hasTsc = buildScript.includes("tsc");
    const tsupOwnsDts = buildScript.includes("--dts") || !buildScript.includes("--no-dts");

    if (hasTsup && hasTsc && tsupOwnsDts) {
      errors.push(
        `${relativePath}: build script mixes tsup and tsc without disabling tsup DTS output. Keep a single declaration owner.`
      );
    }
  }

  if (typeof pkg.types === "string") {
    const absoluteTypesPath = resolve(rootDir, dirname(relativePath), pkg.types);
    const hasBuildScript = typeof pkg.scripts?.build === "string";

    if (!hasBuildScript && !existsSync(absoluteTypesPath)) {
      errors.push(
        `${relativePath}: advertised types entry ${pkg.types} does not exist and no build script is available to produce it.`
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Workspace type/declaration validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Workspace type/declaration validation passed.");
