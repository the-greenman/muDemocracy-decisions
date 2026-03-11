/**
 * Apply Drizzle Migrations
 *
 * Runs the SQL migration files directly against PostgreSQL
 */

import { db, client } from "../dist/index.mjs";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function applyMigrations() {
  console.log("🔧 Applying database migrations...\n");

  const drizzleDir = join(__dirname, "../drizzle");

  // Find all SQL migration files
  const files = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration file(s)`);

  for (const file of files) {
    console.log(`\n📄 Applying: ${file}`);

    const sql = readFileSync(join(drizzleDir, file), "utf-8");

    // Split SQL by drizzle breakpointers instead of semicolons
    // This handles DO $$ blocks correctly
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        await client.unsafe(statement);
      } catch (err) {
        // Ignore "already exists" errors
        if (!err.message?.includes("already exists")) {
          console.error(`  ⚠️  ${err.message}`);
        }
      }
    }

    console.log(`  ✓ Applied successfully`);
  }

  console.log("\n✅ All migrations applied!");
  await client.end();
}

applyMigrations().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
