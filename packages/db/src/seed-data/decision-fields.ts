/**
 * Authoritative field definitions for the core decision field library.
 *
 * Edit this file to iterate on extraction prompts, instructions, or descriptions.
 * Run `pnpm db:seed` after editing to apply changes to the database.
 *
 * Architecture rules (from docs/field-library-architecture.md):
 * - extractionPrompt belongs here, NOT in templates
 * - instructions are user-facing guidance (distinct from extractionPrompt)
 * - placeholder is the short UI hint shown in the form input
 */

export const CORE_FIELD_IDS = {
  DECISION_STATEMENT: '550e8400-e29b-41d4-a716-446655440001',
  CONTEXT: '550e8400-e29b-41d4-a716-446655440002',
  OPTIONS: '550e8400-e29b-41d4-a716-446655440003',
  CRITERIA: '550e8400-e29b-41d4-a716-446655440004',
  ANALYSIS: '550e8400-e29b-41d4-a716-446655440005',
  OUTCOME: '550e8400-e29b-41d4-a716-446655440006',
  RISKS: '550e8400-e29b-41d4-a716-446655440007',
  TIMELINE: '550e8400-e29b-41d4-a716-446655440008',
  STAKEHOLDERS: '550e8400-e29b-41d4-a716-446655440009',
  RESOURCES: '550e8400-e29b-41d4-a716-446655440010',
  OUTSTANDING_ISSUES: '550e8400-e29b-41d4-a716-446655440011',
  DECISION_QUESTION: '550e8400-e29b-41d4-a716-446655440012',
  TENSION: '550e8400-e29b-41d4-a716-446655440013',
  CONDITIONS_OF_ENOUGH: '550e8400-e29b-41d4-a716-446655440014',
} as const;

export type CoreFieldRecord = {
  id: string;
  namespace: string;
  name: string;
  description: string;
  category: 'context' | 'evaluation' | 'outcome' | 'metadata';
  extractionPrompt: string;
  instructions: string;
  fieldType: 'textarea';
  placeholder: string;
  version: number;
  isCustom: boolean;
};

