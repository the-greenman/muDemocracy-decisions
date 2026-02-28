# Architecture Proposal: Modular, TDD-First Shared Core

This document outlines the architectural patterns and development workflows required to build a modular, testable, and DRY codebase for the Decision Logger project.

## 1. Core Architectural Patterns

### 1.1 Service-Repository Pattern
To ensure modularity and ease of testing, we will use a strict separation between business logic and data access.

- **Services (`packages/core/src/services`)**: Contain business logic, orchestration, and domain validation. They depend on Repositories via interfaces.
- **Repositories (`packages/core/src/repositories`)**: Handle direct database operations using Drizzle. They are the only layer that "knows" about the database schema in detail.

### 1.2 Dependency Injection (DI)
Services will not instantiate their dependencies. Instead, they will receive them via constructor injection. This is critical for TDD, as it allows us to inject mocks during testing.

```typescript
// Example Service with DI
export class MeetingService {
  constructor(
    private readonly meetingRepo: IMeetingRepository,
    private readonly transcriptRepo: ITranscriptRepository
  ) {}

  async createMeeting(data: CreateMeetingInput): Promise<Meeting> {
    // Business logic & validation
    return this.meetingRepo.create(data);
  }
}
```

### 1.4 Wiring & Dependency Injection
To ensure consistency, we will use a simple, manual Dependency Injection pattern or a lightweight DI container. This prevents agents from "hard-coding" dependencies inside services.

- **Rule**: All services MUST accept their dependencies in the constructor.
- **Rule**: Wiring logic (instantiating repos and passing them to services) resides in a central `packages/core/src/container.ts` or similar factory file.

### 1.5 Interface-First Development
For every Service and Repository, we define a TypeScript `interface` first. This allows us to write tests against the interface before the implementation exists.

```typescript
// packages/core/src/repositories/interfaces/meeting-repo.interface.ts
export interface IMeetingRepository {
  create(data: NewMeeting): Promise<Meeting>;
  findById(id: string): Promise<Meeting | null>;
  // ...
}
```

## 2. TDD Workflow (Red-Green-Refactor)

We will follow a strict TDD approach for all business logic in `packages/core`.

### 2.1 The Cycle
1.  **RED**: Write a failing unit test in `packages/core/tests/unit`. Use Vitest and mocks for repositories.
2.  **GREEN**: Implement the minimum amount of code in the Service to make the test pass.
3.  **REFACTOR**: Clean up the implementation while ensuring the tests remain green.

### 2.2 Testing Levels
- **Unit Tests**: Test Service methods in isolation using mocks for Repositories and LLM services.
- **Integration Tests**: Test the interaction between Services and the Database (using a test database instance).
- **Contract Tests**: Verify that the generated OpenAPI spec matches the actual API responses.

## 3. Modular Monorepo Structure

The monorepo is organized to prevent logic leakage and ensure maximum code reuse.

```
decision-logger/
├── packages/
│   ├── schema/       # SSOT: Zod schemas & inferred types (no logic)
│   ├── db/           # Drizzle schema, migrations, and DB client
│   ├── core/         # Shared business logic
│   │   ├── src/
│   │   │   ├── services/     # Domain services (Logic SSOT)
│   │   │   ├── repositories/ # Data access abstractions
│   │   │   ├── llm/          # Vercel AI SDK implementation
│   │   │   └── errors/       # Shared domain exceptions
│   │   └── tests/            # Unit & Integration tests
├── apps/
│   ├── api/          # Hono API (Thin wrapper around core services)
│   └── cli/          # Clack/Commander CLI (Thin wrapper around core services)
```

## 4. DRY (Don't Repeat Yourself) Principles

### 4.1 Shared Error Handling
Define domain-specific exceptions in `core` that are caught and translated by the application layers.

```typescript
// packages/core/src/errors/domain-errors.ts
export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} with ID ${id} not found`);
  }
}
```

### 4.2 Shared Validation logic
Every service method uses Zod schemas from `@repo/schema` to validate inputs. We will create a shared `validate(schema, data)` helper to keep this consistent and DRY.

### 4.3 Standardized Result Type
To avoid nested try-catch blocks, we may adopt a `Result<T, E>` pattern for complex logic, especially where LLM results are involved.

## 5. Agentic Safety Guardrails

To prevent agents from creating duplicate or inconsistent code:
1.  **Rule**: No business logic in `apps/`.
2.  **Rule**: Every Service method MUST have a corresponding unit test.
3.  **Rule**: Repositories MUST NOT contain business logic; they only execute CRUD.
4.  **Rule**: Use the `@repo/schema` alias for all type imports to ensure SSOT.

## 6. Implementation Strategy

1.  **Define Interfaces**: Start by defining Zod schemas and Service interfaces.
2.  **Write Tests**: Write failing tests for the core business requirements.
3.  **Implement Repositories**: Build the data access layer.
4.  **Pass Tests**: Implement the Services to satisfy the requirements.
5.  **Hook up Interfaces**: Connect the Hono API and CLI to the pass-through Services.
