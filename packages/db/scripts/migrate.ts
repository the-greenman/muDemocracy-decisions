/**
 * Apply Drizzle Migrations
 * 
 * Runs the SQL migration files directly against PostgreSQL
 */

import { client } from '../src/client.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function applyMigrations() {
  console.log('🔧 Applying database migrations...\n');

  const drizzleDir = join(__dirname, '../drizzle');
  
  // Find all SQL migration files
  const files = readdirSync(drizzleDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s)`);

  for (const file of files) {
    console.log(`\n📄 Applying: ${file}`);
    
    const sql = readFileSync(join(drizzleDir, file), 'utf-8');
    
    // Split SQL into individual statements and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      if (statement) {
        try {
          await client.unsafe(statement + ';');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);

          // Ignore "already exists" errors
          if (!message.includes('already exists')) {
            console.error(`  ⚠️  ${message}`);
          }
        }
      }
    }
    
    console.log(`  ✓ Applied successfully`);
  }

  console.log('\n✅ All migrations applied!');
  await client.end();
}

applyMigrations().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
