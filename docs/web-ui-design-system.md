# Web UI Design System

**Status**: authoritative
**Owns**: color tokens, typography, component vocabulary, density modes, design language
**Must sync with**: `docs/web-ui-plan.md`, `docs/ui-ux-overview.md`
**Implemented in**: `apps/web/` (Tailwind CSS config + component library)

---

## Design Language

### Principles

1. **Projection-first**: every element on the shared display must be readable from 4–6 metres on a standard projector. Size, contrast, and spacing decisions start here.
2. **Semantic silence**: status is communicated through colour and shape, not labels. No `[LOCKED]`, `[GENERATING]`, or `[PENDING]` text on the shared display — only visual cues.
3. **Two densities, one component**: each component renders in `display` density (shared screen) or `facilitator` density (operator screen). The same React component supports both via a `density` prop or CSS class.
4. **Controls are invisible until needed**: on the shared display, field cards contain no action affordances. Facilitator density reveals controls without changing the core layout.
5. **Colour earns meaning**: reserved colours have consistent semantic meaning throughout. Accent (indigo) = active/generating. Green = settled/locked. Amber = tag:project. Using these colours arbitrarily is prohibited.

---

## Theme

Base theme: **dark**. Both the shared display and facilitator view use the same dark theme. The facilitator surface is slightly lighter to distinguish panels.

---

## Color Tokens

### Base palette

| Token | Value | Usage |
|---|---|---|
| `bg-base` | `#0f1117` | Page background |
| `bg-surface` | `#1c2033` | Card and panel background |
| `bg-surface-raised` | `#252b42` | Elevated surfaces — dropdowns, modals, sidebars |
| `bg-field-locked` | `#1a3328` | Background of a locked/settled field card |
| `border-subtle` | `#2e3450` | Default card and divider borders |
| `border-accent` | `#6c8ef7` | Focus rings, active field borders |
| `border-locked` | `#2d6a4f` | Left border of locked field card |

### Text

| Token | Value | Usage |
|---|---|---|
| `text-primary` | `#f0f4ff` | Main readable content — field values, headings |
| `text-secondary` | `#8b9cbf` | Labels, field names, metadata |
| `text-muted` | `#4a5578` | Timestamps, very secondary info |
| `text-on-accent` | `#ffffff` | Text on accent-coloured backgrounds |

### Semantic colours

| Token | Value | Meaning |
|---|---|---|
| `accent` | `#6c8ef7` | Active state, generating indicator, focus, primary CTA |
| `accent-hover` | `#8aa6ff` | Hover state for accent elements |
| `settled` | `#34d399` | Locked/settled field — agreement reached |
| `settled-dim` | `#1e6e51` | Subtle settled accent (dot, thin border) |
| `danger` | `#f87171` | Destructive actions — delete, dismiss |
| `danger-hover` | `#fca5a5` | Danger hover |
| `warning` | `#fbbf24` | Caution states |

### Tag category colours

Tags are first-class entities with three categories. Each has a pill background and text colour pair for legibility on dark surfaces.

| Category | Pill bg | Pill text | Dot colour |
|---|---|---|---|
| `topic` | `#1e3a5f` | `#93c5fd` | `#3b82f6` |
| `team` | `#2d1f5e` | `#c4b5fd` | `#7c3aed` |
| `project` | `#3d2e0a` | `#fcd34d` | `#f59e0b` |

### Agenda item status

| Status | Indicator colour | Meaning |
|---|---|---|
| `pending` | `text-muted` | Not yet worked on |
| `active` | `accent` | Currently being discussed |
| `drafted` | `#60a5fa` (blue) | Draft in progress |
| `logged` | `settled` | Finalised |

---

## Typography

### Typeface

**Atkinson Hyperlegible** (primary) — designed for maximum legibility, especially for low-vision readers and at distance. Ideal for projection.
Fallback: `system-ui, -apple-system, sans-serif`

Load via Google Fonts or self-hosted:
```
Atkinson Hyperlegible: 400 (Regular), 700 (Bold)
```

### Type scale

Two density contexts use different scales. `display` is the shared projection screen; `facilitator` is the operator's device.

#### Display density (shared screen / projected)

