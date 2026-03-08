import { useState, useRef } from 'react';
import { Search, Check, ArrowLeft, Hash, Link as LinkIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// Prototype: 90 rows to simulate a long transcript
const MOCK_ROWS = Array.from({ length: 90 }, (_, i) => {
  const seq = i + 1;
  const speakers = ['Alice Chen', 'Bob Marsh', 'Priya Nair'];
  const speaker = speakers[i % 3]!;
  const snippets = [
    "Let's start with the API gateway decision. We've been running on ad-hoc nginx rules for too long.",
    'I looked at Kong and Traefik last week. Both are solid options.',
    'What about AWS API Gateway? We\'re already in AWS so there\'s less vendor friction.',
    'Cost at scale is a concern. And vendor lock-in is real.',
    'Kong has a great plugin ecosystem. WebSocket support out of the box.',
    'Traefik is more cloud-native. Better Kubernetes integration and the config is declarative.',
    'Do we need the plugin ecosystem right now? Traefik might be simpler to operate day-to-day.',
    'Our team knows Traefik from the staging environment already.',
    'I\'m comfortable with Traefik. Let\'s go with that.',
    'All agreed? Going with Traefik for the API gateway.',
    'We should think about the HA setup. Traefik in active-passive or active-active?',
    'The operational complexity of active-active is probably not worth it for our scale.',
    'Agreed. Active-passive with automatic failover is fine.',
    'What about rate limiting? Do we configure at gateway or service level?',
    'Gateway level is the right boundary. Services shouldn\'t need to know.',
  ];
  return {
    id: `r${seq}`,
    seq,
    speaker,
    text: snippets[i % snippets.length]!,
  };
});

export function TranscriptPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [jumpInput, setJumpInput] = useState('');
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const filtered = MOCK_ROWS.filter(
    (r) =>
      !query ||
      r.text.toLowerCase().includes(query.toLowerCase()) ||
      r.speaker.toLowerCase().includes(query.toLowerCase())
  );

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleJump() {
    const n = parseInt(jumpInput, 10);
    if (!n) return;
    const row = MOCK_ROWS.find((r) => r.seq === n);
    if (!row) return;
    const el = rowRefs.current.get(row.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-accent');
      setTimeout(() => el.classList.remove('ring-2', 'ring-accent'), 1500);
    }
    setJumpInput('');
  }

  function handleConfirm() {
    // Return to facilitator view — in production this persists the selection
    navigate('/meetings/mtg-1/facilitator');
  }

  return (
    <div className="density-facilitator min-h-screen bg-base flex flex-col">

      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          to="/meetings/mtg-1/facilitator"
          className="flex items-center gap-1.5 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
        <div className="w-px h-4 bg-border" />
        <span className="text-fac-field text-text-primary font-medium flex-1">
          Select transcript segments
        </span>
        <span className="text-fac-meta text-text-muted">
          {selected.size} row{selected.size !== 1 ? 's' : ''} selected
        </span>
        <button
          disabled={selected.size === 0}
          onClick={handleConfirm}
          className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta bg-settled text-base rounded font-medium hover:bg-settled/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check size={13} />
          Confirm selection
        </button>
      </header>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-3 shrink-0">
        {/* Text search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search transcript…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-1.5 pl-8 text-fac-field text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Jump to row — G3 */}
        <div className="flex items-center gap-1.5 border border-border rounded overflow-hidden bg-surface">
          <span className="pl-3 text-text-muted flex items-center">
            <Hash size={13} />
          </span>
          <input
            type="number"
            min={1}
            max={MOCK_ROWS.length}
            placeholder="Row…"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
            className="w-16 py-1.5 bg-transparent text-fac-meta text-text-primary focus:outline-none placeholder:text-text-muted"
          />
          <button
            onClick={handleJump}
            disabled={!jumpInput}
            className="px-2.5 py-1.5 text-fac-meta text-text-muted hover:text-accent transition-colors disabled:opacity-30"
            title="Jump to row"
          >
            <LinkIcon size={13} />
          </button>
        </div>

        <span className="text-fac-meta text-text-muted shrink-0">
          {filtered.length} / {MOCK_ROWS.length} rows
        </span>
      </div>

      {/* Transcript rows */}
      <main className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-0.5 max-w-3xl">
          {filtered.map((row) => (
            <TranscriptRow
              key={row.id}
              row={row}
              isSelected={selected.has(row.id)}
              onToggle={() => toggleRow(row.id)}
              rowRef={(el) => {
                if (el) rowRefs.current.set(row.id, el);
                else rowRefs.current.delete(row.id);
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function TranscriptRow({
  row,
  isSelected,
  onToggle,
  rowRef,
}: {
  row: (typeof MOCK_ROWS)[0];
  isSelected: boolean;
  onToggle: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={rowRef}
      onClick={onToggle}
      className={`flex gap-3 px-3 py-2.5 rounded cursor-pointer select-none transition-colors transition-shadow ${
        isSelected
          ? 'bg-accent-dim/40 border border-accent/30'
          : 'hover:bg-surface border border-transparent'
      }`}
    >
      <span className="text-fac-meta text-text-muted w-8 text-right shrink-0 mt-0.5 tabular-nums">
        {row.seq}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-fac-meta text-text-secondary font-medium mr-2">{row.speaker}:</span>
        <span className="text-fac-field text-text-primary">{row.text}</span>
      </div>
    </div>
  );
}
