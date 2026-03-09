# TypeScript Workspace Type System Remediation

Stabilize the remaining workspace type/build issues by preserving the completed TypeScript project-reference refactor and focusing the remaining work on published declaration availability for downstream package consumers, as documented in `docs/type-remediation-log.md`.

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

- **Build pipeline stabilized**
  - `@repo/db` and `@repo/core` were moved off `tsup` DTS bundling after repeated `TS6307` failures
  - Full `pnpm build` now passes

- **Dev/runtime path improved**
  - `pnpm dev` no longer shows the earlier `@repo/schema` missing-export failure in `@repo/api`
  - Current dev failure is environmental (`EADDRINUSE` on port `3000`)

### Still Open

- **Active blocker: root workspace orchestration still needs a fresh diagnostic**
  - isolated package-level build/type-check tasks are now passing for `api`, `core`, `db`, `schema`, `web`, and the CLI package
  - the remaining issue is root `pnpm build` / `pnpm type-check` still exiting nonzero through Turbo orchestration in this session
  - current focus is confirming whether any task still fails in the root graph or whether the remaining nonzero result is orchestration-specific

## Reference Material

- **Detailed findings log**
  - See `docs/type-remediation-log.md`
  - Use that file as the running source of truth for discovered failure modes and partial remediations

## Revised Plan

### 1. Capture the remaining root Turbo diagnostic

- Run root `pnpm type-check` and `pnpm build` against the current green package state
- Identify the exact failing Turbo task, if one still exists
- Reopen package-level declaration/publication work only if the fresh root diagnostic points back there

### 2. Revalidate root orchestration on top of the now-green package tasks

- Confirm root `pnpm type-check` passes workspace-wide
- Confirm root `pnpm build` passes workspace-wide
- If either still fails, capture the Turbo task name and treat that as the final remaining blocker
- Confirm `pnpm dev` starts cleanly once the local port conflict is removed

### 3. Finalize documentation and workflow

- Update `docs/type-remediation-log.md` with the final db fix and validation outcome
- Keep the recommended workflow explicit and minimal

## Validation Checkpoints

- [x] Root/shared tsconfig layering split is in place
- [x] Workspace project references are in place
- [x] Schema package metadata matches actual emitted runtime files
- [x] Core no longer fails with the previous TS6305 declaration-path issue
- [x] `@repo/db` `pnpm build` passes without the previous `tsup` DTS-worker failure
- [x] Full workspace `pnpm build` passes
- [ ] Full workspace `pnpm type-check` passes
- [x] `pnpm dev` starts without the previous `@repo/schema` runtime export error
- [x] Published declarations for `@repo/core` / `@repo/db` are available in the paths downstream consumers resolve
- [x] `@repo/api type-check` passes with package-local `tsc --noEmit`
- [x] Isolated `@repo/core` declaration/type-check passes
- [x] Isolated CLI package type-check passes
- [ ] `pnpm dev` starts cleanly when port `3000` is free

## Working Validation Sequence

```bash
pnpm --filter @repo/schema build
pnpm --filter @repo/db build
pnpm build
pnpm type-check
pnpm dev
```

## Notes

- The original broad remediation plan is mostly complete; avoid redoing those steps unless the remaining declaration-publication investigation proves they were incorrect.
- The current plan intentionally narrows scope to the remaining workspace-level orchestration blocker.

## Benefits

- **Less plan churn** - completed repo-wide changes stay marked done
- **Focused debugging** - remaining effort is centered on one concrete root-level diagnostic
- **Better historical record** - plan and remediation log now point at the same current bottleneck
