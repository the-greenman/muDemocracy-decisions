---
name: api-endpoint-implementation
description: Use when adding or updating Hono API endpoints, including Zod request/response schemas, integration tests, @hono/zod-openapi route definitions, and OpenAPI verification.
---

# API Endpoint Implementation

Use this workflow when exposing new service functionality through the API.

## Workflow

1. Read the endpoint contract in `docs/PLAN.md`.
2. Add or update Zod schemas in `packages/schema`.
3. Write the API integration test first.
4. Implement the route with `@hono/zod-openapi`.
5. Wire the route to the appropriate service via DI.
6. Run API tests.
7. Verify the generated OpenAPI output.

## Checks

```bash
pnpm test:e2e
curl http://localhost:3000/docs
curl http://localhost:3000/openapi.json
```

## References

- `docs/PLAN.md`
- `docs/architecture-proposal.md`
- `.claude/skills/api-endpoint-implementation.md`
