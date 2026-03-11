import { useState } from "react";
import { RefreshCw, X } from "lucide-react";

interface RegenerateDialogProps {
  unlockedCount: number;
  onConfirm: (focus: string) => void;
  onCancel: () => void;
}

export function RegenerateDialog({ unlockedCount, onConfirm, onCancel }: RegenerateDialogProps) {
  const [focus, setFocus] = useState("");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface border border-border rounded-card shadow-xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <RefreshCw size={16} className="text-accent" />
          <h2 className="text-fac-field text-text-primary font-medium flex-1">
            Regenerate all unlocked fields
          </h2>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-fac-meta text-text-secondary">
            {unlockedCount} unlocked field{unlockedCount !== 1 ? "s" : ""} will be regenerated using
            all tagged transcript segments and supplementary content.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Focus for this pass
              <span className="ml-2 text-text-muted normal-case tracking-normal font-normal">
                (optional)
              </span>
            </label>
            <textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              rows={3}
              className="w-full p-3 rounded border border-border bg-overlay text-fac-meta text-text-primary resize-none focus:outline-none focus:border-accent placeholder:text-text-muted"
              placeholder='e.g. "emphasise operational complexity and HA considerations"'
              autoFocus
            />
            <p className="text-fac-meta text-text-muted">
              This instruction applies across all unlocked fields for this regeneration only — it is
              not saved.
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(focus)}
            className="flex items-center gap-1.5 px-4 py-2 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors"
          >
            <RefreshCw size={13} />
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}