export const CORE_FIELDS: CoreFieldRecord[] = [
  {
    id: CORE_FIELD_IDS.DECISION_STATEMENT,
    namespace: 'core',
    name: 'decision_statement',
    description: 'A clear, concise statement of the decision being made',
    category: 'outcome',
    extractionPrompt:
      'Extract a single sentence stating what decision is being made. Use active voice. ' +
      'Focus on the decision outcome, not the discussion process. ' +
      'If the decision is implicit (e.g. a decision to defer, reject, or not act), state that explicitly.',
    instructions:
      'Write one clear sentence in active voice stating what was decided. ' +
      'Focus on the decision itself, not the problem being solved or the process used to decide. ' +
      'If the decision is provisional or conditional, say so.',
    fieldType: 'textarea',
    placeholder: 'What decision are we making?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.CONTEXT,
    namespace: 'core',
    name: 'context',
    description: 'The background and circumstances that led to this decision',
    category: 'context',
    extractionPrompt:
      'Summarise the background and situation that led to this decision. ' +
      'Include relevant constraints, prior events, and triggering circumstances.',
    instructions:
      'Provide the background that a reader 6 months later would need to understand why this decision arose. ' +
      'Include relevant constraints, history, or triggering events. ' +
      'Do not restate the decision itself here.',
    fieldType: 'textarea',
    placeholder: 'What context is needed to understand this decision?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.DECISION_QUESTION,
    namespace: 'core',
    name: 'decision_question',
    description: 'The specific decision that the group must answer',
    category: 'context',
    extractionPrompt:
      'Extract the specific decision question the group is trying to answer. ' +
      'The question must describe a choice that could realistically be made.',
    instructions:
      'State the exact decision the group needs to make. ' +
      'Avoid vague framing such as "how should we improve". ' +
      'A good decision question implies a clear choice.',
    fieldType: 'textarea',
    placeholder: 'What exactly are we deciding?',
    version: 1,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.TENSION,
    namespace: 'core',
    name: 'tension',
    description: 'The tension or problem that makes this decision necessary',
    category: 'context',
    extractionPrompt:
      'Summarise the tension or problem that triggered the need for a decision.',
    instructions:
      'Describe the tension between the current situation and the desired outcome.',
    fieldType: 'textarea',
    placeholder: 'What tension or problem requires a decision?',
    version: 1,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.OPTIONS,
    namespace: 'core',
    name: 'options',
    description: 'The alternatives or options that were considered',
    category: 'evaluation',
    extractionPrompt:
      'List all alternatives discussed, including "do nothing" if mentioned. ' +
      'Provide a brief characterisation of each option, not just its name.',
    instructions:
      'List each alternative the group seriously considered, including "do nothing" if it was discussed. ' +
      'Include a brief characterisation of each option — not just names. ' +
      'Options that were quickly dismissed still belong here.',
    fieldType: 'textarea',
    placeholder: 'What other options were considered?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.CRITERIA,
    namespace: 'core',
    name: 'criteria',
    description: 'The criteria or standards used to evaluate the options',
    category: 'evaluation',
    extractionPrompt:
      'List the criteria or standards used to evaluate the options. ' +
      'These are the factors the group cared about, not the options themselves.',
    instructions:
      'State the standards used to judge options — not the options themselves. ' +
      'Examples: cost, security, reversibility, team capability, time to market. ' +
      'Include any weighting or prioritisation of criteria that was discussed.',
    fieldType: 'textarea',
    placeholder: 'What criteria matter for this decision?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.ANALYSIS,
    namespace: 'core',
    name: 'analysis',
    description: 'How the options were compared and what trade-offs were identified',
    category: 'evaluation',
    extractionPrompt:
      'Describe how the options were compared against the criteria. ' +
      'Include trade-offs discussed, disagreements, and which factors were weighted most heavily.',
    instructions:
      'Describe how options fared against the criteria. ' +
      'Include trade-offs, disagreements, and what was weighted most heavily. ' +
      'This is the reasoning that led to the outcome — not a restatement of the outcome itself.',
    fieldType: 'textarea',
    placeholder: 'What analysis supports the decision?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.CONDITIONS_OF_ENOUGH,
    namespace: 'core',
    name: 'conditions_of_enough',
    description: 'Signals that indicate when this decision should be revisited',
    category: 'outcome',
    extractionPrompt:
      'Extract any conditions or signals that would trigger revisiting the decision.',
    instructions:
      'Describe how the group will know when this decision should be reviewed.',
    fieldType: 'textarea',
    placeholder: 'When should this decision be reviewed?',
    version: 1,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.OUTCOME,
    namespace: 'core',
    name: 'outcome',
    description: 'The final decision and the primary rationale for choosing it',
    category: 'outcome',
    extractionPrompt:
      'Extract the chosen option and the primary reason it was selected. ' +
      'If the decision is provisional or conditional, capture those conditions explicitly.',
    instructions:
      'State the chosen option and the primary reason it was selected over the alternatives. ' +
      'If the decision is provisional, subject to conditions, or requires a follow-up approval, say so explicitly.',
    fieldType: 'textarea',
    placeholder: 'What did we decide and why?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.RISKS,
    namespace: 'core',
    name: 'risks',
    description: 'Risks identified and any agreed mitigations',
    category: 'evaluation',
    extractionPrompt:
      'List the risks identified during discussion. ' +
      'For each risk, note any mitigation agreed upon and whether the risk remains open or unresolved.',
    instructions:
      'List the known risks acknowledged at decision time. ' +
      'For each, note any agreed mitigation and whether it remains an open flag. ' +
      'Do not include risks that were discussed and then dismissed without comment.',
    fieldType: 'textarea',
    placeholder: 'What risks were identified?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.TIMELINE,
    namespace: 'core',
    name: 'timeline',
    description: 'Key milestones, deadlines, and sequencing for implementing the decision',
    category: 'metadata',
    extractionPrompt:
      'Extract key milestones, deadlines, and sequencing mentioned. ' +
      'Note any dependencies between steps where stated.',
    instructions:
      'Capture key milestones, deadlines, and sequencing that were agreed. ' +
      'Include dependencies between steps where mentioned. ' +
      'If no timeline was agreed, note that explicitly rather than leaving this blank.',
    fieldType: 'textarea',
    placeholder: 'What is the timeline for implementation?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.STAKEHOLDERS,
    namespace: 'core',
    name: 'stakeholders',
    description: 'People, teams, or systems affected by or involved in this decision',
    category: 'metadata',
    extractionPrompt:
      'Identify who is affected by this decision, who will own its implementation, ' +
      'and who must be kept informed. Note if key stakeholders were absent from the discussion.',
    instructions:
      'Identify who is affected, who owns implementation, and who must be kept informed. ' +
      'Note if key stakeholders were absent from the decision discussion — this matters for accountability.',
    fieldType: 'textarea',
    placeholder: 'Who is impacted?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.RESOURCES,
    namespace: 'core',
    name: 'resources',
    description: 'Resources required to implement the decision (people, tools, budget)',
    category: 'metadata',
    extractionPrompt:
      'Extract the people, budget, tools, or external dependencies required to execute this decision. ' +
      'Note which are confirmed versus still to be secured.',
    instructions:
      'Document the people, budget, tools, or external dependencies required to execute. ' +
      'Note which resources are confirmed and which are still to be secured — this distinction matters.',
    fieldType: 'textarea',
    placeholder: 'What resources are required?',
    version: 2,
    isCustom: false,
  },
  {
    id: CORE_FIELD_IDS.OUTSTANDING_ISSUES,
    namespace: 'core',
    name: 'outstanding_issues',
    description: 'Unresolved questions, dependencies, or concerns from the discussion',
    category: 'evaluation',
    extractionPrompt:
      'Summarise unresolved questions, open dependencies, or concerns the group could not answer in this session. ' +
      'These are follow-up items, not objections to the decision.',
    instructions:
      'Record unresolved questions or open dependencies the group could not answer in this session. ' +
      'These are follow-up items, not objections to the decision. ' +
      'If none, leave blank rather than writing "none."',
    fieldType: 'textarea',
    placeholder: 'What remains unresolved before this decision can proceed?',
    version: 2,
    isCustom: false,
  },
];
