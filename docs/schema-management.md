# Database Schema Management

**Status**: aligned reference
**Owns**: physical persistence strategy, migration workflow, DB validation
**Must sync with**: `packages/schema`, `docs/schema-api-alignment.md`, `docs/iterative-implementation-plan.md`

## Overview

The database schema is managed as **code-controlled, testable, and version-controlled** using Drizzle ORM. It is the physical persistence layer that implements the logical domain model defined in Zod.

## Schema Alignment with Zod

`packages/schema` is the source of truth for the **logical domain layer**. Drizzle implements the **database physical layer** in `packages/db`.

- **Logical Source of Truth**: `packages/schema/src/*.ts` (Zod)
- **Physical Implementation**: `packages/db/src/schema.ts` (Drizzle)

**Rule**: All data entering the system via API or CLI MUST be validated against a Zod schema before being passed to a Service, and subsequently to Drizzle. This "Validation-at-Edge" ensures the database layer remains clean and consistent.

The canonical domain schema starts in `packages/schema`, and the physical schema is then mapped into `packages/db/src/schema.ts`:

```typescript
// packages/db/src/schema.ts - physical persistence mapping
export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  // ...
});
```

This TypeScript file:
- ✅ **Type-safe** - TypeScript types are inferred from schema
- ✅ **Validated** - Compile-time checks for schema correctness
- ✅ **Testable** - Can write tests against schema
- ✅ **Version controlled** - Git tracks all changes
- ✅ **Generates migrations** - Automatic SQL migration generation
- ✅ **Self-documenting** - Code is the documentation

## Workflow

### 1. Define Schema (Planning Phase)

Define or update the domain schema in `packages/schema/src/*.ts`, then align `packages/db/src/schema.ts`:

```typescript
export const newTable = pgTable('new_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  nameIdx: index('idx_new_table_name').on(table.name),
}));
```

### 2. Generate Migration

```bash
npm run db:generate
```

This creates a migration file in `packages/db/migrations/`:

```sql
-- packages/db/migrations/0001_create_new_table.sql
CREATE TABLE "new_table" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "idx_new_table_name" ON "new_table" ("name");
```

### 3. Review Migration

Review the generated SQL to ensure it's correct.

### 4. Apply Migration

```bash
npm run db:migrate
```

Applies the migration to your database.

### 5. Validate Schema

```bash
npm run db:validate
```

Checks that database matches schema definition.

## Schema Validation & Testing

### Type Safety

TypeScript ensures schema correctness at compile time:

```typescript
// This will fail at compile time if schema is wrong
const meeting: typeof meetings.$inferSelect = {
  id: '123',
  title: 'Meeting',
  date: new Date(),
  participants: ['Alice', 'Bob'],
  status: 'active',
  createdAt: new Date(),
};
```

### Schema Tests

```typescript
// schema/schema.test.ts
import { describe, it, expect } from 'vitest';
import { meetings, transcriptSegments } from './schema';

describe('Schema Validation', () => {
  it('should have correct table names', () => {
    expect(meetings._.name).toBe('meetings');
    expect(transcriptSegments._.name).toBe('transcript_segments');
  });

  it('should have required indexes', () => {
    const indexes = meetings._.indexes;
    expect(indexes).toContainEqual(
      expect.objectContaining({ name: 'idx_meetings_status' })
    );
  });

  it('should have correct foreign keys', () => {
    const fks = transcriptSegments._.foreignKeys;
    expect(fks).toHaveLength(1);
    expect(fks[0].reference().foreignTable).toBe(meetings);
  });

  it('should enforce enum constraints', () => {
    const statusColumn = meetings.status;
    expect(statusColumn.enumValues).toEqual(['active', 'completed']);
  });
});
```

### Migration Tests

```typescript
// schema/migrations.test.ts
import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/client';

describe('Migration Validation', () => {
  it('should apply all migrations successfully', async () => {
    // Migrations are applied in test setup
    const result = await db.execute(sql`
      SELECT COUNT(*) FROM drizzle_migrations
    `);
    expect(result.rows[0].count).toBeGreaterThan(0);
  });

  it('should have all expected tables', async () => {
    const tables = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    
    const tableNames = tables.rows.map(r => r.table_name);
    expect(tableNames).toContain('meetings');
    expect(tableNames).toContain('transcript_segments');
    expect(tableNames).toContain('decision_logs');
  });

  it('should have correct indexes', async () => {
    const indexes = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'transcript_segments'
    `);
    
    const indexNames = indexes.rows.map(r => r.indexname);
    expect(indexNames).toContain('idx_segments_contexts');
  });
});
```

## Schema Documentation Generation

Generate documentation from schema:

```bash
npm run db:docs
```

Creates `schema/SCHEMA.md`:

```markdown
# Database Schema

## Tables

### meetings
Meeting records

**Columns:**
- `id` (uuid, primary key) - Unique identifier
- `title` (text, not null) - Meeting title
- `date` (date, not null) - Meeting date
- `participants` (text[], not null) - List of participant names
- `status` (enum: active, completed, not null) - Meeting status
- `created_at` (timestamptz, not null) - Creation timestamp

**Indexes:**
- `idx_meetings_status` on (status)
- `idx_meetings_date` on (date)

