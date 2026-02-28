# Field Library Management

Add or modify fields in the decision field library.

## When to Use

- Adding new decision fields
- Modifying field extraction prompts
- Creating custom templates

## Steps

1. **Read field library architecture**
   ```bash
   cat docs/field-library-architecture.md
   ```

2. **Add field definition**
   ```typescript
   // packages/db/src/seed/fields.ts
   {
     id: "implementation_timeline",
     name: "Implementation Timeline",
     description: "Key dates and milestones for implementation",
     category: "implementation",
     extractionPrompt: {
       system: "Extract timeline and milestones from the transcript. Format as structured list with dates.",
       examples: [
         {
           input: "We'll start development in March and launch in June",
           output: "March: Development start\nJune: Launch"
         }
       ],
       constraints: [
         "Include specific dates when mentioned",
         "Format as chronological list",
         "Distinguish between deadlines and milestones"
       ]
     },
     fieldType: "structured",
     placeholder: "Q1 2026: Development\nQ2 2026: Testing\nQ3 2026: Launch",
     validationRules: {
       minLength: 10
     },
     version: 1,
     isCustom: false
   }
   ```

3. **Add to relevant templates**
   ```typescript
   // packages/db/src/seed/templates.ts
   {
     id: "strategy-decision",
     fields: [
       // ... existing fields
       { fieldId: "implementation_timeline", order: 8, required: false }
     ]
   }
   ```

4. **Seed database**
   ```bash
   pnpm db:seed
   ```

5. **Verify field appears**
   ```bash
   decision-logger field list --category implementation
   decision-logger field show implementation_timeline
   decision-logger template show strategy-decision
   ```

## Important Rules

- **Never hardcode field lists** - always query from database
- **Version prompts** - increment version when changing extraction logic
- **Test extraction** - verify field extracts correctly from real transcripts

## Validation

```bash
decision-logger field list  # Shows new field
decision-logger field show <field-id>  # Shows definition
decision-logger template show <template-id>  # Shows field in template
```

## Related Docs

- `docs/field-library-architecture.md` - Complete architecture
- `docs/prompt-engineering.md` - Prompt best practices
