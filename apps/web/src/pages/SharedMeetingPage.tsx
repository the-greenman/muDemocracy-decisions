import { ACTIVE_CONTEXT, AGENDA_ITEMS } from '@/lib/mock-data';
import { FieldCard } from '@/components/shared/FieldCard';
import { AgendaItem } from '@/components/shared/AgendaItem';
import { TagPill } from '@/components/shared/TagPill';

export function SharedMeetingPage() {
  const ctx = ACTIVE_CONTEXT;

  return (
    <div className="density-display min-h-screen bg-base flex">
      {/* Sidebar — agenda */}
      <aside className="w-72 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-fac-title text-text-secondary uppercase tracking-widest text-xs">
            Agenda
          </h2>
        </div>
        <nav className="flex-1 px-2 py-2 overflow-y-auto">
          {AGENDA_ITEMS.map((item, i) => (
            <AgendaItem
              key={item.id}
              title={item.title}
              status={item.status}
              position={i + 1}
              isActive={item.id === ctx.id}
            />
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-border">
          <p className="text-fac-meta text-text-muted">Q4 Architecture Review</p>
          <p className="text-fac-meta text-text-muted">8 March 2026</p>
        </div>
      </aside>

      {/* Main — active decision workspace */}
      <main className="flex-1 min-w-0 px-12 py-10 overflow-y-auto">
        {/* Decision header */}
        <div className="mb-8">
          <h1 className="text-display-title text-text-primary">{ctx.title}</h1>
          <p className="text-display-meta text-text-secondary mt-2 max-w-2xl leading-relaxed">
            {ctx.summary}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {ctx.tags.map((tag) => (
              <TagPill key={tag.id} name={tag.name} category={tag.category} />
            ))}
          </div>
        </div>

        {/* Fields — display density, read-only */}
        <div className="flex flex-col gap-6">
          {ctx.fields.map((field) => (
            <FieldCard key={field.id} field={field} density="display" />
          ))}
        </div>
      </main>
    </div>
  );
}
