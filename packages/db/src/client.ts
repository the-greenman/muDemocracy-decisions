/**
 * Database Client
 * 
 * Provides a singleton drizzle client for database connections.
 * Uses environment variable DATABASE_URL for connection string.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection string from environment
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/decision_logger';

// Create postgres client
// For serverless/edge environments, use { prepare: false }
const client = postgres(connectionString, {
  prepare: false, // Required for some edge environments
  max: 10, // Connection pool size
});

// Create drizzle database instance
export const db = drizzle(client, { schema });

// Export client for raw queries if needed
export { client };

// Type export for database instance
export type Database = typeof db;
