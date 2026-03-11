# Biome And Guardrails Implementation Checklist

This checklist turns the guardrail recommendations into an execution plan for the workspace.

## Objectives

- Adopt Biome as the primary formatter and default lint entrypoint.
- Preserve and extend custom workspace validation for invariants Biome cannot enforce.
- Strengthen build, type, schema, and database validation so regressions fail quickly.
- Reduce drift between local development checks, package-level checks, and root validation.

## Non-goals

- Rewriting package architecture during the lint/format migration.
- Replacing custom validation scripts with generic lint rules when the custom checks are more precise.
- Mixing large functional refactors with formatting-only or tooling-only changes.

## Phase 1: Introduce Biome Without Weakening Existing Guardrails

### Checklist

- [x] Add Biome as a root dev dependency.
- [x] Create a root `biome.json` or `biome.jsonc`.
- [x] Configure Biome formatter defaults for TypeScript, JavaScript, JSON, and Markdown where supported.
- [x] Add ignore patterns for generated and build artifacts:
  - [x] `**/dist/**`
  - [x] `**/coverage/**`
  - [x] `**/.turbo/**`
  - [x] generated OpenAPI output
  - [x] any generated files that should not be reformatted automatically
- [x] Add root scripts:
  - [x] `lint` for Biome linting
  - [x] `format` for Biome formatting
  - [x] `format:check` for non-mutating formatting validation
- [x] Keep `lint:workspace` intact.
- [x] Keep `type-check`, `build`, and database scripts intact.
- [x] Run a dedicated repo-wide formatting pass in an isolated commit.

### Files likely affected

- `package.json`
- `biome.json` or `biome.jsonc`
- `.gitignore` only if Biome cache/output requires it
- CI config if it currently calls formatting or lint directly

### Validation

```bash
pnpm lint
pnpm format:check
pnpm lint:workspace
pnpm type-check
```

### Exit criteria

- Biome runs successfully at the repo root.
- Existing workspace validation still passes.
- No declaration/build/schema rules are lost during formatter/linter introduction.
- Status: complete on 2026-03-11 after `pnpm format`, `pnpm format:check`, `pnpm lint`, `pnpm lint:workspace`, and `pnpm type-check` passed.

## Phase 2: Migrate Lint Ownership Deliberately

### Checklist

- [x] Inventory the current ESLint rules and classify each rule as one of:
  - [x] move to Biome
  - [x] keep as custom validation
  - [x] keep temporarily in ESLint during transition
  - [x] remove because redundant
- [x] Preserve these existing invariants during migration:
  - [x] no imports from `dist/**`
  - [x] no imports from another workspace package's `src/**`
  - [x] explicit `.js` extensions for runtime relative ESM imports where required
- [x] Decide whether any remaining ESLint-only rules justify temporary dual-running.
- [x] Narrow ESLint to only unmatched rules if parity is incomplete.
- [ ] Remove ESLint entirely only after rule parity or replacement coverage is confirmed.

### Current rule ownership map

- **Keep in custom validation**
  - declaration ownership checks in `scripts/validate-workspace-types.mjs`
  - build/type tsconfig path invariants
  - package `types` entrypoint existence checks
- **Keep temporarily in ESLint during transition**
  - no imports from `dist/**`
  - no imports from another workspace package's `src/**`
  - explicit `.js` extension enforcement for runtime relative ESM imports in `apps/api`, `packages/core`, and `packages/db`
- **Handled by Biome in Phase 1**
  - baseline formatting
  - low-churn lint entrypoint presence
- **Not yet migrated intentionally**
  - architectural boundary enforcement beyond the current import restrictions
  - package layering rules that require repo-aware semantics

### Current script ownership

- `pnpm lint` = `pnpm lint:biome && pnpm lint:eslint:transition`
- `pnpm lint:biome` = baseline Biome linting
- `pnpm lint:eslint:transition` = temporary boundary enforcement until parity/replacement exists
- `pnpm lint:workspace` = repo-specific build/declaration invariant enforcement
- Status: transition-only ESLint config verified on 2026-03-11 with `pnpm lint` passing after removal of noncritical stylistic rules.

### Files likely affected

- `eslint.config.js`
- `package.json`
- `biome.json` or `biome.jsonc`
- documentation describing lint workflow

### Validation

```bash
pnpm lint
pnpm lint:workspace
pnpm type-check
pnpm build
```

### Exit criteria

- Developers have one primary lint command.
- No important boundary rule coverage is lost.
- Tool overlap is reduced or intentionally documented.

## Phase 3: Add Validation Tiers

### Checklist

- [ ] Add a fast validation command for routine local use.
- [ ] Add a strict validation command for release-grade or schema-affecting changes.
- [ ] Keep database-specific validation available as a separate focused command.
- [ ] Document when to use each command.

### Recommended scripts

- [ ] `validate:fast`
- [ ] `validate:strict`
- [ ] `validate:db`

### Suggested command behavior

#### `validate:fast`

```bash
pnpm lint
pnpm lint:workspace
pnpm type-check
```

#### `validate:strict`

