import { useState } from "react";
import { CheckSquare, X, UserPlus, Trash2 } from "lucide-react";
import type { DecisionMethod } from "@/lib/ui-models";

const DECISION_METHOD_OPTIONS: Array<{ value: DecisionMethod; label: string }> = [
  { value: "unanimous_vote", label: "Unanimous vote" },
  { value: "consensus", label: "Consensus" },
  { value: "majority_vote", label: "Majority vote" },
  { value: "executive", label: "Executive decision" },
  { value: "delegated", label: "Delegated authority" },
];

interface FinaliseDialogProps {
  participants: string[];
  onConfirm: (method: DecisionMethod, actors: string[], loggedBy: string) => void;
  onCancel: () => void;
}

export function FinaliseDialog({ participants, onConfirm, onCancel }: FinaliseDialogProps) {
  const [method, setMethod] = useState<DecisionMethod>("unanimous_vote");
  const [actors, setActors] = useState<string[]>(participants);
  const [loggedBy, setLoggedBy] = useState(participants[0] ?? "");
  const [newActor, setNewActor] = useState("");

  function addActor() {
    const name = newActor.trim();
    if (!name || actors.includes(name)) return;
    setActors((prev) => [...prev, name]);
    setNewActor("");
  }

  function removeActor(name: string) {
    setActors((prev) => prev.filter((a) => a !== name));
    if (loggedBy === name) setLoggedBy("");
  }

  const canConfirm = method && actors.length > 0 && loggedBy.trim();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-card shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <CheckSquare size={16} className="text-settled" />
          <h2 className="text-fac-field text-text-primary font-medium flex-1">Finalise decision</h2>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 flex flex-col gap-5">
          {/* Decision method */}
          <div className="flex flex-col gap-2">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Decision method
            </label>
            <div className="flex flex-col gap-1.5">
              {DECISION_METHOD_OPTIONS.map((m) => (
                <label
                  key={m.value}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border cursor-pointer transition-colors ${method === m.value ? "border-settled/40 bg-settled-dim/20" : "border-border hover:border-border-strong"}`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m.value}
                    checked={method === m.value}
                    onChange={() => setMethod(m.value)}
                    className="accent-settled"
                  />
                  <span
                    className={`text-fac-field ${method === m.value ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    {m.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Actors */}
          <div className="flex flex-col gap-2">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Decision actors
            </label>
            <div className="flex flex-col gap-1">
              {actors.map((actor) => (
                <div
                  key={actor}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-overlay/30"
                >
                  <span className="text-fac-field text-text-primary flex-1">{actor}</span>
                  <button
                    onClick={() => removeActor(actor)}
                    className="text-text-muted hover:text-danger transition-colors"
                    aria-label={`Remove ${actor}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add actor…"
                value={newActor}
                onChange={(e) => setNewActor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addActor()}
                className="flex-1 px-3 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted"
              />
              <button
                onClick={addActor}
                disabled={!newActor.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-fac-meta text-accent border border-accent/30 rounded hover:bg-accent-dim transition-colors disabled:opacity-30"
              >
                <UserPlus size={13} />
                Add
              </button>
            </div>
          </div>

          {/* Logged by */}
          <div className="flex flex-col gap-2">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Logged by
            </label>
            <select
              value={loggedBy}
              onChange={(e) => setLoggedBy(e.target.value)}
              className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-field text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select…</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
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
            onClick={() => canConfirm && onConfirm(method, actors, loggedBy)}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 px-4 py-2 text-fac-meta bg-settled text-base rounded font-medium hover:bg-settled/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckSquare size={13} />
            Log decision
          </button>
        </div>
      </div>
    </div>
  );
}
