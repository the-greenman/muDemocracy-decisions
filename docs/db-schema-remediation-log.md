# DB Schema Remediation Log

This log tracks issues encountered while stabilizing the database schema workflow and records the working remediation for future schema-tooling changes.

## 2026-03-11 - Mixed schema application paths caused migration/push instability

### Symptom
- Database schema changes were being applied through multiple competing paths.
- `db:migrate` and `db:push` did not represent different behaviors even though their names implied they should.
- Bootstrap scripts bypassed package scripts and called the migration runner directly.
- Docs alternated between a migration-first flow and a push-first flow.

### Trigger observed
- `packages/db/src/schema.ts` is the canonical schema definition.
- `packages/db/drizzle/` already contains committed Drizzle SQL migrations and metadata.
- `packages/db/package.json` mapped both `db:migrate` and `db:push` to `drizzle-kit push:pg` before remediation.
- `scripts/up-stack.sh` and `scripts/manual-test-shell.sh` invoked `tsx scripts/migrate.ts` directly.

### Remediation decision
1. Keep a migration-first workflow as the default team contract.
2. Make `db:migrate` mean “apply committed migrations”.
3. Keep `db:push` only as an explicit local/disposable database escape hatch.
4. Align bootstrap scripts and primary docs with that same default path.

### Issue encountered during implementation
- The installed `drizzle-kit` version in this repo does not expose a normal `migrate:pg` command in its CLI command surface.
- That means a pure `drizzle-kit` CLI migration flow was not available without a dependency upgrade or tooling change.

### Working remediation
1. Use `drizzle-kit generate` to create committed SQL migrations.
2. Use `drizzle-orm/postgres-js/migrator` in `packages/db/scripts/migrate.ts` to apply committed migrations from `packages/db/drizzle`.
3. Route all default schema application flows through `pnpm db:migrate`.
4. Reserve `pnpm db:push` for disposable local recovery only.

### Files updated
- `packages/db/scripts/migrate.ts`
- `packages/db/package.json`
- `scripts/up-stack.sh`
- `scripts/manual-test-shell.sh`
- `packages/db/src/__tests__/migration-splitter.test.ts`
- `README.md`
- `docs/agentic-setup-guide.md`
- `CLAUDE.md`
- `docs/plans/iterative-implementation-plan.md`

### Follow-up checks to run
```bash
pnpm --filter @repo/db test
pnpm --filter @repo/db type-check
pnpm db:migrate
pnpm db:seed
```

### Notes
- `db:push` references may still appear in docs only where they are explicitly described as local-only/disposable usage.
- If the team later upgrades Drizzle tooling to a version with a stable dedicated migration CLI, reassess whether `packages/db/scripts/migrate.ts` should remain as the application entrypoint.

## 2026-03-11 - Validation pass exposed existing `@repo/db` test instability unrelated to migration entrypoint swap

### Symptom
- `pnpm --filter @repo/db type-check` passes.
- `pnpm --filter @repo/db test` fails across multiple repository/service integration tests.
- The visible common failure shape includes `TypeError: value.toUTCString is not a function` from Drizzle timestamp mapping.

### Working interpretation
- The migration workflow changes did not break package type-check.
- The failing test shape points to existing test data or repository input using string timestamps where Drizzle expects `Date` objects for timestamp columns.
- This appears orthogonal to the migration-runner consolidation and should be remediated separately to avoid mixing schema-tooling work with repository contract fixes.

### Validation results
```bash
pnpm --filter @repo/db type-check  # passes
pnpm --filter @repo/db test        # fails on existing timestamp/value-shape issue
```

### Next follow-up if needed
1. Audit failing repository/service tests for timestamp field inputs passed as strings.
2. Normalize test fixtures and repository call sites to use `Date` values for `timestamp(..., { withTimezone: true })` columns.
3. Re-run `pnpm --filter @repo/db test` after fixture normalization.

### Resolution applied
- Updated direct `db.insert(meetings).values(...)` test setup paths to pass `Date` instances for `meeting.date`.
- Left `DrizzleMeetingRepository.create(...)` tests using string inputs where appropriate, because that repository already normalizes strings to `Date` before insertion.
- Fixed stale `CreateFlaggedDecision` test calls that were missing the now-required `priority` field.

### Additional schema-history issue discovered and resolved
- `packages/db/src/schema.ts` defined `meetings.date` as `timestamp with time zone`, but committed Drizzle migration history still created the column as plain `date`.
- Running `pnpm --filter @repo/db db:generate` initially failed because the package script used `drizzle-kit generate` instead of the supported `drizzle-kit generate:pg` command for the installed CLI version.
- After fixing the script, Drizzle generated `packages/db/drizzle/0006_romantic_madelyne_pryor.sql`:

```sql
ALTER TABLE "meetings" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;
```

### Additional baseline migration issue discovered and resolved
- The old custom migration runner had hidden invalid SQL and replay-safety issues in earlier committed migrations.
- `packages/db/drizzle/0000_volatile_richard_fisk.sql` contained malformed array defaults such as `DEFAULT  NOT NULL`.
- `packages/db/drizzle/0001_nervous_wind_dancer.sql` and `packages/db/drizzle/0003_watery_kid_colt.sql` contained additive steps that were not replay-safe against an already-current local DB.
- Hardened those migrations by:
  - replacing malformed array defaults with `DEFAULT '{}'::text[]`
  - wrapping enum-addition replay with duplicate protection
  - converting additive column steps to `ADD COLUMN IF NOT EXISTS` where needed

### Final validation results
```bash
pnpm --filter @repo/db type-check  # passes
pnpm --filter @repo/db test        # passes (18 files, 188 tests)
pnpm db:migrate                    # passes
```
