# TDD Service Implementation

Implement services using strict Test-Driven Development workflow.

## When to Use

- Creating new services
- Adding service methods
- Implementing business logic

## Steps

1. **Read architecture patterns**
   ```bash
   cat docs/architecture-proposal.md
   ```
   Focus on: Service-Repository pattern, Dependency Injection

2. **Define interface**
   ```typescript
   // packages/core/src/interfaces/i-new-service.ts
   export interface INewService {
     create(data: CreateInput): Promise<Entity>;
     findById(id: string): Promise<Entity | null>;
   }
   ```

3. **Write failing unit test**
   ```typescript
   // packages/core/src/services/__tests__/new-service.test.ts
   describe('NewService', () => {
     it('should create entity with valid data', async () => {
       const mockRepo = createMockRepository();
       const service = new NewService(mockRepo);
       
       const result = await service.create({ name: 'Test' });
       
       expect(result.id).toBeDefined();
       expect(result.name).toBe('Test');
     });
   });
   ```

4. **Run test (should fail)**
   ```bash
   pnpm test --filter=@repo/core
   ```

5. **Implement service with DI**
   ```typescript
   // packages/core/src/services/new-service.ts
   export class NewService implements INewService {
     constructor(private readonly repo: IRepository) {}
     
     async create(data: CreateInput): Promise<Entity> {
       // Validation and business logic
       return this.repo.create(data);
     }
   }
   ```

6. **Run test (should pass)**
   ```bash
   pnpm test --filter=@repo/core
   ```

7. **Write integration test**
   ```typescript
   // packages/core/src/services/__tests__/new-service.integration.test.ts
   describe('NewService (integration)', () => {
     it('should persist to database', async () => {
       const realRepo = new DrizzleRepository(db);
       const service = new NewService(realRepo);
       
       const result = await service.create({ name: 'Test' });
       const found = await service.findById(result.id);
       
       expect(found).toEqual(result);
     });
   });
   ```

8. **Verify coverage**
   ```bash
   pnpm test:coverage --filter=@repo/core
   ```
   Target: >80%

## Validation

```bash
pnpm test --filter=@repo/core  # All tests pass
pnpm test:coverage  # >80% coverage
```

## Related Docs

- `docs/architecture-proposal.md` - Service-Repository pattern
- `docs/agentic-setup-guide.md` - TDD workflow