| Role | Size | Weight | Colour |
|---|---|---|---|
| Meeting title | 28px / 1.75rem | 700 | `text-primary` |
| Section heading (Agenda) | 14px / 0.875rem | 700 | `text-secondary` — uppercase, tracked |
| Agenda item title | 20px / 1.25rem | 400 | `text-primary` |
| Field label | 13px / 0.8125rem | 700 | `text-secondary` — uppercase, tracked |
| Field value | 22px / 1.375rem | 400 | `text-primary` |
| Tag pill text | 13px / 0.8125rem | 400 | category text colour |
| Generating placeholder | 22px / 1.375rem | 400 | `text-muted` — italic |

#### Facilitator density (operator device)

| Role | Size | Weight | Colour |
|---|---|---|---|
| Meeting title | 20px / 1.25rem | 700 | `text-primary` |
| Section heading | 11px / 0.6875rem | 700 | `text-secondary` — uppercase, tracked |
| Agenda item title | 14px / 0.875rem | 400 | `text-primary` |
| Field label | 11px / 0.6875rem | 700 | `text-secondary` — uppercase, tracked |
| Field value | 15px / 0.9375rem | 400 | `text-primary` |
| Tag pill text | 11px / 0.6875rem | 400 | category text colour |
| Control label | 12px / 0.75rem | 400 | `text-secondary` |

---

## Spacing and Layout

### Base unit

`4px` — all spacing is a multiple of 4.

### Spacing tokens

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Tight internal padding |
| `space-2` | 8px | Component internal padding (facilitator) |
| `space-3` | 12px | Small gaps |
| `space-4` | 16px | Standard gap / component padding |
| `space-6` | 24px | Section spacing |
| `space-8` | 32px | Large section gaps |
| `space-12` | 48px | Display-density field card padding |

### Display density padding

Field cards on the shared display use `space-12` (48px) horizontal padding and `space-8` (32px) vertical. This creates comfortable whitespace readable from distance.

### Two-column meeting layout

The meeting views (shared and facilitator) use a two-column layout:
- **Left column** (agenda panel): fixed 280px (display) / 240px (facilitator)
- **Right column** (workspace): fluid, fills remaining width
- Gap: `space-4` (16px)

### Border radius

| Context | Radius |
|---|---|
| Cards | `12px` |
| Pills / badges | `999px` (fully rounded) |
| Buttons | `8px` |
| Inputs | `8px` |

---

## Component Vocabulary

### FieldCard

The core display unit. Represents one decision field.

**States:**

| State | Visual treatment |
|---|---|
| `idle` | `bg-surface` card, `border-subtle` border |
| `generating` | Animated accent left border (4px), shimmer skeleton on content area, accent pulse |
| `locked` | `bg-field-locked` card, `border-locked` left border (4px), settled dot in top-right corner |
| `editing` | `border-accent` border, white text input (facilitator only) |

**Display density:**
```
┌────────────────────────────────────────────┐
│  DECISION STATEMENT                        │  ← field label (13px, uppercase, muted)
│                                            │
│  We will migrate to AWS by Q3,             │  ← field value (22px)
│  prioritising the data pipeline.           │
│                                            │
└────────────────────────────────────────────┘

Locked:
┌╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴┐  ← border-locked left accent
│  OPTIONS CONSIDERED                     ●  │  ← settled dot (top-right)
│                                            │  ← bg-field-locked bg
│  AWS / GCP (rejected) / On-premise        │
│  (rejected)                               │
└────────────────────────────────────────────┘

Generating:
┌▌───────────────────────────────────────────┐  ← accent left border, animated pulse
│  RISKS                                     │
│                                            │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░               │  ← shimmer skeleton
│  ░░░░░░░░░░░░                              │
└────────────────────────────────────────────┘
```

**Facilitator density** — same structure, smaller type, adds control row:
```
┌──────────────────────────────────────┐
│  RISKS                  🔓 ↺ ⤢      │  ← controls: lock, regen, zoom
│                                      │
│  Supply chain delays may affect...   │  ← 15px value text
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Add guidance for next regen… │   │  ← guidance input (collapsed by default)
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

---

### AgendaItem

Represents one decision on the agenda panel.

**States:**

| State | Indicator | Text treatment |
|---|---|---|
| `pending` | Dim circle | `text-secondary` |
| `active` | Accent filled circle + accent left border on row | `text-primary` |
| `drafted` | Blue circle | `text-primary` |
| `logged` | Settled-green circle | `text-secondary` (muted — done) |

**Display density:**
```
  ◉  Cloud Migration Decision       ← active (accent dot, full-brightness title)
  ○  Hiring Freeze                  ← pending (muted dot, secondary text)
  ●  Office Move Policy             ← logged (settled dot, muted text)
