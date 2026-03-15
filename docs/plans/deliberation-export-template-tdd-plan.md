# Plan: Deliberation Template / Export Template Split (TDD)

**Status**: proposed
**Related docs**: `docs/deliberation-export-template-architecture.md`, `docs/field-library-architecture.md`, `docs/plans/field-and-template-definition-distribution-proposal.md`, `docs/plans/iterative-implementation-plan.md`

---

## Goal

Implement a separate export-template model for human-readable permanent logs, while keeping deliberation templates authoritative for drafting and preserving compatibility with future shareable definition-package import/export.

---

## Acceptance criteria

- A deliberation template can expose one or more export template options.
- Every deliberation template resolves to a default export template.
- An export template can reference only fields available in its parent deliberation template.
- Human-readable exports use display titles rather than raw field `name` values.
- Export-template choice is made at log/export time.
- The design remains compatible with stable identity/versioning and future package import/export.

---

## TDD execution strategy

Work in vertical slices. For each slice:

1. write a failing test that captures the desired behavior
2. implement the smallest change that makes the test pass
3. refactor only after the test is green
4. keep the system runnable after every slice

Prefer service/repository tests for domain rules and API/export tests for behavior visible to users.

---

## Slice 0 — Documentation and invariants

### Test intent

No code test required.

### Work

- Add the evergreen architecture doc for the split.
- Update any source-of-truth docs that need cross-links.
- Record the invariants that later tests will enforce.

### Done when

- The architecture doc exists.
- The invariants below are stable and implementation can target them.

### Invariants

- Deliberation templates own drafting.
- Export templates own human-readable permanent-log structure.
- Export-template fields must be a subset of the parent deliberation template.
- Export templates are presentation-only.
- Export selection happens at log/export time.

---

## Slice 1 — Schema/types for export-template definitions

### Write failing tests first

Add schema/unit tests proving:

- an export template requires stable identity fields
- an export template references a parent deliberation template
- export-template assignments reference field IDs in an ordered list
- export-template types can carry version/namespace/provenance metadata

### Implement

- Add export-template schema/types in `packages/schema/src/index.ts`.
- Add any create/update payload schemas needed by services and APIs.
- Keep structural ownership in `packages/schema`.

### Refactor target

- Avoid overloading `DecisionTemplate` with export-only concerns if a separate type keeps the boundary clearer.

### Done when

- Schema tests pass.
- The type system clearly distinguishes deliberation templates from export templates.

---

## Slice 2 — Persistence model and repositories

### Write failing tests first

Add repository tests proving:

- export templates can be created and fetched
- export-template assignments persist in order
- export templates can be listed by parent deliberation template
- a default export template can be resolved for a deliberation template

### Implement

- Add DB schema and migration for export templates and their assignments.
- Add repository interfaces and Drizzle implementations.
- Preserve stable identity/version metadata in persistence.

### Refactor target

- Keep repository boundaries parallel to existing template/field repository patterns.

### Done when

- Repository tests pass.
- The DB can store multiple export-template variants per deliberation template.

---

## Slice 3 — Domain validation: subset and presentation-only rules

### Write failing tests first

Add service tests proving:

- creating an export template fails if it references a field not present in the parent deliberation template
- creating an export template succeeds when all fields belong to the parent deliberation template
- export-template configuration can affect order/subset/presentation metadata only
- semantic override attempts are rejected or unsupported by design

### Implement

- Add an export-template service in `packages/core`.
- Enforce subset validation against the parent deliberation template assignments.
- Keep semantic ownership on field definitions.

### Refactor target

- Centralize subset validation in one domain service path rather than duplicating it in API handlers.

### Done when

- Validation tests pass.
- The core domain rule is enforced outside the UI.

---

## Slice 4 — Default export-template derivation

### Write failing tests first

Add service tests proving:

- every deliberation template can resolve a default export template
- derived defaults are deterministic
- derived defaults remain valid subsets of the parent deliberation template
- existing templates without custom export variants still export successfully

### Implement

- Add derivation logic for the default export template.
- Decide whether derived defaults are materialized in persistence, generated on read, or seeded explicitly.
- Ensure current built-in templates continue to work without manual intervention.

### Refactor target

- Keep derivation logic isolated so later import/export support can materialize or serialize it predictably.

### Done when

- Default-resolution tests pass.
- Backward compatibility is preserved for existing template flows.

---

## Slice 5 — Human-readable export generation

### Write failing tests first

Add export-service tests proving:

- markdown export uses the selected export template’s subset/order
- headings prefer human-readable display titles over raw field `name`
- heading fallback behavior is deterministic when explicit display metadata is absent
- machine-readable export behavior remains separate and unaffected

### Implement

- Update `packages/core/src/services/markdown-export-service.ts`.
- Resolve the chosen export template before building markdown.
- Use heading precedence rules from the architecture doc.

### Refactor target

- Extract a small display-title resolver if heading logic becomes shared.

### Done when

- Export tests pass.
- Human-readable output is no longer keyed by raw field names.

---

## Slice 6 — API surface for export-template selection

### Write failing tests first

Add API tests proving:

- clients can list export templates valid for a deliberation template or decision context
- log/export endpoints can accept an explicit export-template selection
- invalid selections fail with clear validation errors
- omitted selection falls back to the default export template

### Implement

- Add API endpoints or extend existing ones in `apps/api`.
- Wire export-template resolution through the service layer.
- Keep the selection point at log/export time only.

### Refactor target

- Keep transport validation in routes and domain validation in services.

### Done when

- API tests pass.
- Export selection is explicit and backward compatible.

---

## Slice 7 — Seed data and built-in definitions

### Write failing tests first

Add integration or seed verification tests proving:

- built-in deliberation templates have default export-template coverage
- optional additional export variants load correctly
- seeded export templates satisfy subset rules

### Implement

- Extend `packages/db/src/seed-data/decision-templates.ts` or adjacent seed sources with export-template definitions.
- Update `packages/db/scripts/seed.ts` orchestration as needed.

### Refactor target

- Keep built-in definition data declarative and close to current field/template seed sources.

### Done when

- Seed verification passes.
- `pnpm db:seed` produces a valid built-in export-template library.

---

## Slice 8 — Import/export compatibility seams

### Write failing tests first

Add service or contract tests proving:

- export-template definitions can be serialized with identity/version/dependency metadata
- a bundled package containing dependencies can be validated for import
- a standalone export-template definition can be validated against already-known dependencies
- missing or incompatible dependencies produce explicit conflict errors

### Implement

- Add serialization/validation seams needed for future package import/export.
- Do not implement the entire distribution system here unless required.
- Ensure the data model supports both bundled and independently shared export templates.

### Refactor target

- Keep package-shape concerns at a contract boundary so later CLI/API import-export work can reuse them.

### Done when

- Compatibility tests pass.
- The model is future-proofed for M9.1-style package import/export.

---

## Slice 9 — UI wiring for selection at export time

### Write failing tests first

Add UI/component tests proving:

- export/log UI can show available export-template options
- default selection behavior is correct
- invalid/missing dependency states are surfaced clearly if applicable

### Implement

- Update the relevant web export/logging flow.
- Do not move template choice into decision creation.

### Refactor target

- Keep UI state thin and rely on API/service validation.

### Done when

- UI tests pass.
- Users choose export structure only when exporting/logging.

---

## Slice 10 — Regression and migration coverage

### Write failing tests first

Add regression coverage proving:

- existing deliberation flows still work
- existing decisions without explicit export-template selection still export through the default path
- open contexts are not silently rebound to new template definitions

### Implement

- Add migration/backfill steps if persistence requires them.
- Document any operator steps for migrate/seed.

### Done when

- Existing workflows remain functional.
- Migration behavior is documented and covered.

---

## Suggested file targets

- `docs/deliberation-export-template-architecture.md`
- `docs/plans/deliberation-export-template-tdd-plan.md`
- `packages/schema/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories/*`
- `packages/db/src/seed-data/decision-templates.ts`
- `packages/db/scripts/seed.ts`
- `packages/core/src/services/markdown-export-service.ts`
- `packages/core/src/services/*export-template*`
- `packages/core/src/interfaces/*`
- `apps/api/src/index.ts` or route modules
- relevant web export/logging UI files

---

## Validation checkpoint

Run at appropriate slice boundaries:

```bash
pnpm db:migrate
pnpm db:seed
pnpm test
pnpm build
pnpm type-check
```

Recommended additional checks:

- repository/service tests for subset validation
- export-service tests for heading precedence and field ordering
- API tests for default and explicit export-template selection
- manual verification that markdown exports are human-readable and no longer expose raw field keys as section headings

---

## Suggested implementation order

1. slices 1-3
2. slice 4
3. slice 5
4. slice 6
5. slice 7
6. slice 8
7. slice 9
8. slice 10

This order establishes core invariants before wiring UI and future distribution seams.
