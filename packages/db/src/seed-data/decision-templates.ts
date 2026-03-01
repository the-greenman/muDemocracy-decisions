/**
 * Seed data for Decision Templates
 * Contains the 6 core templates as specified in the implementation plan
 */

import type { CreateDecisionTemplate } from '@repo/core';

// Core decision field IDs (these should match the IDs from the decision fields seed)
const CORE_FIELD_IDS = {
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
} as const;

// Standard Template - For general decisions
export const STANDARD_TEMPLATE: CreateDecisionTemplate = {
  name: 'Standard Decision',
  description: 'A general-purpose template for most decisions',
  category: 'standard',
  fields: [
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.DECISION_STATEMENT,
      order: 0,
      required: true,
      customLabel: 'Decision Statement',
      customDescription: 'Clearly state what decision needs to be made',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CONTEXT,
      order: 1,
      required: true,
      customLabel: 'Context',
      customDescription: 'Background information and circumstances',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OPTIONS,
      order: 2,
      required: true,
      customLabel: 'Options',
      customDescription: 'List of possible choices or alternatives',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CRITERIA,
      order: 3,
      required: false,
      customLabel: 'Evaluation Criteria',
      customDescription: 'Factors to consider when evaluating options',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OUTCOME,
      order: 4,
      required: true,
      customLabel: 'Decision Outcome',
      customDescription: 'Final decision and rationale',
    },
  ],
};

// Technology Template - For technical decisions
export const TECHNOLOGY_TEMPLATE: CreateDecisionTemplate = {
  name: 'Technology Selection',
  description: 'Template for choosing between technical options or architectures',
  category: 'technology',
  fields: [
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.DECISION_STATEMENT,
      order: 0,
      required: true,
      customLabel: 'Technical Decision',
      customDescription: 'What technical choice needs to be made?',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CONTEXT,
      order: 1,
      required: true,
      customLabel: 'Technical Context',
      customDescription: 'Current system architecture and constraints',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OPTIONS,
      order: 2,
      required: true,
      customLabel: 'Technology Options',
      customDescription: 'Available technologies or approaches',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CRITERIA,
      order: 3,
      required: true,
      customLabel: 'Technical Criteria',
      customDescription: 'Performance, scalability, maintainability, etc.',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.ANALYSIS,
      order: 4,
      required: true,
      customLabel: 'Technical Analysis',
      customDescription: 'Detailed comparison of options',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.RISKS,
      order: 5,
      required: true,
      customLabel: 'Technical Risks',
      customDescription: 'Potential technical challenges and mitigations',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OUTCOME,
      order: 6,
      required: true,
      customLabel: 'Technical Decision',
      customDescription: 'Chosen technology and implementation plan',
    },
  ],
};

// Strategy Template - For strategic decisions
export const STRATEGY_TEMPLATE: CreateDecisionTemplate = {
  name: 'Strategic Decision',
  description: 'Template for high-level strategic and business decisions',
  category: 'strategy',
  fields: [
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.DECISION_STATEMENT,
      order: 0,
      required: true,
      customLabel: 'Strategic Question',
      customDescription: 'What strategic decision needs to be made?',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CONTEXT,
      order: 1,
      required: true,
      customLabel: 'Strategic Context',
      customDescription: 'Market position, competitive landscape, business goals',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OPTIONS,
      order: 2,
      required: true,
      customLabel: 'Strategic Options',
      customDescription: 'Possible strategic directions',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CRITERIA,
      order: 3,
      required: true,
      customLabel: 'Strategic Criteria',
      customDescription: 'Alignment with vision, ROI, competitive advantage',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.ANALYSIS,
      order: 4,
      required: true,
      customLabel: 'Strategic Analysis',
      customDescription: 'SWOT analysis, market implications',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.RISKS,
      order: 5,
      required: true,
      customLabel: 'Strategic Risks',
      customDescription: 'Market risks, execution challenges',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.STAKEHOLDERS,
      order: 6,
      required: true,
      customLabel: 'Key Stakeholders',
      customDescription: 'Who will be affected by this decision?',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OUTCOME,
      order: 7,
      required: true,
      customLabel: 'Strategic Decision',
      customDescription: 'Chosen strategy and success metrics',
    },
  ],
};