```

**Facilitator density** — same dots, adds drag handle and position number:
```
  ⠿ 1  ◉  Cloud Migration Decision   [ Set active ]
  ⠿ 2  ○  Hiring Freeze
  ⠿ 3  ●  Office Move Policy
```

---

### CandidateCard (facilitator only)

Appears in the `Suggested` tab of the candidate queue.

```
┌──────────────────────────────────────────┐
│  Approve roof repair budget              │  ← title (editable)
│  Maintenance fund request discussed...   │  ← summary excerpt (editable)
│                                          │
│  [Standard Decision ▾]  [ Promote ]  [✕]│  ← template picker, promote, dismiss
└──────────────────────────────────────────┘
```

---

### TagPill

Small rounded pill. Category determines colour. No interaction on shared display; facilitator adds a remove button.

```
Display:      [● infrastructure]   [● Platform Team]   [● Cloud Migration]
              topic (blue)          team (violet)         project (amber)

Facilitator:  [● infrastructure ×]   [● Platform Team ×]   [ + add tag… ]
```

Pill structure: 4px padding vertical, 10px horizontal, 12px border-radius, 11–13px text.

---

### StatusBadge

Tiny status indicator for meeting list and agenda counts. Uses colour + minimal text.

```
  2 drafted   1 logged   3 pending
```

On shared display: dot + count only, no word labels.

---

### ActionButton

Three visual variants. Facilitator-only for mutations; shared display has none.

| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| `primary` | `accent` | `text-on-accent` | none | Main CTA — Generate, Finalise, Promote |
| `ghost` | transparent | `accent` | `border-accent` | Secondary — Unlock, Add segments |
| `danger` | transparent | `danger` | `danger` | Destructive — Dismiss, Delete |
| `icon` | transparent | `text-secondary` | none | Per-field controls — lock, regen, zoom icons |

Icon buttons use 32px × 32px touch target, 18px icon size.

---

### LockIndicator

Communicates settled/locked state without the word "locked."

| Context | Treatment |
|---|---|
| Shared display — field card | Small filled circle (8px) top-right, `settled` colour |
| Facilitator — field card | Toggle button with lock/unlock icon; when locked, bg-field-locked also applied |
| Agenda item | Settled dot in item row |

---

### GeneratingSpinner

Per-field animation during draft generation.

- **Shared display**: left border of field card pulses with accent colour (CSS keyframe animation, 1.5s ease-in-out). Content area shows 2–3 rows of shimmer skeleton (light sweep on `bg-surface-raised`). No text.
- **Facilitator**: same animation, plus `Generating…` text label replaces content area.

Full-draft generation: multiple field cards animate simultaneously in sequence-order to show progress.

---

### RelationsList (facilitator sidebar)

Compact list of related decisions for the active context.

```
Related decisions
─────────────────
→ supersedes    Office Parking Policy 2024
→ depends_on    Budget Approval Q4
↔ related_to    Staff Travel Policy
```

Arrow direction: `→` outgoing, `←` incoming, `↔` bidirectional (related_to).

---

## Tailwind CSS Configuration Sketch

Custom tokens to add to `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      base: '#0f1117',
      surface: '#1c2033',
      'surface-raised': '#252b42',
      'field-locked': '#1a3328',
      accent: '#6c8ef7',
      'accent-hover': '#8aa6ff',
      settled: '#34d399',
      'settled-dim': '#1e6e51',
      danger: '#f87171',
      border: {
        subtle: '#2e3450',
        accent: '#6c8ef7',
        locked: '#2d6a4f',
      },
      text: {
        primary: '#f0f4ff',
        secondary: '#8b9cbf',
        muted: '#4a5578',
      },
      tag: {
        'topic-bg':    '#1e3a5f',
        'topic-text':  '#93c5fd',
        'team-bg':     '#2d1f5e',
        'team-text':   '#c4b5fd',
        'project-bg':  '#3d2e0a',
        'project-text':'#fcd34d',
      },
    },
    fontFamily: {
      sans: ['"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      'field-value-display':     ['1.375rem', { lineHeight: '1.6' }],  // 22px
      'field-label-display':     ['0.8125rem', { lineHeight: '1', letterSpacing: '0.08em' }],
      'agenda-title-display':    ['1.25rem',   { lineHeight: '1.4' }],
      'field-value-facilitator': ['0.9375rem', { lineHeight: '1.5' }],
      'field-label-facilitator': ['0.6875rem', { lineHeight: '1', letterSpacing: '0.08em' }],
    },
    animation: {
      'accent-pulse': 'accentPulse 1.5s ease-in-out infinite',
      'shimmer':      'shimmer 1.8s linear infinite',
    },
    keyframes: {
      accentPulse: {
        '0%, 100%': { opacity: '0.4' },
        '50%':      { opacity: '1' },
      },
      shimmer: {
        '0%':   { backgroundPosition: '-400px 0' },
        '100%': { backgroundPosition: '400px 0' },
      },
    },
  },
},
```

---

## Density CSS Classes

Apply at route level to propagate density context down the component tree:

```css
/* Shared display route — /meetings/:id */
.density-display {
  --field-value-size: 1.375rem;
  --field-label-size: 0.8125rem;
  --card-padding: 48px 48px;
  --agenda-title-size: 1.25rem;
  --show-controls: none;
}

