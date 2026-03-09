import { useMemo, useState } from 'react';
import { Link2, X } from 'lucide-react';
import type { OpenContextSummary } from '@/lib/mock-data';
import { OpenContextPicker } from '@/components/shared/OpenContextPicker';

interface AddExistingContextDialogProps {
  contexts: OpenContextSummary[];
  currentMeeting: { title: string; date: string };
  onConfirm: (context: OpenContextSummary) => void;
  onCancel: () => void;
}

export function AddExistingContextDialog({
  contexts,
  currentMeeting,
  onConfirm,
  onCancel,
}: AddExistingContextDialogProps) {
  const [selectedId, setSelectedId] = useState(contexts[0]?.id ?? '');
  const selected = useMemo(() => contexts.find((ctx) => ctx.id === selectedId) ?? null, [contexts, selectedId]);
  const selectedIsCrossMeeting =
    !!selected &&
    (selected.sourceMeetingDate !== currentMeeting.date || selected.sourceMeetingTitle !== currentMeeting.title);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-card shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Link2 size={16} className="text-accent" />
          <h2 className="text-fac-field text-text-primary font-medium flex-1">Add existing context</h2>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          <OpenContextPicker
            idPrefix="add-existing-context"
            contexts={contexts}
            currentMeeting={currentMeeting}
            selectionMode="single"
            selectedIds={selectedId ? [selectedId] : []}
            onChange={(next) => setSelectedId(next[0] ?? '')}
          />
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="flex items-center gap-1.5 px-4 py-2 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Link2 size={13} />
            {selectedIsCrossMeeting ? 'Link meeting + add context' : 'Add to agenda'}
          </button>
        </div>
      </div>
    </div>
  );
}
