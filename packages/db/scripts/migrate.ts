/**
 * Apply Drizzle Migrations
 * 
 * Runs the SQL migration files directly against PostgreSQL
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from '../src/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isEntrypoint = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

export async function applyMigrations() {
  const migrationsFolder = join(__dirname, '../drizzle');

  console.log('🔧 Applying committed database migrations...');
  console.log(`📁 Migrations folder: ${migrationsFolder}`);

  await migrate(db, {
    migrationsFolder,
  });

  console.log('✅ All committed migrations applied.');
  await client.end();
}

if (isEntrypoint) {
  applyMigrations().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
