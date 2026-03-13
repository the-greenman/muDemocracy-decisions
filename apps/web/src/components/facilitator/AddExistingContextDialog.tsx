import { useMemo, useState } from "react";
import { Link2, X } from "lucide-react";
import type { DecisionContextPickerItem } from "@/api/types";
import { OpenContextPicker } from "@/components/shared/OpenContextPicker";
import { Button } from "@/components/ui/Button";

interface AddExistingContextDialogProps {
  contexts: DecisionContextPickerItem[];
  currentMeeting: { title: string; date: string };
  onConfirm: (context: DecisionContextPickerItem) => void;
  onCancel: () => void;
}

export function AddExistingContextDialog({
  contexts,
  currentMeeting,
  onConfirm,
  onCancel,
}: AddExistingContextDialogProps) {
  const [selectedId, setSelectedId] = useState(contexts[0]?.id ?? "");
  const selected = useMemo(
    () => contexts.find((ctx) => ctx.id === selectedId) ?? null,
    [contexts, selectedId],
  );
  const selectedIsCrossMeeting =
    !!selected &&
    (selected.sourceMeetingDate !== currentMeeting.date ||
      selected.sourceMeetingTitle !== currentMeeting.title);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-card shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Link2 size={16} className="text-accent" />
          <h2 className="text-fac-field text-text-primary font-medium flex-1">
            Add existing context
          </h2>
          <Button onClick={onCancel} variant="ghost" size="sm" className="p-0">
            <X size={16} />
          </Button>
        </div>

        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          <OpenContextPicker
            idPrefix="add-existing-context"
            contexts={contexts}
            currentMeeting={currentMeeting}
            selectionMode="single"
            selectedIds={selectedId ? [selectedId] : []}
            onChange={(next) => setSelectedId(next[0] ?? "")}
          />
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
          <Button onClick={onCancel} variant="ghost">
            Cancel
          </Button>
          <Button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            variant="primary"
          >
            <Link2 size={13} />
            {selectedIsCrossMeeting ? "Link meeting + add context" : "Add to agenda"}
          </Button>
        </div>
      </div>
    </div>
  );
}