// Budget Template - For financial decisions
export const BUDGET_TEMPLATE: CreateDecisionTemplate = {
  name: 'Budget Decision',
  description: 'Template for financial and budget-related decisions',
  category: 'budget',
  fields: [
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.DECISION_STATEMENT,
      order: 0,
      required: true,
      customLabel: 'Budget Decision',
      customDescription: 'What financial decision needs to be made?',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CONTEXT,
      order: 1,
      required: true,
      customLabel: 'Financial Context',
      customDescription: 'Current budget, financial constraints, period',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OPTIONS,
      order: 2,
      required: true,
      customLabel: 'Budget Options',
      customDescription: 'Different allocation scenarios',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CRITERIA,
      order: 3,
      required: true,
      customLabel: 'Financial Criteria',
      customDescription: 'ROI, cost-benefit, payback period, risk',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.ANALYSIS,
      order: 4,
      required: true,
      customLabel: 'Financial Analysis',
      customDescription: 'Cost breakdown, projections, impact analysis',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.RESOURCES,
      order: 5,
      required: true,
      customLabel: 'Resource Requirements',
      customDescription: 'People, tools, infrastructure needed',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OUTCOME,
      order: 6,
      required: true,
      customLabel: 'Budget Decision',
      customDescription: 'Approved budget and justification',
    },
  ],
};

// Policy Template - For policy and procedural decisions
export const POLICY_TEMPLATE: CreateDecisionTemplate = {
  name: 'Policy Decision',
  description: 'Template for creating or modifying policies and procedures',
  category: 'policy',
  fields: [
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.DECISION_STATEMENT,
      order: 0,
      required: true,
      customLabel: 'Policy Decision',
      customDescription: 'What policy needs to be established or changed?',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CONTEXT,
      order: 1,
      required: true,
      customLabel: 'Policy Context',
      customDescription: 'Current situation, why change is needed',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OPTIONS,
      order: 2,
      required: true,
      customLabel: 'Policy Options',
      customDescription: 'Different policy approaches',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CRITERIA,
      order: 3,
      required: true,
      customLabel: 'Policy Criteria',
      customDescription: 'Compliance, practicality, enforceability',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.ANALYSIS,
      order: 4,
      required: true,
      customLabel: 'Impact Analysis',
      customDescription: 'Effect on operations, legal implications',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.STAKEHOLDERS,
      order: 5,
      required: true,
      customLabel: 'Affected Parties',
      customDescription: 'Who needs to follow this policy?',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.RISKS,
      order: 6,
      required: true,
      customLabel: 'Policy Risks',
      customDescription: 'Implementation challenges, potential misuse',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OUTCOME,
      order: 7,
      required: true,
      customLabel: 'Policy Decision',
      customDescription: 'Final policy and implementation plan',
    },
  ],
};

// Proposal Template - For evaluating proposals and recommendations
export const PROPOSAL_TEMPLATE: CreateDecisionTemplate = {
  name: 'Proposal Evaluation',
  description: 'Template for evaluating proposals, recommendations, or suggestions',
  category: 'proposal',
  fields: [
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.DECISION_STATEMENT,
      order: 0,
      required: true,
      customLabel: 'Proposal Question',
      customDescription: 'What proposal is being evaluated?',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CONTEXT,
      order: 1,
      required: true,
      customLabel: 'Proposal Background',
      customDescription: 'Origin of the proposal, problem being solved',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OPTIONS,
      order: 2,
      required: true,
      customLabel: 'Proposal Options',
      customDescription: 'Different proposals or versions',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.CRITERIA,
      order: 3,
      required: true,
      customLabel: 'Evaluation Criteria',
      customDescription: 'Metrics for evaluating proposals',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.ANALYSIS,
      order: 4,
      required: true,
      customLabel: 'Proposal Analysis',
      customDescription: 'Detailed evaluation of each proposal',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.RESOURCES,
      order: 5,
      required: false,
      customLabel: 'Required Resources',
      customDescription: "What's needed to implement the proposal?",
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.TIMELINE,
      order: 6,
      required: false,
      customLabel: 'Implementation Timeline',
      customDescription: 'When and how will this be implemented?',
    },
    {
      templateId: '',
      fieldId: CORE_FIELD_IDS.OUTCOME,
      order: 7,
      required: true,
      customLabel: 'Decision on Proposal',
      customDescription: 'Accepted proposal and next steps',
    },
  ],
};

// Export all templates
export const CORE_TEMPLATES: CreateDecisionTemplate[] = [
  STANDARD_TEMPLATE,
  TECHNOLOGY_TEMPLATE,
  STRATEGY_TEMPLATE,
  BUDGET_TEMPLATE,
  POLICY_TEMPLATE,
  PROPOSAL_TEMPLATE,
];

// Helper function to prepare templates for seeding
export function prepareTemplatesForSeeding(): CreateDecisionTemplate[] {
  return CORE_TEMPLATES.map((template, index) => ({
    ...template,
    // Set the first template (Standard) as the default
    isDefault: index === 0,
  }));
}
