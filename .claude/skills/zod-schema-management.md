# Zod Schema Management

Create and modify Zod schemas as single source of truth.

## When to Use

- Adding new domain entities
- Modifying existing schemas
- Creating validation rules
- Defining API request/response types

## Steps

1. **Read existing schemas**
   ```bash
   cat packages/schema/src/index.ts
   ```

2. **Define new schema using Zod**
   ```typescript
   // packages/schema/src/index.ts
   export const NewEntitySchema = z.object({
     id: z.string().uuid(),
     name: z.string().min(1),
     createdAt: z.date()
   });
   
   export type NewEntity = z.infer<typeof NewEntitySchema>;
   ```

3. **Export schema and inferred type**
   - Export the schema (e.g., `NewEntitySchema`)
   - Export the inferred type (e.g., `type NewEntity`)

4. **Verify auto-generation**
   - Drizzle schema auto-updates via `drizzle-zod`
   - OpenAPI spec auto-updates via `@hono/zod-openapi`

5. **Never create manual types**
   - ❌ `interface NewEntity { ... }`
   - ✅ `type NewEntity = z.infer<typeof NewEntitySchema>`

## Validation

```bash
pnpm test --filter=@repo/schema
pnpm db:push  # Verify Drizzle schema updates
curl http://localhost:3000/docs  # Verify OpenAPI spec updates
```

## Related Docs

- `docs/architecture-proposal.md` - Zod-first architecture
- `docs/agentic-development-standards.md` - SSOT principles