/* Facilitator route — /meetings/:id/facilitator */
.density-facilitator {
  --field-value-size: 0.9375rem;
  --field-label-size: 0.6875rem;
  --card-padding: 16px 20px;
  --agenda-title-size: 0.875rem;
  --show-controls: flex;
}
```

Components reference `var(--show-controls)` to show/hide control rows without conditional rendering.

---

## Iconography

### Library

**Lucide React** (`lucide-react`) — the sole icon library for this project.

Rationale:
- Single consistent 24px grid across all icons — shapes align without manual adjustment
- MIT licensed, no attribution required
- Fully tree-shakeable — only imported icons are bundled
- Ships as typed React components — no additional wrappers or SVG management needed
- Semantic naming makes intent clear at the callsite (`Lock`, not `icon-094`)

**Rule**: no other icon library, custom SVG, or emoji may substitute for a Lucide icon in the UI. If a required concept has no suitable Lucide icon, add it to the "Pending" section below and discuss before using an alternative.

### Size system

| Context | Size | Stroke width |
|---|---|---|
| Display density — agenda dots | 10px | 2.5 |
| Facilitator density — inline field controls | 15px | 2 |
| Facilitator density — panel/section headers | 16px | 2 |
| Facilitator density — header action strip | 16px | 2 |
| Display density — any visible icon | 20px | 2 |
| Empty states | 32px | 1.5 |

### Colour rules

Icons inherit `currentColor` from their parent text by default. Exceptions:

| Context | Colour |
|---|---|
| Settled/locked indicator | `settled` (`#34d399`) |
| Active/generating indicator | `accent` (`#6c8ef7`) |
| Danger action (dismiss, delete) | `danger` (`#f87171`) |
| Muted / decorative | `text-muted` (`#4a5578`) |
| Drag handle | `text-muted` — always |

### Accessibility rules

- **Decorative icons** (used alongside visible text): `aria-hidden="true"`, no label
- **Icon-only buttons** (facilitator field controls): `aria-label` required, e.g. `aria-label="Lock field"`
- **Status indicators** (agenda dots, lock dot): use a visually hidden `<span>` for screen readers, e.g. `<span className="sr-only">Locked</span>`
- Do not rely on icon colour alone to convey state — always pair with shape change or position

---

### Complete icon vocabulary

#### Navigation and layout

| Icon name | Component | Usage |
|---|---|---|
| `ChevronRight` | navigation | Forward / expand |
| `ChevronLeft` | navigation | Back |
| `ChevronDown` | navigation | Expand dropdown / collapsed section |
| `ChevronUp` | navigation | Collapse section |
| `PanelRightClose` / `PanelRightOpen` | layout | Collapse / expand right sidebar (LLM log, field versions) |
| `Menu` | layout | Mobile nav toggle (if needed) |