**Relations:**
- Has many: transcript_segments, flagged_decisions, decision_contexts, decision_logs
```

## Schema Comparison with OpenAPI

| Aspect | OpenAPI | Drizzle Schema |
|--------|---------|----------------|
| **Source of Truth** | Generated from Hono + Zod | `packages/db/src/schema.ts` (physical only) |
| **Language** | YAML | TypeScript |
| **Validation** | OpenAPI validators | TypeScript compiler |
| **Generation** | API docs, client SDKs | Migrations, types |
| **Testing** | API contract tests | Schema tests, migration tests |
| **Version Control** | Git | Git |
| **Documentation** | Swagger UI | Auto-generated markdown |

## Package.json Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:validate": "drizzle-kit check",
    "db:docs": "tsx scripts/generate-schema-docs.ts",
    "db:test": "vitest run schema/**/*.test.ts"
  }
}
```

## Dependencies

```json
{
  "dependencies": {
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0",
    "tsx": "^4.0.0"
  }
}
```

## Benefits

### 1. Type Safety
```typescript
// Inferred types from schema
type Meeting = typeof meetings.$inferSelect;
type NewMeeting = typeof meetings.$inferInsert;

// Compile-time errors for invalid data
const meeting: Meeting = {
  id: '123',
  title: 'Test',
  status: 'invalid', // ❌ TypeScript error: not in enum
};
```

### 2. Automatic Migrations
```bash
# Make schema change
# Generate migration automatically
npm run db:generate

# Review generated SQL
cat schema/migrations/0001_*.sql

# Apply to database
npm run db:migrate
```

### 3. Schema Validation
```bash
# Check if database matches schema
npm run db:validate

# Output:
# ✓ All tables match schema
# ✓ All indexes exist
# ✓ All foreign keys correct
```

### 4. Visual Schema Editor
```bash
npm run db:studio
# Opens browser with visual schema editor
# Can browse data, test queries, see relationships
```

### 5. Documentation
Schema is self-documenting:

```typescript
export const meetings = pgTable('meetings', {
  // Each field has type information
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Constraints are explicit
  title: text('title').notNull(),
  
  // Enums are type-safe
  status: text('status', { enum: ['active', 'completed'] }).notNull(),
}, (table) => ({
  // Indexes are defined with table
  statusIdx: index('idx_meetings_status').on(table.status),
}));
```

## Schema Change Workflow

### Example: Adding a New Field

**1. Update Schema**
```typescript
export const meetings = pgTable('meetings', {
  // ... existing fields
  description: text('description'), // NEW FIELD
});
```

**2. Generate Migration**
```bash
npm run db:generate
```

Creates:
```sql
-- 0002_add_meeting_description.sql
ALTER TABLE "meetings" ADD COLUMN "description" text;
```

**3. Test Migration**
```bash
npm run db:test
```

**4. Apply Migration**
```bash
npm run db:migrate
```

**5. Update API/Code**
Types are automatically updated, TypeScript will show errors where code needs updating.

## Schema Versioning

Migrations are versioned and tracked:

```
packages/db/migrations/
  0001_initial_schema.sql
  0002_add_expert_templates.sql
  0003_add_mcp_servers.sql
  meta/
    _journal.json  # Migration history
```

The journal tracks:
- Which migrations have been applied
- When they were applied
- Schema hash for validation

## CI/CD Integration

```yaml
# .github/workflows/schema-validation.yml
name: Schema Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate schema
        run: npm run db:validate
      
      - name: Run schema tests
        run: npm run db:test
      
      - name: Check migrations
        run: npm run db:generate -- --check
```

## Best Practices

### 1. Never Edit Migrations Manually
Always generate migrations from schema changes.

### 2. Review Generated Migrations
Always review the SQL before applying.

### 3. Test Migrations
Write tests for complex migrations.

### 4. Use Transactions
Migrations are wrapped in transactions automatically.

### 5. Backup Before Migrating
Always backup production database before applying migrations.

### 6. Version Control Everything
Commit schema changes and migrations together.

### 7. Document Breaking Changes
Add comments to schema for breaking changes:

```typescript
export const meetings = pgTable('meetings', {
  // BREAKING: Renamed from 'name' to 'title' in v2.0
  title: text('title').notNull(),
});
```

## Comparison with Raw SQL

| Approach | Raw SQL | Drizzle Schema |
|----------|---------|----------------|
| Type Safety | ❌ None | ✅ Full TypeScript |
| Validation | ❌ Runtime only | ✅ Compile-time |
| Migrations | ❌ Manual | ✅ Auto-generated |
| Documentation | ❌ Separate docs | ✅ Self-documenting |
| Testing | ❌ Complex | ✅ Simple |
| Refactoring | ❌ Error-prone | ✅ Safe |
| IDE Support | ❌ Limited | ✅ Full autocomplete |

## Summary

The schema management system provides:

✅ **Single source of truth** - `schema/schema.ts`  
✅ **Type safety** - TypeScript types inferred from schema  
✅ **Automatic migrations** - Generated from schema changes  
✅ **Testable** - Unit tests for schema and migrations  
✅ **Version controlled** - Git tracks all changes  
✅ **Self-documenting** - Code is documentation  
✅ **Validated** - Compile-time and runtime checks  
✅ **Similar to OpenAPI** - Same philosophy for database  

This gives you the same level of control and confidence with your database schema as you have with your API specification.
