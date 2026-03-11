/**
 * Seed data for Decision Templates
 * Contains the 6 core templates as specified in the implementation plan
 */

import type { CreateDecisionTemplate } from "@repo/schema";

// Core decision field IDs (these should match the IDs from the decision fields seed)
const CORE_FIELD_IDS = {
  DECISION_STATEMENT: "550e8400-e29b-41d4-a716-446655440001",
  CONTEXT: "550e8400-e29b-41d4-a716-446655440002",
  OPTIONS: "550e8400-e29b-41d4-a716-446655440003",
  CRITERIA: "550e8400-e29b-41d4-a716-446655440004",
  ANALYSIS: "550e8400-e29b-41d4-a716-446655440005",
  OUTCOME: "550e8400-e29b-41d4-a716-446655440006",
  RISKS: "550e8400-e29b-41d4-a716-446655440007",
  TIMELINE: "550e8400-e29b-41d4-a716-446655440008",
  STAKEHOLDERS: "550e8400-e29b-41d4-a716-446655440009",
  RESOURCES: "550e8400-e29b-41d4-a716-446655440010",
  OUTSTANDING_ISSUES: "550e8400-e29b-41d4-a716-446655440011",
} as const;

const assignment = (fieldId: string, order: number, required = true) => ({
  fieldId,
  order,
  required,
});

// Standard Template - For general decisions
export const STANDARD_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Standard Decision",
  description: "A general-purpose template for most decisions",
  category: "standard",
  fields: [
    assignment(CORE_FIELD_IDS.DECISION_STATEMENT, 0),
    assignment(CORE_FIELD_IDS.CONTEXT, 1),
    assignment(CORE_FIELD_IDS.OPTIONS, 2),
    assignment(CORE_FIELD_IDS.CRITERIA, 3, false),
    assignment(CORE_FIELD_IDS.OUTCOME, 4),
    assignment(CORE_FIELD_IDS.OUTSTANDING_ISSUES, 5, false),
  ],
};

// Technology Template - For technical decisions
export const TECHNOLOGY_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Technology Selection",
  description: "Template for choosing between technical options or architectures",
  category: "technology",
  fields: [
    assignment(CORE_FIELD_IDS.DECISION_STATEMENT, 0),
    assignment(CORE_FIELD_IDS.CONTEXT, 1),
    assignment(CORE_FIELD_IDS.OPTIONS, 2),
    assignment(CORE_FIELD_IDS.CRITERIA, 3),
    assignment(CORE_FIELD_IDS.ANALYSIS, 4),
    assignment(CORE_FIELD_IDS.RISKS, 5),
    assignment(CORE_FIELD_IDS.OUTCOME, 6),
  ],
};

// Strategy Template - For strategic decisions
export const STRATEGY_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Strategy Decision",
  description: "Template for high-level strategic and business decisions",
  category: "strategy",
  fields: [
    assignment(CORE_FIELD_IDS.DECISION_STATEMENT, 0),
    assignment(CORE_FIELD_IDS.CONTEXT, 1),
    assignment(CORE_FIELD_IDS.OPTIONS, 2),
    assignment(CORE_FIELD_IDS.CRITERIA, 3),
    assignment(CORE_FIELD_IDS.ANALYSIS, 4),
    assignment(CORE_FIELD_IDS.RISKS, 5),
    assignment(CORE_FIELD_IDS.STAKEHOLDERS, 6),
    assignment(CORE_FIELD_IDS.OUTCOME, 7),
    assignment(CORE_FIELD_IDS.OUTSTANDING_ISSUES, 8, false),
  ],
};

// Budget Template - For financial decisions
export const BUDGET_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Budget Decision",
  description: "Template for financial and budget-related decisions",
  category: "budget",
  fields: [
    assignment(CORE_FIELD_IDS.DECISION_STATEMENT, 0),
    assignment(CORE_FIELD_IDS.CONTEXT, 1),
    assignment(CORE_FIELD_IDS.OPTIONS, 2),
    assignment(CORE_FIELD_IDS.CRITERIA, 3),
    assignment(CORE_FIELD_IDS.ANALYSIS, 4),
    assignment(CORE_FIELD_IDS.RESOURCES, 5),
    assignment(CORE_FIELD_IDS.OUTCOME, 6),
  ],
};

// Policy Template - For policy and procedural decisions
export const POLICY_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Policy Decision",
  description: "Template for creating or modifying policies and procedures",
  category: "policy",
  fields: [
    assignment(CORE_FIELD_IDS.DECISION_STATEMENT, 0),
    assignment(CORE_FIELD_IDS.CONTEXT, 1),
    assignment(CORE_FIELD_IDS.OPTIONS, 2),
    assignment(CORE_FIELD_IDS.CRITERIA, 3),
    assignment(CORE_FIELD_IDS.ANALYSIS, 4),
    assignment(CORE_FIELD_IDS.STAKEHOLDERS, 5),
    assignment(CORE_FIELD_IDS.RISKS, 6),
    assignment(CORE_FIELD_IDS.OUTCOME, 7),
  ],
};

// Proposal Template - For evaluating proposals and recommendations
export const PROPOSAL_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Proposal Acceptance",
  description:
    "Template for evaluating and deciding whether to accept proposals, recommendations, or suggestions",
  category: "proposal",
  fields: [
    assignment(CORE_FIELD_IDS.DECISION_STATEMENT, 0),
    assignment(CORE_FIELD_IDS.CONTEXT, 1),
    assignment(CORE_FIELD_IDS.OPTIONS, 2),
    assignment(CORE_FIELD_IDS.CRITERIA, 3),
    assignment(CORE_FIELD_IDS.ANALYSIS, 4),
    assignment(CORE_FIELD_IDS.RESOURCES, 5, false),
    assignment(CORE_FIELD_IDS.TIMELINE, 6, false),
    assignment(CORE_FIELD_IDS.OUTCOME, 7),
    assignment(CORE_FIELD_IDS.OUTSTANDING_ISSUES, 8, false),
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