#### Meeting management

| Icon name | Component | Usage |
|---|---|---|
| `Calendar` | meeting | Meeting date indicator |
| `Users` | meeting | Participant count / participant list |
| `UserPlus` | meeting | Add participant |
| `Play` | meeting | Start meeting / open active session |
| `Archive` | meeting | Archive / close completed meeting |
| `MoreHorizontal` | meeting | Meeting row actions overflow menu |

#### Candidate and agenda

| Icon name | Component | Usage |
|---|---|---|
| `GripVertical` | agenda | Drag handle for agenda reordering |
| `ListOrdered` | agenda | Agenda panel heading icon |
| `Lightbulb` | candidate | Suggested / new flag indicator |
| `CircleDashed` | agenda item | Status: pending (not yet started) |
| `Circle` | agenda item | Status: drafted (in progress) — filled with accent colour via CSS |
| `CheckCircle2` | agenda item | Status: logged (finalised) — filled with settled colour |
| `ArrowUpToLine` | candidate | Promote to agenda |
| `X` | candidate | Dismiss candidate |
| `Search` | candidate | Search open contexts to link |

#### Decision field states and actions

| Icon name | Component | Usage |
|---|---|---|
| `Lock` | FieldCard | Field is locked / settled — icon is settled colour |
| `LockOpen` | FieldCard | Field is unlocked — icon is text-secondary |
| `RefreshCw` | FieldCard | Regenerate this field |
| `RotateCcw` | FieldCard | Regenerate all unlocked fields (full draft) |
| `Maximize2` | FieldCard | Zoom to field focus view |
| `Minimize2` | FieldFocus | Return from field focus |
| `Pencil` | FieldCard | Manual edit mode |
| `Check` | FieldCard | Confirm manual edit |
| `History` | FieldVersions | View field version history |
| `Undo2` | FieldVersions | Restore a prior field version |
| `MessageSquare` | FieldCard | Expand inline guidance input |
| `Loader2` | generating | Spinner animation during LLM generation (facilitator only) |

#### Transcript and evidence

| Icon name | Component | Usage |
|---|---|---|
| `FileText` | transcript | Transcript source indicator |
| `Highlighter` | segment | Selected / confirmed segment |
| `SplitSquareHorizontal` | segment | Overlap indicator (segments from multiple meetings) |
| `Filter` | transcript | Filter toolbar |
| `TextSearch` | transcript | Text search in reading mode |
| `Layers` | transcript | Multi-meeting source toggle |
| `MousePointerClick` | segment | Drag-to-select instruction (empty state) |

#### Tags and relations

| Icon name | Component | Usage |
|---|---|---|
| `Tag` | TagPill | Tag category icon (generic — used when no category-specific icon is needed) |
| `Hash` | TagPill | topic category |
| `Users2` | TagPill | team category |
| `FolderKanban` | TagPill | project category |
| `Plus` | TagPill | Add tag input trigger |
| `Link2` | RelationsList | Relation indicator — generic |
| `ArrowRight` | RelationsList | Outgoing relation (`supersedes`, `depends_on`, `blocks`) |
| `ArrowLeft` | RelationsList | Incoming relation |
| `ArrowLeftRight` | RelationsList | Bidirectional relation (`related_to`) |
| `Unlink` | RelationsList | Remove relation |

#### Finalisation and export

| Icon name | Component | Usage |
|---|---|---|
| `Gavel` | finalise | Finalise decision button |
| `FileCheck2` | decision log | Logged decision header icon |
| `Download` | export | Export button |
| `FileJson` | export | JSON export format |
| `FileType2` | export | Markdown export format |
| `Copy` | export | Copy to clipboard |

#### LLM and observability (facilitator sidebar)

| Icon name | Component | Usage |
|---|---|---|
| `BrainCircuit` | LLM log | LLM interaction log panel header |
| `Zap` | LLM log | Single LLM call row |
| `Clock` | LLM log | Latency display |
| `AlertTriangle` | LLM log | LLM error or warning |

#### Feedback and system states

| Icon name | Component | Usage |
|---|---|---|
| `Info` | tooltip | Information tooltip trigger |
| `AlertCircle` | error | Error state |
| `CheckCheck` | success | Confirmation of completed action |
| `Ban` | empty state | Dismissed / rejected state |
| `Inbox` | empty state | Empty candidate queue |

