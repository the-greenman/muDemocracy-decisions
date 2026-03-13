// ── API → UI adapters ─────────────────────────────────────────────
// Transform API response shapes into the UI types that existing
// components expect (Field[], Candidate[], AgendaItem[], etc.).
//
// Components never import from api/. They receive adapted data via
// props from pages/hooks.

import type {
  DecisionContext,
  DecisionField,
  FlaggedDecisionListItem,
  Meeting,
  MeetingSummary,
} from "./types.js";
import type { Field, Candidate } from "../lib/ui-models.js";

// ── Field adapter ─────────────────────────────────────────────────

/**
 * Build the Field[] that FacilitatorFieldCard and SharedMeetingPage
 * expect from the API's flat draftData + lockedFields structures.
 *
 * IMPORTANT: draftData keys are field UUIDs, not field names.
 * Always use f.id (the UUID) as the lookup key.
 */
export function buildUIFields(templateFields: DecisionField[], context: DecisionContext): Field[] {
  return templateFields.map((f) => ({
    id: f.id,
    label: formatFieldName(f.name),
    value: context.draftData?.[f.id] ?? "",
    status: context.lockedFields.includes(f.id) ? ("locked" as const) : ("idle" as const),
    required: false, // templateFieldAssignment.required not exposed in API response yet
    instructions: f.instructions,
  }));
}

/**
 * Convert a snake_case field name to Title Case for display.
 * "decision_statement" → "Decision Statement"
 */
export function formatFieldName(name: string): string {
  return name
    .split("_")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ── Candidate adapter ─────────────────────────────────────────────

/**
 * Map pending flagged decisions to the Candidate[] shape used by
 * CandidateCard and the Suggested tab.
 */
export function buildCandidates(decisions: FlaggedDecisionListItem[]): Candidate[] {
  return decisions
    .filter((d) => d.status === "pending")
    .map((d) => ({
      id: d.id,
      title: d.suggestedTitle,
      summary: d.contextSummary,
      status: "new" as const,
      detectedAt: new Date(d.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
}

// ── Agenda adapter ────────────────────────────────────────────────

export type AgendaItemStatus = "pending" | "active" | "drafted" | "logged" | "deferred";

export interface AgendaItem {
  id: string;
  title: string;
  status: AgendaItemStatus;
  contextId: string | null;
  priority: number;
}

/**
 * Map accepted flagged decisions to the AgendaItem[] shape used by
 * AgendaList and the Agenda tab, sorted by priority ascending.
 *
 * Status derivation:
 *   no context          → 'pending'
 *   context.hasDraft    → 'drafted'
 *   context.status === 'logged' → 'logged'
 *   (active overlay applied by caller)
 */
export function buildAgendaItems(decisions: FlaggedDecisionListItem[]): AgendaItem[] {
  return decisions
    .filter((d) => d.status === "accepted")
    .sort((a, b) => a.priority - b.priority)
    .map((d) => {
      let status: AgendaItemStatus = "pending";
      if (d.contextStatus === "logged") {
        status = "logged";
      } else if (d.hasDraft) {
        status = "drafted";
      }
      return {
        id: d.id,
        title: d.suggestedTitle,
        status,
        contextId: d.contextId,
        priority: d.priority,
      };
    });
}

// ── Meeting adapter ───────────────────────────────────────────────

export interface UIMeeting {
  id: string;
  title: string;
  date: string;
  status: "active" | "closed";
  participants: string[];
  draftedCount: number;
  loggedCount: number;
}

/**
 * Map an API Meeting + optional MeetingSummary to the UIMeeting shape
 * used by MeetingListPage rows.
 */
export function toUIMeeting(m: Meeting, summary?: MeetingSummary): UIMeeting {
  return {
    id: m.id,
    title: m.title,
    date: m.date,
    status: m.status === "ended" ? "closed" : "active",
    participants: m.participants,
    draftedCount: summary?.draftCount ?? 0,
    loggedCount: summary?.loggedCount ?? 0,
  };
}
