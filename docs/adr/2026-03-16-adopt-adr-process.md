---
decision-id: 5f9f814e-3eda-429a-81d1-222ac47ac6f0
date: 2026-03-16
slug: adopt-a-process-for-recording-architectural-decisions-in-the-decision-logger-project
status: logged
---

# Decision: Adopt a process for recording architectural decisions in the decision logger project

---

**Meeting:** Architectural Decision Records - Usage and Process
**Participants:** Peter, Claude
**Created:** 3/16/2026, 5:51:59 PM
**Updated:** 3/16/2026, 8:08:54 PM
**Decision ID:** 5f9f814e-3eda-429a-81d1-222ac47ac6f0

---

## Context

The decision-logger project is a system for capturing and documenting decisions from meetings. As the project approaches its first public release, the team needs a formal process for recording its own architectural decisions — both to practice what the tool preaches, and to give future contributors clear reasoning behind key choices. Without a structured process, important decisions made during early development will be lost.

## Tension

Two forces create this tension. First, the team builds a tool for capturing decisions yet has no process for capturing its own — a credibility gap that becomes visible at public release. Second, AI-assisted development makes it dangerously easy to make significant architectural choices mid-conversation, without the deliberation those choices deserve. Without ADRs, neither problem is addressed.

## Decision Question

Should the decision-logger project adopt a formal ADR process for recording architectural decisions?

## Options

1. **Adopt ADRs** — establish a formal process for recording architectural decisions at the time they are made. Requires stopping to write a structured record, even in fast-moving or AI-assisted development sessions. Adds friction but creates a durable trail.

2. **Remain ad-hoc** — continue making decisions informally through conversation, commit messages, and READMEs. Lower friction in the moment but leaves no reliable record of reasoning, rejected alternatives, or the conditions under which a decision should be revisited.

## Criteria

1. **Traceability** — can future contributors understand why a decision was made?
2. **Alignment with project purpose** — does the approach reflect what the tool itself advocates?
3. **Sustainability** — will the process actually be followed, or will it be abandoned under pressure?
4. **AI-safety** — does it provide a check against casual architectural decisions made in AI conversations?
5. **AI context architecture** — does it produce structured, durable records that AI assistants can draw on as reliable context in future sessions?

## Analysis

Ad-hoc documentation fails on almost every criterion. It undermines the project's purpose — a decision-logging tool that does not log its own decisions is not credible. It provides no traceability, no consistent structure, and no reliable record for future contributors or AI assistants to draw on.

The critical differentiator is semantic architecture. Ad-hoc records — spread across commit messages, READMEs, and conversation logs — cannot provide the consistent, structured context that AI assistants need to reason reliably across sessions. Only a formal ADR process produces records with predictable shape: context, tension, options, criteria, outcome. This structure is what makes decisions machine-readable as well as human-readable.

The sacrifice is real: ADRs require stopping to write, even under pressure. But the cost of not writing them compounds — each undocumented decision makes the next AI-assisted session slightly less grounded and the codebase slightly harder to reason about.

## Decision Statement

The decision-logger project adopts a formal ADR process for recording architectural decisions.

## Outcome

ADRs are adopted over ad-hoc documentation. The primary rationale is semantic architecture: only a structured, consistently shaped record can serve both human contributors and AI assistants reliably across time.

Implementation:
- ADRs are stored in `docs/adr/` in the repository root
- Files are named `YYYY-MM-DD-slug.md` (e.g. `2026-03-16-adopt-adr-process.md`), avoiding sequential numbers which create coordination problems across branches and approval workflows
- Each ADR includes a stable `decision-id` in its frontmatter (the UUID from the decision-logger system) to allow unambiguous cross-referencing independent of filename or date
- ADRs are structured using the Deliberation Decision template fields as their content shape
- This record is the anchor ADR for the process itself

## Conditions Of Enough

Revisit if: the ADR process is consistently skipped under development pressure; the template proves too heavyweight for the decisions being made; or tooling (e.g. the decision-logger export) changes the format significantly. The process should be reviewed after the first 10 ADRs are written to assess whether the structure is working.

## Outstanding Issues

1. **ADR export template** — a markdown export format needs to be defined and built, mapping the Deliberation Decision fields to the ADR file structure (including frontmatter with decision-id, date, and slug).
2. **Dedicated ADR decision type** — the current Deliberation Decision template may warrant a specialised ADR variant with fields tuned specifically for architectural decisions (e.g. supersedes, status, affected components).
3. **ADR review and approval process** — how ADRs move from draft to accepted, and who has authority to approve, is not yet defined.
4. **Speaker names not appearing in transcript** — display bug to be investigated separately.
5. **Context file not persisting across container recreations** — the decision-logger context store should use a named Docker volume rather than the container filesystem.

---

*Exported from Decision Logger on 3/16/2026, 8:11:25 PM*
*Template: Deliberation Decision*
*Flagged Decision ID: a966fd42-3512-4bb7-8860-76e1afb96fb9*