```bash
pnpm lint
pnpm lint:workspace
pnpm build
pnpm type-check
pnpm --filter @repo/db test
pnpm db:migrate
```

#### `validate:db`

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm --filter @repo/db test
```

### Files likely affected

- `package.json`
- CI workflow definitions
- `.githooks/pre-commit`
- `.githooks/pre-push` if added
- setup docs

### Exit criteria

- There is one obvious command for fast local verification.
- There is one obvious command for strict full validation.
- Schema/database changes have a clear validation path.

## Phase 4: Add Drift Detection For Generated Artifacts

### Checklist

- [ ] Add a database artifact drift check.
- [ ] Make drift detection fail when committed Drizzle artifacts do not match generated output.
- [ ] Optionally add declaration artifact checks where package export validation is not already sufficient.
- [ ] Decide whether drift detection runs in CI only, strict validation only, or both.

### Database artifact targets

- [ ] `packages/db/drizzle/*.sql`
- [ ] `packages/db/drizzle/meta/*`

### Suggested implementation shape

- [ ] Run `pnpm db:generate` in a validation script.
- [ ] Fail if tracked migration or metadata files change unexpectedly.
- [ ] Keep output readable so contributors know exactly what to regenerate or commit.

### Files likely affected

- `package.json`
- new validation script under `scripts/`
- CI workflow definitions
- database workflow docs

### Exit criteria

- Schema changes cannot drift from committed migration artifacts silently.
- Migration artifact regeneration becomes a verifiable boundary.

## Phase 5: Enforce Architecture Boundaries More Explicitly

### Checklist

- [ ] Identify the intended import boundaries between apps and packages.
- [ ] Enforce package-layer boundaries using Biome where possible.
- [ ] Keep repo-specific boundary checks in custom scripts where Biome rules are insufficient.
- [ ] Prevent deep imports into private package internals unless exported intentionally.
- [ ] Decide whether environment access should be restricted to configuration/bootstrap layers.

### Boundary rules to enforce

- [ ] apps may import package entrypoints but not package private internals
- [ ] packages must not import app code
- [ ] `@repo/db` must not depend on `@repo/core` unless explicitly intended
- [ ] build/dev code must not import `dist/**`
- [ ] source code must not import another package's `src/**`

### Validation

```bash
pnpm lint
pnpm lint:workspace
pnpm type-check
```

### Exit criteria

- Package boundaries are machine-enforced rather than review-only.
- Import drift becomes difficult to introduce accidentally.

## Phase 6: Add Dependency And Public API Surface Checks

### Checklist

- [ ] Add dependency cycle detection across workspace packages.
- [ ] Optionally add cycle detection inside critical packages such as `packages/core` and `packages/db`.
- [ ] Add validation that package export maps point to real built outputs.
- [ ] Consider snapshotting or otherwise checking critical package public API surfaces.

### Suggested targets

- [ ] no cycles across workspace packages
- [ ] no broken `exports` or `types` paths after build
- [ ] no accidental expansion of public package API without intentional review

### Files likely affected

- `package.json`
- new dependency-analysis config if needed
- new export-surface validation script if needed
- CI workflow definitions

### Exit criteria

- Cycles fail automatically.
- Published package surfaces are validated explicitly.

## Hook And CI Rollout

### Local hooks

#### Pre-commit

- [ ] Keep this fast.
- [ ] Prefer:

```bash
pnpm lint
pnpm lint:workspace
```

#### Pre-push

- [ ] Add a stronger hook for slower checks.
- [ ] Recommended baseline:

```bash
pnpm type-check
pnpm build
```

- [ ] Optionally include:

```bash
pnpm --filter @repo/db test
```

### CI

- [ ] Run `validate:fast` on all PRs.
- [ ] Run `validate:strict` on protected branches or merge gates.
- [ ] Run DB drift validation whenever schema or DB files change.

## Rollout Order

- [ ] Step 1: Add Biome and switch formatting first.
- [ ] Step 2: Add validation tiers.
- [ ] Step 3: Add DB drift detection.
- [ ] Step 4: Migrate or reduce ESLint.
- [ ] Step 5: Add package boundary and cycle enforcement.
- [ ] Step 6: Add export-surface validation.

## Constraints To Preserve During Rollout

- [ ] Do not remove `scripts/validate-workspace-types.mjs`.
- [ ] Do not weaken the single declaration owner rule.
- [ ] Do not reintroduce checked-in package API `.d.ts` files.
- [ ] Do not make `db:push` part of the normal workflow.
- [ ] Do not mix large functional refactors into formatting/tooling commits.

## Final Success Criteria

At the end of the rollout, the workspace should satisfy all of the following:

- [ ] Biome is the default formatter and primary lint entrypoint.
- [ ] Repo-specific invariants remain enforced via custom validation scripts.
- [ ] There is a clear fast validation tier and a clear strict validation tier.
- [ ] Schema changes cannot drift from committed migration artifacts silently.
- [ ] Package declaration ownership remains consistent and verifiable.
- [ ] Architectural boundaries and dependency cycles are harder to violate.
- [ ] Root, package, and app validation flows are documented and predictable.
