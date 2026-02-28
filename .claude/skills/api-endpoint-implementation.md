# API Endpoint Implementation

Add new API endpoint with auto-generated OpenAPI spec.

## When to Use

- Adding new REST endpoints
- Implementing API routes
- Exposing service functionality

## Steps

1. **Check endpoint specification**
   ```bash
   cat docs/PLAN.md | grep -A 10 "POST /api/new-endpoint"
   ```

2. **Add Zod schemas (if needed)**
   ```typescript
   // packages/schema/src/index.ts
   export const NewEndpointRequestSchema = z.object({
     field1: z.string(),
     field2: z.number()
   });
   
   export const NewEndpointResponseSchema = z.object({
     id: z.string(),
     result: z.string()
   });
   ```

3. **Write integration test**
   ```typescript
   // apps/api/src/__tests__/new-endpoint.test.ts
   describe('POST /api/new-endpoint', () => {
     it('should create resource', async () => {
       const response = await app.request('/api/new-endpoint', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ field1: 'test', field2: 42 })
       });
       
       expect(response.status).toBe(201);
       const data = await response.json();
       expect(data.id).toBeDefined();
     });
   });
   ```

4. **Implement route with @hono/zod-openapi**
   ```typescript
   // apps/api/src/routes/new-endpoint.ts
   import { createRoute } from '@hono/zod-openapi';
   import { NewEndpointRequestSchema, NewEndpointResponseSchema } from '@repo/schema';
   
   const route = createRoute({
     method: 'post',
     path: '/api/new-endpoint',
     request: {
       body: {
         content: {
           'application/json': {
             schema: NewEndpointRequestSchema
           }
         }
       }
     },
     responses: {
       201: {
         content: {
           'application/json': {
             schema: NewEndpointResponseSchema
           }
         },
         description: 'Resource created'
       }
     }
   });
   
   app.openapi(route, async (c) => {
     const body = c.req.valid('json');
     const result = await service.create(body);
     return c.json(result, 201);
   });
   ```

5. **Wire to service via DI**
   ```typescript
   // apps/api/src/index.ts
   const service = new NewService(repository);
   ```

6. **Run tests**
   ```bash
   pnpm test:e2e
   ```

7. **Verify OpenAPI spec**
   ```bash
   curl http://localhost:3000/docs
   # Should show new endpoint in Swagger UI
   
   curl http://localhost:3000/openapi.json | jq '.paths["/api/new-endpoint"]'
   # Should show auto-generated spec
   ```

## Validation

```bash
# Test endpoint
curl -X POST http://localhost:3000/api/new-endpoint \
  -H "Content-Type: application/json" \
  -d '{"field1": "test", "field2": 42}'

# Verify OpenAPI
curl http://localhost:3000/docs
curl http://localhost:3000/openapi.json

# Run tests
pnpm test:e2e
```

## Related Docs

- `docs/PLAN.md` - API endpoint specifications
- `docs/architecture-proposal.md` - API layer patterns
