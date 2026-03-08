import { Link } from 'react-router-dom';
import { Monitor, Laptop, FileText, List, CheckSquare, Package } from 'lucide-react';
import { FieldCard } from '@/components/shared/FieldCard';
import { AgendaItem } from '@/components/shared/AgendaItem';
import { TagPill } from '@/components/shared/TagPill';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FacilitatorFieldCard } from '@/components/facilitator/FacilitatorFieldCard';
import { CandidateCard } from '@/components/facilitator/CandidateCard';
import { UploadTranscript } from '@/components/facilitator/UploadTranscript';
import { ACTIVE_CONTEXT, CANDIDATES, SUPPLEMENTARY_ITEMS } from '@/lib/mock-data';

export function PrototypeGallery() {
  return (
    <div className="density-facilitator min-h-screen bg-base">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Package size={18} className="text-accent" />
          <h1 className="text-fac-title text-text-primary">Component Gallery</h1>
          <span className="text-fac-meta text-text-muted ml-auto">prototype / dev only</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-12">

        {/* ── Flow 1 walkthrough ───────────────────────────────── */}
        <Section title="Flow 1 — Offline transcript, known decision" icon={null}>
          <div className="text-fac-meta text-text-secondary flex flex-col gap-1 mb-4">
            <p>Walk the full Flow 1 UX workflow step by step:</p>
          </div>
          <ol className="flex flex-col gap-2 text-fac-meta">
            <FlowStep n={1} label="Create meeting" to="/" note="New meeting form → add participants" />
            <FlowStep n={2} label="Upload transcript" to="/meetings/mtg-1/facilitator" note="Header → Upload transcript button" />
            <FlowStep n={3} label="Review AI candidates" to="/meetings/mtg-1/facilitator" note="Suggested tab — dismiss noise" />
            <FlowStep n={4} label="Create manual context (G2)" to="/meetings/mtg-1/facilitator" note="Header → New decision button → template picker" />
            <FlowStep n={5} label="Select transcript segments (G3)" to="/meetings/mtg-1/facilitator/transcript" note="Row jump + drag-select" />
            <FlowStep n={6} label="Generate draft" to="/meetings/mtg-1/facilitator" note="Header → Regenerate" />
            <FlowStep n={7} label="Shared display (projected)" to="/meetings/mtg-1" note="Projection view — read-only" />
            <FlowStep n={8} label="Zoom into field + add evidence (G4)" to="/meetings/mtg-1/facilitator" note="Click zoom icon on Options field" />
            <FlowStep n={9} label="Regenerate with focus (G5 resolved)" to="/meetings/mtg-1/facilitator" note="Regenerate dialog → focus note" />
            <FlowStep n={10} label="Finalise — unanimous vote" to="/meetings/mtg-1/facilitator" note="Finalise button → method + actors" />
            <FlowStep n={11} label="Export" to="/decisions/dec-1" note="Logged decision view" />
          </ol>
        </Section>

        {/* ── Pages ───────────────────────────────────────────────── */}
        <Section title="Pages" icon={<Monitor size={16} />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <PageLink to="/" label="Meeting List" icon={<List size={14} />} />
            <PageLink to="/meetings/mtg-1" label="Shared Display" icon={<Monitor size={14} />} note="projection" />
            <PageLink to="/meetings/mtg-1/facilitator" label="Facilitator View" icon={<Laptop size={14} />} />
            <PageLink to="/meetings/mtg-1/facilitator/transcript" label="Transcript Selection" icon={<FileText size={14} />} />
            <PageLink to="/decisions/dec-1" label="Logged Decision" icon={<CheckSquare size={14} />} />
          </div>
        </Section>

        {/* ── UploadTranscript ─────────────────────────────────────── */}
        <Section title="UploadTranscript (G1)" icon={null}>
          <div className="max-w-md">
            <UploadTranscript onComplete={() => {}} onCancel={() => {}} />
          </div>
        </Section>

        {/* ── TagPill ──────────────────────────────────────────────── */}
        <Section title="TagPill" icon={null}>
          <div className="flex flex-wrap gap-2">
            <TagPill name="platform" category="topic" />
            <TagPill name="engineering" category="team" />
            <TagPill name="Q4-Infra" category="project" />
            <TagPill name="security" category="topic" />
            <TagPill name="finance" category="team" />
            <TagPill name="roadmap-2026" category="project" />
          </div>
        </Section>

        {/* ── StatusBadge ─────────────────────────────────────────── */}
        <Section title="StatusBadge" icon={null}>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="pending" />
            <StatusBadge status="active" />
            <StatusBadge status="drafted" />
            <StatusBadge status="logged" />
          </div>
        </Section>

        {/* ── AgendaItem ──────────────────────────────────────────── */}
        <Section title="AgendaItem" icon={null}>
          <div className="flex flex-col max-w-sm border border-border rounded-card overflow-hidden">
            <AgendaItem title="Logging Infrastructure Upgrade" status="logged" position={1} />
            <AgendaItem title="API Gateway Technology Selection" status="active" position={2} isActive />
            <AgendaItem title="Service Mesh Adoption Decision" status="drafted" position={3} />
            <AgendaItem title="On-call Rotation Policy Change" status="pending" position={4} />
          </div>
        </Section>

        {/* ── FieldCard — display density ─────────────────────────── */}
        <Section title="FieldCard — display density" icon={<Monitor size={14} />}>
          <div className="flex flex-col gap-4">
            <FieldCard field={ACTIVE_CONTEXT.fields[0]!} density="display" />
            <FieldCard field={{ ...ACTIVE_CONTEXT.fields[2]!, status: 'generating' }} density="display" />
            <FieldCard field={ACTIVE_CONTEXT.fields[3]!} density="display" />
          </div>
        </Section>

        {/* ── FacilitatorFieldCard ─────────────────────────────────── */}
        <Section title="FacilitatorFieldCard — with zoom, lock, supplementary indicator" icon={<Laptop size={14} />}>
          <div className="flex flex-col gap-3 max-w-xl">
            <FacilitatorFieldCard
              field={ACTIVE_CONTEXT.fields[0]!}
              supplementaryCount={0}
            />
            <FacilitatorFieldCard
              field={ACTIVE_CONTEXT.fields[2]!}
              supplementaryCount={SUPPLEMENTARY_ITEMS.filter((s) => s.fieldId === 'f3').length}
            />
            <FacilitatorFieldCard
              field={{ ...ACTIVE_CONTEXT.fields[4]!, guidance: 'emphasise HA complexity' }}
              supplementaryCount={0}
            />
          </div>
        </Section>

        {/* ── CandidateCard ────────────────────────────────────────── */}
        <Section title="CandidateCard" icon={null}>
          <div className="flex flex-col gap-3 max-w-md">
            {CANDIDATES.map((c) => (
              <CandidateCard key={c.id} candidate={c} />
            ))}
          </div>
        </Section>

        {/* ── Colour tokens ────────────────────────────────────────── */}
        <Section title="Colour tokens" icon={null}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {COLOR_TOKENS.map(({ name, cls }) => (
              <div key={name} className="flex flex-col gap-1">
                <div className={`h-10 rounded border border-border/50 ${cls}`} />
                <span className="text-[11px] text-text-muted">{name}</span>
              </div>
            ))}
          </div>
        </Section>

      </main>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
        {icon && <span className="text-text-muted">{icon}</span>}
        <h2 className="text-fac-label text-text-secondary uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function PageLink({
  to,
  label,
  icon,
  note,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-4 py-3 rounded-card border border-border bg-surface hover:border-accent/50 hover:bg-accent-dim/20 transition-colors"
    >
      <span className="text-accent">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-fac-field text-text-primary truncate">{label}</p>
        {note && <p className="text-fac-meta text-text-muted">{note}</p>}
      </div>
    </Link>
  );
}

function FlowStep({ n, label, to, note }: { n: number; label: string; to: string; note: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-5 h-5 rounded-full bg-surface border border-border text-[11px] text-text-muted flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <Link to={to} className="text-accent hover:underline font-medium">
          {label}
        </Link>
        <span className="text-text-muted ml-2">— {note}</span>
      </div>
    </li>
  );
}

const COLOR_TOKENS = [
  { name: 'base', cls: 'bg-base' },
  { name: 'surface', cls: 'bg-surface' },
  { name: 'surface-2', cls: 'bg-surface-2' },
  { name: 'overlay', cls: 'bg-overlay' },
  { name: 'border', cls: 'bg-border' },
  { name: 'accent', cls: 'bg-accent' },
  { name: 'settled', cls: 'bg-settled' },
  { name: 'caution', cls: 'bg-caution' },
  { name: 'danger', cls: 'bg-danger' },
  { name: 'tag-topic', cls: 'bg-tag-topic' },
  { name: 'tag-team', cls: 'bg-tag-team' },
  { name: 'tag-project', cls: 'bg-tag-project' },
];
