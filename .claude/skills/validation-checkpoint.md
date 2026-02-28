# Validation Checkpoint

Run phase-specific validation checkpoint to verify implementation.

## When to Use

- After completing a phase
- Before proceeding to next phase
- To verify changes didn't break existing functionality

## Steps

1. **Find current phase**
   ```bash
   cat docs/iterative-implementation-plan.md | grep -A 5 "## Phase"
   ```

2. **Locate validation checkpoint**
   Look for section: `**Validation Checkpoint X.Y**:`

3. **Run exact commands**
   Example for Phase 2.7:
   ```bash
   decision-logger meeting create "Test" --date 2026-02-27 --participants Alice
   decision-logger meeting list
   decision-logger field list  # Shows ~25 fields
   decision-logger field list --category evaluation
   decision-logger template list  # Shows 6 templates
   decision-logger template show technology-selection
   ```

4. **Verify output matches expected**
   - Check command succeeds (exit code 0)
   - Verify output format
   - Confirm expected data appears

5. **If checkpoint fails**
   - **Stop** - Do not proceed to next phase
   - **Diagnose** - Identify root cause
   - **Fix** - Address at appropriate layer
   - **Re-validate** - Run checkpoint again

## Phase-Specific Checkpoints

### Phase 0
```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Meeting", "date": "2026-02-27", "participants": ["Alice"]}'

decision-logger meeting create "Test Meeting" --date 2026-02-27 --participants Alice,Bob
```

### Phase 2
```bash
pnpm test --filter=@repo/core
pnpm test:coverage  # >80%
decision-logger field list
decision-logger template list
```

### Phase 3
```bash
decision-logger transcript upload test-cases/implicit-defer.json
decision-logger decisions flagged
pnpm test:llm -- --grep="decision detection"
# Target: Precision >0.80, Recall >0.75, F1 >0.77
```

### Phase 6
```bash
pnpm test:e2e
curl http://localhost:3000/api/meetings/<meeting-id>/context
curl http://localhost:3000/docs
```

## Exit Criteria

**Do not proceed if**:
- ❌ Tests fail
- ❌ Coverage <80%
- ❌ Commands error
- ❌ Output doesn't match expected

**Proceed only if**:
- ✅ All tests pass
- ✅ Coverage >80%
- ✅ All commands succeed
- ✅ Output matches expected

## Related Docs

- `docs/iterative-implementation-plan.md` - All checkpoints
- `docs/agentic-setup-guide.md` - Validation workflow
