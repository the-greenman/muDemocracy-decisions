import { useMemo, useState } from "react";
import { ArrowUpCircle, X } from "lucide-react";
import type { DecisionTemplate } from "@/api/types";
import type { Candidate } from "@/lib/ui-models";

interface PromoteCandidateDialogProps {
  candidate: Candidate;
  agendaTitles: string[];
  templates: DecisionTemplate[];
  onConfirm: (payload: {
    title: string;
    summary: string;
    template: DecisionTemplate;
    insertMode: "append" | "before";
    beforeIndex: number;
  }) => void;
  onCancel: () => void;
}

export function PromoteCandidateDialog({
  candidate,
  agendaTitles,
  templates,
  onConfirm,
  onCancel,
}: PromoteCandidateDialogProps) {
  const [title, setTitle] = useState(candidate.title);
  const [summary, setSummary] = useState(candidate.summary);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [insertMode, setInsertMode] = useState<"append" | "before">("append");
  const [beforeIndex, setBeforeIndex] = useState(1);

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === templateId) ?? templates[0],
    [templateId, templates],
  );

  const canConfirm = Boolean(title.trim() && selectedTemplate);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-card shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <ArrowUpCircle size={16} className="text-accent" />
          <h2 className="text-fac-field text-text-primary font-medium flex-1">Promote candidate</h2>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Title <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-field text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Summary
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary resize-none focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Template <span className="text-danger">*</span>
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Agenda position
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-fac-meta text-text-secondary">
                <input
                  type="radio"
                  checked={insertMode === "append"}
                  onChange={() => setInsertMode("append")}
                />
                Append at end
              </label>
              <label className="flex items-center gap-2 text-fac-meta text-text-secondary">
                <input
                  type="radio"
                  checked={insertMode === "before"}
                  onChange={() => setInsertMode("before")}
                />
                Insert before
              </label>
            </div>

            {insertMode === "before" && (
              <select
                value={beforeIndex}
                onChange={(e) => setBeforeIndex(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
              >
                {agendaTitles.map((titleLabel, idx) => (
                  <option key={`${titleLabel}-${idx}`} value={idx + 1}>
                    {idx + 1}. {titleLabel}
                  </option>
                ))}
              </select>
            )}
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
            onClick={() =>
              canConfirm &&
              selectedTemplate &&
              onConfirm({
                title: title.trim(),
                summary: summary.trim(),
                template: selectedTemplate,
                insertMode,
                beforeIndex,
              })
            }
            disabled={!canConfirm}
            className="flex items-center gap-1.5 px-4 py-2 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpCircle size={13} />
            Promote to agenda
          </button>
        </div>
      </div>
    </div>
  );
}
