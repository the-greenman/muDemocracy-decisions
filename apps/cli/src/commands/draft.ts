import { Command } from 'commander';
import chalk from 'chalk';
import { api, getContext, requireActiveDecisionContext, type DecisionContext, type DecisionField, type DecisionLog, type DecisionTemplate } from '../client.js';

async function resolveContextId(flag?: string): Promise<{ contextId: string; meetingId: string }> {
  if (flag) {
    const ctx = await getContext();
    return { contextId: flag, meetingId: ctx.activeMeetingId ?? '' };
  }
  return requireActiveDecisionContext();
}

function printDraft(ctx: DecisionContext) {
  const draftData = ctx.draftData ?? {};
  const locked = new Set(ctx.lockedFields ?? []);

  console.log(chalk.white(`Draft for context: ${ctx.id}`));
  console.log(chalk.gray(`Status: ${ctx.status}  Template: ${ctx.templateId}`));
  console.log('');

  const entries = Object.entries(draftData);
  if (entries.length === 0) {
    console.log(chalk.yellow('No draft data yet. Run: draft generate'));
    return;
  }

  for (const [fieldId, value] of entries) {
    const lockedMarker = locked.has(fieldId) ? chalk.cyan('[LOCKED] ') : '';
    const displayValue = value ? String(value) : chalk.gray('(empty)');
    console.log(`${lockedMarker}${chalk.gray(fieldId.slice(0, 8) + '…')}: ${displayValue}`);
  }
}

function printTemplateFields(fields: DecisionField[]) {
  if (fields.length === 0) {
    console.log(chalk.yellow('No fields found for this template'));
    return;
  }

  fields.forEach((field, index) => {
    console.log(chalk.white(`${index + 1}. ${field.name}`));
    console.log(chalk.gray(`   ID:       ${field.id}`));
    console.log(chalk.white(`   Type:     ${field.fieldType}`));
    console.log(chalk.white(`   Required: ${field.required ? 'yes' : 'no'}`));
    if (field.description) {
      console.log(chalk.gray(`   Desc:     ${field.description}`));
    }
    console.log('');
  });
}

function printTemplates(templates: DecisionTemplate[]) {
  if (templates.length === 0) {
    console.log(chalk.yellow('No templates found'));
    return;
  }

  templates.forEach((template, index) => {
    const defaultMarker = template.isDefault ? chalk.cyan(' [default]') : '';
    console.log(chalk.white(`${index + 1}. ${template.name}${defaultMarker}`));
    console.log(chalk.gray(`   ID:       ${template.id}`));
    console.log(chalk.white(`   Category: ${template.category}`));
    console.log(chalk.white(`   Version:  ${template.version}`));
    console.log(chalk.white(`   Source:   ${template.isCustom ? 'custom' : template.namespace}`));
    if (template.description) {
      console.log(chalk.gray(`   Desc:     ${template.description}`));
    }
    console.log('');
  });
}

export const draftCommand = new Command('draft')
  .description('Draft generation and management');

draftCommand
  .command('generate')
  .description('Generate or regenerate draft (respects locked fields)')
  .option('-c, --context-id <id>', 'Decision context ID (defaults to active context)')
  .option('-g, --guidance <text>', 'Guidance text for the LLM')
  .action(async (opts: { contextId?: string; guidance?: string }) => {
    const { contextId } = await resolveContextId(opts.contextId);
    const body: Record<string, unknown> = {};
    if (opts.guidance) {
      body.guidance = [{ content: opts.guidance, source: 'user_text' }];
    }
    console.log(chalk.blue('Generating draft…'));
    const ctx = await api.post<DecisionContext>(`/api/decision-contexts/${contextId}/generate-draft`, body);
    console.log(chalk.green('✓ Draft generated'));
    printDraft(ctx);
  });

draftCommand
  .command('show')
  .description('Show current draft (uses active decision context)')
  .action(async () => {
    const appCtx = await getContext();
    if (!appCtx.activeDecisionContext) {
      console.log(chalk.yellow('No active decision context. Run: context set-decision <flagged-id>'));
      return;
    }
    printDraft(appCtx.activeDecisionContext);
  });

