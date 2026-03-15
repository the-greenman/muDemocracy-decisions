/**
 * Authoritative template definitions for the core decision template library.
 *
 * Edit this file to iterate on template descriptions, promptTemplate framing, or field composition.
 * Run `pnpm db:seed` after editing to apply changes to the database.
 *
 * Architecture rules (from docs/field-library-architecture.md):
 * - promptTemplate provides workflow framing for the LLM; it must NOT duplicate field extractionPrompts
 * - Templates reference fields by ID; field semantics live in decision-fields.ts
 * - Templates do not override field meaning — if different meaning is needed, use a different field
 */

import type { CreateDecisionTemplate, CreateExportTemplate } from "@repo/schema";
import { CORE_FIELD_IDS } from "./decision-fields.js";

const assignment = (fieldId: string, order: number, required = true) => ({
  fieldId,
  order,
  required,
});

// Standard Template - For general decisions
export const STANDARD_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Standard Decision",
  description:
    "A general-purpose template for decisions that do not fit a more specific category. " +
    "Captures the decision, the options considered, and the rationale. " +
    "Use this when the decision type is unclear or when no specialist template applies.",
  promptTemplate:
    "You are extracting a general decision record from a meeting discussion. " +
    "Focus on identifying the clear decision made — or not made. " +
    "Implicit decisions (a decision to defer, reject, or explicitly not act) are as valid as explicit choices and must be captured. " +
    "Extract the options that were considered and the reasoning behind the chosen path.",
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

export const MINIMAL_DELIBERATION_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Minimal Decision",
  description:
    "A lightweight decision template for quick decisions. " +
    "Captures the essential elements needed to clarify and record a decision.",
  promptTemplate:
    "You are extracting a minimal decision record from a discussion. " +
    "Focus on identifying the decision question, the decision made, " +
    "and when the decision should be revisited.",
  category: "deliberation",
  fields: [
    assignment(CORE_FIELD_IDS.CONTEXT, 0),
    assignment(CORE_FIELD_IDS.DECISION_QUESTION, 1),
    assignment(CORE_FIELD_IDS.DECISION_STATEMENT, 2),
    assignment(CORE_FIELD_IDS.CONDITIONS_OF_ENOUGH, 3, false),
  ],
};

export const DELIBERATION_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Deliberation Decision",
  description:
    "A structured template that guides groups through a full deliberation process. " +
    "Helps clarify the problem, identify options, evaluate them, and record the final decision.",
  promptTemplate:
    "You are extracting a structured decision record from a meeting discussion. " +
    "Reconstruct the deliberation process: identify the context, the tension driving the decision, " +
    "the specific decision question, the options considered, the criteria used to evaluate them, " +
    "and the final decision reached. Capture reasoning clearly and note when the decision should be revisited.",
  category: "deliberation",
  fields: [
    assignment(CORE_FIELD_IDS.CONTEXT, 0),
    assignment(CORE_FIELD_IDS.TENSION, 1),
    assignment(CORE_FIELD_IDS.DECISION_QUESTION, 2),
    assignment(CORE_FIELD_IDS.OPTIONS, 3),
    assignment(CORE_FIELD_IDS.CRITERIA, 4, false),
    assignment(CORE_FIELD_IDS.ANALYSIS, 5, false),
    assignment(CORE_FIELD_IDS.DECISION_STATEMENT, 6),
    assignment(CORE_FIELD_IDS.OUTCOME, 7),
    assignment(CORE_FIELD_IDS.CONDITIONS_OF_ENOUGH, 8, false),
    assignment(CORE_FIELD_IDS.OUTSTANDING_ISSUES, 9, false),
  ],
};

export const TECHNOLOGY_TEMPLATE: CreateDecisionTemplate = {
  namespace: "core",
  name: "Technology Selection",
  description:
    "For choosing between technical tools, frameworks, platforms, or architectures. " +
    "Emphasises comparative evaluation of alternatives against explicit criteria and trade-off analysis.",
  promptTemplate:
    "You are extracting a technology selection decision from a meeting discussion. " +
    "Emphasise the comparative analysis of alternatives against stated criteria. " +
    "Capture what trade-offs drove the final selection, not just which option was chosen. " +
    "Note whether the choice is confirmed or provisional, and flag any remaining technical risks.",
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
  description:
    "For high-level strategic and business direction decisions. " +
    "Captures the current state being moved away from, the chosen direction, and what was explicitly deprioritised.",
  promptTemplate:
    "You are extracting a strategic direction decision from a meeting discussion. " +
    "Focus on the current state being moved away from, the chosen direction, and — importantly — what was explicitly deprioritised or ruled out. " +
    "Alignment rationale and stakeholder considerations are as important as the decision itself. " +
    "Capture any assumptions or conditions the strategy relies on.",
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
  description:
    "For financial and budget-related decisions. " +
    "Emphasises stated amounts, ROI reasoning, alternatives considered, and source of funding.",
  promptTemplate:
    "You are extracting a financial or budget decision from a meeting discussion. " +
    "Emphasise any stated amounts, ROI reasoning, and alternatives that were ruled out. " +
    "Capture the source of funding and any conditions attached to the approval. " +
    "Flag whether this is a provisional budget commitment or a confirmed one.",
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
  description:
    "For creating or modifying policies, procedures, and governance rules. " +
    "Captures what is changing and why, who is affected, and any compliance or regulatory considerations.",
  promptTemplate:
    "You are extracting a policy or governance decision from a meeting discussion. " +
    "Focus on what rule or practice is changing and why the change is being made. " +
    "Capture who is affected and who has authority to approve. " +
    "Note any compliance, regulatory, or legal reasoning mentioned.",
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
    "For evaluating and deciding whether to accept proposals, recommendations, or suggestions. " +
    "Captures who proposed, how stakeholder concerns were addressed, and whether acceptance is conditional.",
  promptTemplate:
    "You are extracting a proposal acceptance or rejection decision from a meeting discussion. " +
    "Focus on who submitted the proposal and the grounds on which it was evaluated. " +
    "Capture how stakeholder concerns were addressed — or not. " +
    "Note whether the acceptance is unconditional or has conditions attached, and flag any outstanding dependencies.",
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
  DELIBERATION_TEMPLATE,
  MINIMAL_DELIBERATION_TEMPLATE,
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

export function prepareDefaultExportTemplatesForSeeding(): CreateExportTemplate[] {
  return CORE_TEMPLATES.map((template) => ({
    deliberationTemplateId: "00000000-0000-0000-0000-000000000000",
    namespace: template.namespace,
    name: `${template.name} Default Export`,
    description: `Derived default export template for ${template.name}`,
    fields: template.fields.map((field) => ({
      fieldId: field.fieldId,
      order: field.order,
    })),
  }));
}
