# Agentic Development Standards & Guardrails

This document defines the strict architectural standards and patterns required to ensure a consistent, duplicate-free, and type-safe codebase, specifically optimized for agentic development.

## 1. Single Source of Truth (SSOT): The Zod Pipeline

To ensure absolute consistency and eliminate duplicate code, we will implement a **Zod-to-All** pipeline.

### 1.1 The Unified Schema Package
- **Location**: `packages/schema`
- **Purpose**: Define all domain entities once using Zod.
- **Pipeline Flow**:
    ```
    [Zod Definition]
          ↓
    ├─→ [OpenAPI Spec] (via @hono/zod-openapi)
    ├─→ [Drizzle Schema] (via manual mapping with validation)
    └─→ [TypeScript Types] (via z.infer)
    ```

### 1.2 Automated Documentation (OpenAPI)
- **Rule**: Manually editing `docs/openapi.yaml` is FORBIDDEN.
- **Enforcement**: The spec is dynamically generated from Hono route definitions that use Zod schemas. This ensures the documentation is a 100% accurate reflection of the code.

### 1.3 Database Alignment (Drizzle)
- **Rule**: Drizzle table definitions in `packages/db` MUST align with Zod definitions in `packages/schema`.
- **Validation**: We will implement a "Schema Sanity Check" test that compares Zod field names/types with Drizzle column definitions to catch drift at build time.

## 2. Shared Core Architecture

To minimize duplicate code, the system follows a strict "Shared Core" pattern.

### 2.1 Dependency Flow (One-Way)
```
[apps/api] or [apps/cli] 
          ↓
    [packages/core] (Services & LLM Logic)
          ↓
    [packages/db] & [packages/schema]
```
- **Rule**: Apps MUST NOT contain business logic. They are strictly "interface adapters" (Hono routes or CLI commands).
- **Rule**: Business logic MUST reside in `packages/core/src/services`.
- **Rule**: Shared logic MUST NOT have circular dependencies.

### 2.2 Service Pattern
Each domain entity (Meeting, Transcript, Decision) should have a dedicated Service class in `core`.
- **Rule**: If logic is needed by both API and CLI, it MUST be a method in a Service.
- **Rule**: Services are responsible for orchestration (DB calls + LLM calls + Validation).

## 3. Strict Layering Guardrails

### 3.1 The "Logic Leak" Test
Before adding code to `apps/api` or `apps/cli`, an agent must ask:
*"Would this logic be useful if we switched from CLI to a Web UI?"*
- If **Yes**, it belongs in `packages/core`.
- If **No** (e.g., Clack formatting, Hono context handling), it stays in the App.

### 3.2 LLM Interaction
- **Rule**: All LLM prompts and Vercel AI SDK calls MUST reside in `packages/core/src/llm`.
- **Rule**: Prompts MUST be versioned or clearly organized by domain.
- **Rule**: LLM outputs MUST be validated against schemas from `packages/schema`.

## 4. Automated Consistency Checks

To prevent "Schema Drift", we will implement the following automated checks:

### 4.1 Zod to OpenAPI (Contract Safety)
- **Tool**: `zod-to-openapi` or `zod-openapi`
- **Pattern**: Generate the `openapi.yaml` (or parts of it) dynamically from Zod schemas to ensure the documentation NEVER drifts from the implementation.

### 4.2 Zod to Drizzle (Data Safety)
- **Pattern**: Use Zod schemas in Service methods to sanitize data before DB insertion.
- **Audit**: Periodic review of `packages/db/schema.ts` against `packages/schema` Zod definitions.

### 4.3 Type-Safe Tooling
- **Rule**: Use `@repo/schema` everywhere. If an agent needs a new field, it MUST be added to `packages/schema` first.

## 5. Agentic Workflows

When implementing a new feature, agents MUST follow this sequence:
1. **Define Schema**: Add/Update Zod schema in `packages/schema`.
2. **Define DB**: Update Drizzle schema in `packages/db` and generate migration.
3. **Implement Service**: Add logic to a service in `packages/core`.
4. **Expose Interface**: Add API route in `apps/api` or CLI command in `apps/cli` that calls the service.

## 6. Error Handling
- **Rule**: Define shared Error classes in `packages/schema` (e.g., `NotFoundError`, `ValidationError`).
- **Rule**: Services throw shared errors; Apps catch them and translate to interface-specific responses (HTTP 404 or Clack error message).

## 7. Pipeline Decommissioning Plan

To transition from the current manual state to the automated pipeline:
1.  **Foundation**: Set up the monorepo and `packages/schema`.
2.  **Migration**: Move existing manual definitions from `docs/openapi.yaml` and `schema/schema.ts` into Zod models in `packages/schema`.
3.  **Automation**: Configure `@hono/zod-openapi` to generate the spec.
4.  **Removal**: Once the generated output matches the desired contract, DELETE the manually maintained `docs/openapi.yaml` and `schema/schema.ts` files to prevent any future manual edits.