draftCommand
  .command('change-template')
  .description('Change the template for a decision context')
  .requiredOption('-t, --template-id <id>', 'New template ID')
  .option('-c, --context-id <id>', 'Decision context ID (defaults to active context)')
  .action(async (opts: { templateId: string; contextId?: string }) => {
    const { contextId } = await resolveContextId(opts.contextId);
    const ctx = await api.post<DecisionContext>(`/api/decision-contexts/${contextId}/template-change`, {
      templateId: opts.templateId,
    });
    console.log(chalk.green('✓ Decision context template changed'));
    console.log(chalk.gray(`Context:  ${ctx.id}`));
    console.log(chalk.white(`Template: ${ctx.templateId}`));
    console.log(chalk.white(`Status:   ${ctx.status}`));
  });

draftCommand
  .command('templates')
  .description('List available decision templates')
  .action(async () => {
    const response = await api.get<{ templates: DecisionTemplate[] }>('/api/templates');
    console.log(chalk.white('Available templates:\n'));
    printTemplates(response.templates);
  });

draftCommand
  .command('template-fields')
  .description('List fields for a template')
  .requiredOption('-t, --template-id <id>', 'Template ID to inspect')
  .action(async (opts: { templateId: string }) => {
    const response = await api.get<{ fields: DecisionField[] }>(`/api/templates/${opts.templateId}/fields`);
    console.log(chalk.white(`Template fields for ${opts.templateId}:\n`));
    printTemplateFields(response.fields);
  });

draftCommand
  .command('lock-field')
  .description('Lock a field to prevent regeneration')
  .requiredOption('-f, --field-id <id>', 'Field ID to lock')
  .option('-c, --context-id <id>', 'Decision context ID (defaults to active context)')
  .action(async (opts: { fieldId: string; contextId?: string }) => {
    const { contextId } = await resolveContextId(opts.contextId);
    await api.put<DecisionContext>(`/api/decision-contexts/${contextId}/lock-field`, { fieldId: opts.fieldId });
    console.log(chalk.green(`✓ Field ${opts.fieldId} locked`));
  });

draftCommand
  .command('unlock-field')
  .description('Unlock a field to allow regeneration')
  .requiredOption('-f, --field-id <id>', 'Field ID to unlock')
  .option('-c, --context-id <id>', 'Decision context ID (defaults to active context)')
  .action(async (opts: { fieldId: string; contextId?: string }) => {
    const { contextId } = await resolveContextId(opts.contextId);
    await api.delete<DecisionContext>(`/api/decision-contexts/${contextId}/lock-field`, { fieldId: opts.fieldId });
    console.log(chalk.green(`✓ Field ${opts.fieldId} unlocked`));
  });

draftCommand
  .command('log')
  .description('Finalize and log the decision (immutable record)')
  .requiredOption('--type <method>', 'Decision method: consensus|vote|authority|defer|reject|manual|ai_assisted')
  .requiredOption('--by <name>', 'Name of person logging the decision')
  .option('--details <text>', 'Additional decision method details')
  .option('-c, --context-id <id>', 'Decision context ID (defaults to active context)')
  .action(async (opts: { type: string; by: string; details?: string; contextId?: string }) => {
    const { contextId } = await resolveContextId(opts.contextId);
    const log = await api.post<DecisionLog>(`/api/decision-contexts/${contextId}/log`, {
      loggedBy: opts.by,
      decisionMethod: { type: opts.type, details: opts.details },
    });
    console.log(chalk.green('✓ Decision logged'));
    console.log(chalk.gray(`Log ID:  ${log.id}`));
    console.log(chalk.white(`Method:  ${log.decisionMethod.type}`));
    console.log(chalk.white(`By:      ${log.loggedBy}`));
    console.log(chalk.gray(`Logged:  ${log.loggedAt}`));
  });
