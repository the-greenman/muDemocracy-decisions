# Deliberation and Export Template Architecture

**Status**: proposed authoritative direction
**Owns**: the semantic split between deliberation templates and export templates, plus compatibility rules for template sharing/import/export
**Must sync with**: `docs/field-library-architecture.md`, `docs/plans/iterative-implementation-plan.md`, `docs/plans/field-and-template-definition-distribution-proposal.md`, `packages/schema/src/index.ts`

## Purpose

This document defines how the system should separate drafting-time template behavior from permanent-log export behavior without breaking the field-library architecture or the V2 definition-package distribution model.

## Core Decision

The system should distinguish between two template layers:

- **Deliberation template**
  - The drafting-time template used to guide extraction, field visibility, and facilitator editing.
  - Owns workflow framing for draft generation.
  - Defines the full editable field superset for a decision type.

- **Export template**
  - The presentation-time template used to structure a permanent human-readable log.
  - Owns field subset, order, grouping, and presentation behavior for export.
  - Must not redefine field meaning.

## Why the split exists

A single template is currently doing two jobs that have different constraints:

- Drafting needs a natural discussion flow and enough fields to support facilitation.
- Export needs a stable, human-readable permanent record.
- Export headings must be readable by humans rather than exposing programmatic field keys.
- A deliberation may support more than one valid export structure for different audiences or publication formats.

## Relationship to the field library

This model extends the field-library architecture rather than replacing it.

### Fields remain the semantic base layer

Field definitions continue to own:

- semantic meaning
- extraction guidance
- validation/value-shape metadata
- intrinsic display defaults
- stable identity and version lineage

### Deliberation templates remain compositions

A deliberation template continues to own:

- stable identity and version
- template-level workflow framing
- ordered field references
- requiredness
- drafting-time composition

### Export templates are also compositions

An export template should own only presentation-layer configuration:

- stable identity and version
- parent deliberation-template reference
- ordered subset of fields already available in the deliberation template
- optional grouping/layout metadata for exported output
- export-specific title/label metadata that does not alter field semantics

## Hard rules

### 1. Export templates are subsets of deliberation templates

An export template may reference only fields that are assigned to its parent deliberation template.

This guarantees:

- no export can require information that was never available during deliberation
- no silent loss of semantic traceability
- deterministic validation at template-definition time

### 2. Export templates are presentation-only

Export templates may change:

- field inclusion
- field order
- grouping or section structure
- export headings and other presentation metadata

Export templates may not change:

- field meaning
- extraction behavior
- field validation semantics
- the underlying field-definition identity

If export needs materially different meaning, that must be modeled as a different field definition rather than an export-template override.

### 3. Export selection happens at log/export time

Users should choose the export template when producing the permanent log, not when starting deliberation.

This keeps drafting flexible while allowing multiple publication formats later.

### 4. Every deliberation template should have a default export template

Each deliberation template should resolve to a default derived export template so current flows continue to work even when no custom export variant has been configured.

The default export template should:

- be deterministic
- be valid by construction
- preserve human-readable output

## Human-readable export requirements

Human-readable exports should never expose raw programmatic field names as headings when better display metadata exists.

### Export heading precedence

For exported headings, prefer:

1. explicit export-template heading metadata
2. canonical field-library display metadata
3. a safe derived formatter from field `name`

This rule applies to markdown and any other human-oriented export format.

Machine-readable exports are separate and may continue to use API-native keys and structures.

## Versioning and runtime pinning

This design must remain compatible with the V2 definition-versioning direction.

### Definition identity

Both deliberation templates and export templates should be first-class definition artifacts with:

- stable identity
- namespace
- version
- lineage/fork metadata when applicable
- provenance/source metadata when imported

### Context behavior

A `DecisionContext` should remain pinned to a specific deliberation-template definition version for drafting.

At permanent-log generation time, the system should resolve the chosen export-template definition version explicitly rather than inferring a latest version.

Open contexts should not silently change because a newer export template was published.

## Sharing and import/export compatibility

This design must be compatible with V2 definition packages.

### Export templates as shareable artifacts

Export templates should be portable as first-class definition artifacts, not ephemeral UI-only configuration.

### Supported sharing modes

The system should support both:

- bundled sharing, where a package includes fields, deliberation templates, and export templates together
- independent sharing, where an export template is imported separately and references already-known dependencies

### Required dependency model

An independently shared export template must preserve references to:

- its parent deliberation template definition
- the field definitions it uses
- the versions or lineage information required for deterministic resolution

### Import behavior

Import should validate that:

- the parent deliberation template exists or is included in the package
- every exported field reference resolves
- the export-template field set is a valid subset of the parent deliberation template
- dependency versions are compatible enough to apply or surface a conflict

## Seed-data and implementation direction

Until full package import/export exists, seed data may remain the authoritative editable source for built-in templates.

That does not make export templates seed-only concepts.

The design should therefore avoid assumptions that would prevent future:

- CLI export/import of template definitions
- API-based package distribution
- upsert-by-identity behavior
- local-fork and upstream-tracking metadata

## Recommended persistence shape

The precise schema belongs in `packages/schema` and `packages/db`, but the model should support:

- a deliberation-template definition type
- an export-template definition type
- export-template-to-deliberation-template linkage
- export-template field assignments referencing the same reusable field definitions
- stable versioned identifiers on both template types
- dependency/provenance metadata needed for package import/export

## Validation expectations

The implementation should prove at least the following:

- export-template field assignments must be a subset of the parent deliberation template
- default export-template derivation is deterministic
- human-readable export headings do not regress to raw field keys when display metadata exists
- export-template resolution at log/export time is explicit and version-aware
- standalone imported export templates fail clearly when dependencies are missing or incompatible

## Non-goals

This document does not define:

- the exact final schema shape
- the exact API contract for import/export
- the full migration strategy for already-open contexts
- cryptographic trust/signature policy for third-party packages

Those details belong in implementation plans and schema/API docs.
