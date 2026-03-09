# TypeScript Workspace Type System Remediation

Stabilize the remaining workspace type/build issues by preserving the completed TypeScript project-reference refactor and focusing the remaining work on the `@repo/db` DTS bundling blocker documented in `docs/type-remediation-log.md`.

## Current Status

### Completed

- **Root config split**
  - Added `tsconfig.base.json` for build-safe shared compiler settings
  - Kept root `tsconfig.json` as the workspace/editor `noEmit` config

- **Project references added**
  - `@repo/db` references `@repo/schema`
  - `@repo/core` references `@repo/schema` and `@repo/db`
  - `@repo/api` references `@repo/schema`, `@repo/db`, and `@repo/core`

- **Package type-check scripts updated**
  - Removed stale `--rootDir ../..` workarounds
  - Shifted referenced packages toward project-build-aware type-check commands

- **Schema runtime metadata aligned**
  - `@repo/schema` package metadata now matches actual emitted files
  - Runtime export investigation confirmed the built bundle exports the expected schemas

- **Core declaration-path issue improved**
  - `@repo/core` no longer shows the earlier TS6305 failure against `@repo/db`

### Still Open

- **Active blocker: `@repo/db` DTS bundling during `pnpm build`**
  - JavaScript bundling succeeds
  - `tsup` DTS generation still fails with `TS6307`
  - This is the current bottleneck for full workspace validation

## Reference Material

- **Detailed findings log**
  - See `docs/type-remediation-log.md`
  - Use that file as the running source of truth for discovered failure modes and partial remediations

## Revised Plan

### 1. Resolve `@repo/db` DTS bundling failure

- Determine why `tsup`'s DTS worker reports imported `src` files as outside the project file list
- Prefer a fix local to `packages/db` (`tsconfig`, `tsup.config`, or declaration-specific config)
- Avoid reopening already-completed repo-wide TypeScript refactors unless required

### 2. Revalidate downstream consumers

- Confirm `@repo/db` build succeeds
- Confirm `@repo/core` still type-checks cleanly after the db fix
- Confirm `@repo/api` starts cleanly against rebuilt workspace packages

### 3. Finalize documentation and workflow

- Update `docs/type-remediation-log.md` with the final db fix and validation outcome
- Keep the recommended workflow explicit and minimal

## Validation Checkpoints

- [x] Root/shared tsconfig layering split is in place
- [x] Workspace project references are in place
- [x] Schema package metadata matches actual emitted runtime files
- [x] Core no longer fails with the previous TS6305 declaration-path issue
- [ ] `@repo/db` `pnpm build` passes without TS6307 DTS errors
- [ ] Full workspace `pnpm build` passes
- [ ] Full workspace `pnpm type-check` passes
- [ ] `pnpm dev` starts without the previous `@repo/schema` runtime export error

## Working Validation Sequence

```bash
pnpm --filter @repo/schema build
pnpm --filter @repo/db build
pnpm --filter @repo/core type-check
pnpm build
pnpm type-check
pnpm dev
```

## Notes

- The original broad remediation plan is mostly complete; avoid redoing those steps unless the `@repo/db` investigation proves they were incorrect.
- The current plan intentionally narrows scope to the single remaining build blocker.

## Benefits

- **Less plan churn** - completed repo-wide changes stay marked done
- **Focused debugging** - remaining effort is centered on one concrete blocker
- **Better historical record** - plan and remediation log now point at the same current bottleneck