---

### Pending (no icon assigned yet)

Items that need a Lucide icon but have not yet been mapped. Do not use a substitute — leave the icon slot empty or use a placeholder until resolved.

| Concept | Notes |
|---|---|
| Template category badges | Considered using emoji initially in the prototype — should use icons instead. May need `Layers2`, `Code2`, `DollarSign`, `Shield`, `ScrollText`, `ThumbsUp` per template category. Confirm per-category mapping before implementing. |

---

### Prohibited patterns

- Do not import from `react-icons`, `heroicons`, `phosphor-icons`, or any other icon library
- Do not use emoji as icons in the UI (they are not accessible and render inconsistently)
- Do not use custom SVG files unless a Lucide icon genuinely does not exist for the concept — document the gap in "Pending" first
- Do not use the same icon for two different semantic meanings (e.g. do not reuse `RefreshCw` for both "regenerate field" and "reload page")
- Do not render an icon without either accompanying text or an `aria-label` — icons must never be the sole communication channel for an action

---

## Layout Wireframes

### Shared Meeting Display (`/meetings/:id`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Q4 Budget Review  ·  14 Mar 2026  ·  Alice, Bob, Carol              │  ← header
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────┐  ┌────────────────────────────────────────────────┐
│  AGENDA          │  │  Cloud Migration Decision                       │
│                  │  │  ● infrastructure  ● Platform Team              │  ← tag pills
│  ◉ Cloud Migr.   │  │                                                 │
│  ○ Hiring Freeze │  │  DECISION STATEMENT                             │
│  ● Office Move   │  │                                                 │
│                  │  │  We will migrate to AWS by Q3, starting with    │
│                  │  │  the data pipeline. GCP and on-premise options   │
│                  │  │  were evaluated and rejected on cost grounds.    │
│                  │  │                                                 │
│                  │  ├╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴┤
│                  │  │░░ OPTIONS CONSIDERED                         ● │  ← locked (green bg)
│                  │  │░                                               │
│                  │  │░ AWS (selected) · GCP · On-premise             │
│                  │  ├─────────────────────────────────────────────────┤
│                  │  │  RISKS                                          │
│                  │  │                                                 │
│                  │  │  ▌░░░░░░░░░░░░░░░░░░░░░░░                      │  ← generating
│                  │  │  ░░░░░░░░░░░░░░                                 │
└──────────────────┘  └────────────────────────────────────────────────┘
```

### Facilitator View (`/meetings/:id/facilitator`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Q4 Budget Review          [ + Flag decision ]  [ Generate draft ]  [ Log ]  │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌──────────────────────────────┐ ┌───────────────┐
│ Suggested  │  Agenda     │ │  Cloud Migration Decision      │ │  LLM Log     │
│────────────┼─────────────│ │  ● infrastructure  ×           │ │  (collapsed) │
│ Approve    │⠿1◉ Cloud   │ │                               │ │              │
│ roof       │⠿2○ Hiring  │ │  DECISION STATEMENT   🔓 ↺ ⤢ │ └───────────────┘
│ repair     │             │ │                               │
│ [Promote]  │             │ │  We will migrate to AWS…      │
│ [Dismiss]  │             │ │                               │
│            │             │ │  [ Add guidance for regen… ]  │
│            │             │ ├───────────────────────────────┤
│            │             │ │░ OPTIONS CONSIDERED   🔒 ↺ ⤢ │  ← locked (green bg)
│            │             │ │░ AWS / GCP / On-premise       │
│            │             │ ├───────────────────────────────┤
│            │             │ │  RISKS                🔓 ↺ ⤢ │
│            │             │ │  ▌ Generating…                │
└──────────────────────────┘ └──────────────────────────────┘
```

---

## Maintenance Rules

- When adding a new component, document it here with: states, display/facilitator density variants, and an ASCII mockup.
- When changing a colour token, update the Tailwind config sketch and all component descriptions that reference it.
- Tag categories are fixed at `topic`, `team`, `project` for M4.10. Adding a new category requires updating the tag colour table and `TagPill` component.
- Icon additions must come from Lucide React only — do not mix icon libraries.
