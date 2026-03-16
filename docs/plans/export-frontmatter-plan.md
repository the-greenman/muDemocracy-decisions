# Plan: Export Template Frontmatter Support

**Status**: ready to implement
**Branch**: `feature/export-frontmatter`
**Worktree**: `../decision-logger-export-frontmatter`
**Priority**: first-release feature

---

## Context

ADR files need YAML frontmatter for stable cross-referencing and tooling compatibility. The current markdown export produces clean section headings but no frontmatter block. The `ExportTemplate` model has no mechanism to declare a preamble.

This feature adds a `preamble` field to `ExportTemplate` — a string template rendered before the `# Decision:` heading — and seeds an ADR-specific export template for the Deliberation Decision deliberation template.

---

## Goal

When a decision context is exported using an export template that declares a `preamble`, the output begins with a rendered YAML frontmatter block containing stable identifiers and metadata.

### Example output

```markdown
---
decision-id: 5f9f814e-3eda-429a-81d1-222ac47ac6f0
date: 2026-03-16
slug: adopt-adr-process
status: accepted
---

# Decision: The decision-logger project adopts a formal ADR process...
```

---

## Acceptance criteria

- `ExportTemplate` has an optional `preamble` string field.
- The markdown export service renders the preamble before the `# Decision:` heading when `preamble` is present.
- Preamble supports these substitution variables:
  - `{{decision-id}}` — the decision context UUID (`context.id`)
  - `{{flagged-decision-id}}` — the flagged decision UUID (`context.flaggedDecisionId`)
  - `{{date}}` — the context creation date in `YYYY-MM-DD` format
  - `{{slug}}` — a URL-safe slug derived from the decision title
  - `{{status}}` — the context status (`drafting`, `logged`, etc.)
  - `{{title}}` — the resolved decision title
- A seeded ADR export template exists for the Deliberation Decision template, with preamble pre-configured.
- All existing exports without a preamble are unaffected.
- Tests cover: preamble rendering, variable substitution, missing-variable graceful handling, no-preamble path.

---

## Implementation steps (TDD)

Follow the canonical schema change flow from `CLAUDE.md`:

### Step 1 — Schema (`packages/schema`)

Add `preamble` to `ExportTemplateSchema`:

```typescript
preamble: z.string().optional(),
```

Also add to `CreateExportTemplateSchema` (already derived via `.omit()`).

### Step 2 — Database (`packages/db`)

1. Run `pnpm db:generate` — review generated SQL, expect a nullable `preamble` column on `export_templates`.
2. Run `pnpm db:migrate`.
3. Add the ADR export template to `packages/db/src/seed-data/decision-templates.ts`:

```typescript
export const DELIBERATION_ADR_EXPORT_TEMPLATE: CreateExportTemplate = {
  deliberationTemplateId: DELIBERATION_TEMPLATE_ID, // 1e0b11f8-...
  namespace: "core",
  name: "ADR Export",
  description: "Exports a Deliberation Decision as an Architectural Decision Record markdown file with YAML frontmatter.",
  isDefault: false,
  preamble: `---\ndecision-id: {{decision-id}}\ndate: {{date}}\nslug: {{slug}}\nstatus: {{status}}\n---`,
  fields: [ /* same field order as deliberation template */ ],
};
```

4. Run `pnpm db:seed`.

### Step 3 — Service (`packages/core`)

In `MarkdownExportService.exportToMarkdown`:

1. Write failing test: export with a template that has a preamble → output starts with rendered frontmatter block.
2. Add `renderPreamble(preamble: string, vars: Record<string, string>): string` private method — simple `string.replace` for each `{{variable}}`.
3. Add `buildSlug(title: string): string` private method — lowercase, strip non-alphanumeric, replace spaces with hyphens.
4. Call `renderPreamble` before the `# Decision:` heading when `exportTemplate.preamble` is present.
5. Run tests — should pass.

### Step 4 — Validation

```bash
pnpm build
pnpm type-check
pnpm lint:workspace
pnpm --filter @repo/db test
pnpm --filter @repo/core test
pnpm db:migrate
```

---

## Key files

| File | Change |
|------|--------|
| `packages/schema/src/index.ts` | Add `preamble` to `ExportTemplateSchema` |
| `packages/db/src/schema.ts` | `preamble` column (auto via drizzle-zod, verify) |
| `packages/db/drizzle/` | Generated migration |
| `packages/db/src/seed-data/decision-templates.ts` | ADR export template definition |
| `packages/db/scripts/seed.ts` | Register new export template in seed |
| `packages/core/src/services/markdown-export-service.ts` | Render preamble, add slug/variable helpers |
| `packages/core/src/__tests__/markdown-export-service.test.ts` | Tests for preamble rendering |

---

## Notes

- The `ExportTemplate` DB table is in `packages/db/src/schema.ts`. Confirm drizzle-zod picks up `preamble` automatically; if not, add the column manually.
- The deliberation template ID for seeding is `1e0b11f8-b8de-478b-82d8-d670fa0375fa` (Deliberation Decision).
- Do not add a templating engine dependency — simple `{{variable}}` string replacement is sufficient for the MVP.
- Future: `{{meeting}}`, `{{participants}}`, `{{template-name}}` could be added as variables without a schema change.
- The `[MANUALLY EDITED]` prefix has already been removed from the export service on `feature/mcp-decision-integration` — this branch is cut from that commit, so the fix is already present.
