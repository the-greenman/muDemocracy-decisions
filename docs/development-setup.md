# Development Environment Setup

This guide covers setting up your local development environment for the Decision Logger project.

## Prerequisites

- **Node.js**: 20+ (LTS recommended)
- **pnpm**: 8+ (`npm install -g pnpm`)
- **Docker**: 24+ with Docker Compose
- **Git**: Latest version

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd windsurf-project
pnpm install
```

### 2. Start Database

```bash
# Start PostgreSQL 16 with pgvector
docker compose up -d

# Verify database is running
docker compose ps
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your API keys
# Required: ANTHROPIC_API_KEY or OPENAI_API_KEY
```

### 4. Run Migrations

```bash
# Generate initial migration (Phase 1)
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Optional: Open Drizzle Studio to inspect DB
pnpm db:studio
```

### 5. Run Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

### 6. Start Development

```bash
# Start all apps in dev mode (Turborepo)
pnpm dev

# Or start specific apps
pnpm dev --filter=@repo/api
pnpm dev --filter=@repo/cli
```

## Database Management

### Access PostgreSQL

```bash
# Via Docker
docker compose exec postgres psql -U decision_logger -d decision_logger_dev

# Via local psql (if installed)
psql postgresql://decision_logger:dev_password@localhost:5432/decision_logger_dev
```

### Reset Database

```bash
# Stop and remove volumes
docker compose down -v

# Restart (will reinitialize)
docker compose up -d

# Re-run migrations
pnpm db:migrate
```

### Drizzle Studio

```bash
# Web UI for database inspection
pnpm db:studio
# Opens at http://localhost:4983
```

## Testing Strategy

### Unit Tests (Fast)
```bash
# Mock all external dependencies
pnpm test:unit

# Example: Test a service with mocked repository
pnpm test --filter=@repo/core -- --grep="MeetingService"
```

### Integration Tests (Slower)
```bash
# Uses test database
pnpm test:integration

# Requires: TEST_DATABASE_URL in .env
```

### LLM Tests (Slowest, Optional)
```bash
# Real API calls - requires valid API key
pnpm test:llm

# These are skipped by default in CI
```

## Monorepo Commands

### Build
```bash
# Build all packages
pnpm build

# Build specific package
pnpm build --filter=@repo/schema
```

### Lint & Format
```bash
# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### Clean
```bash
# Remove all build artifacts and node_modules
pnpm clean

# Reinstall dependencies
pnpm install
```

## Troubleshooting

### Port Conflicts

If port 5432 is already in use:
```yaml
# Edit docker-compose.yml
ports:
  - "5433:5432"  # Use different host port

# Update .env
DATABASE_URL=postgresql://decision_logger:dev_password@localhost:5433/decision_logger_dev
```

### Database Connection Issues

```bash
# Check if container is running
docker compose ps

# Check logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

### pnpm Install Failures

```bash
# Clear pnpm cache
pnpm store prune

# Remove node_modules and reinstall
rm -rf node_modules
pnpm install
```

### Migration Errors

```bash
# Check current migration status
pnpm db:check

# Drop and recreate (DESTRUCTIVE)
docker compose down -v
docker compose up -d
pnpm db:migrate
```

## IDE Setup

### VS Code / Cursor / Windsurf

Recommended extensions:
- ESLint
- Prettier
- Drizzle ORM
- PostgreSQL (for SQL syntax)

### Environment Variables

Create `.env` in workspace root (already gitignored):
```bash
cp .env.example .env
```

## Phase 0 Validation

After setup, verify the vertical slice works:

```bash
# 1. Build passes
pnpm build

# 2. Tests pass (even if zero tests)
pnpm test

# 3. Database is accessible
docker compose exec postgres psql -U decision_logger -d decision_logger_dev -c "SELECT version();"

# 4. API starts (once implemented)
pnpm dev --filter=@repo/api
curl http://localhost:3000/health
```

## Production Considerations

This setup is for **development only**. Production deployment will require:

- Managed PostgreSQL (e.g., Supabase, Neon, RDS)
- Environment-specific secrets management
- Proper connection pooling
- SSL/TLS for database connections
- API authentication/authorization

See deployment documentation (Phase 8) for production setup.
