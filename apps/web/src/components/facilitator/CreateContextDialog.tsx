import { useState } from "react";
import { FilePlus2, X } from "lucide-react";
import type { DecisionTemplate } from "@/api/types";
import type { RelationType } from "@/lib/ui-models";
import { Select } from "@/components/ui/Select";

interface CreateContextDialogProps {
  templates: DecisionTemplate[];
  onConfirm: (
    title: string,
    summary: string,
    template: DecisionTemplate,
    relationType?: RelationType,
  ) => void;
  onCancel: () => void;
  initialTitle?: string;
  initialSummary?: string;
  relationTargetTitle?: string;
  initialRelationType?: RelationType;
}

const CATEGORY_LABELS: Record<string, string> = {
  standard: "Standard",
  technology: "Technology",
  budget: "Budget",
  strategy: "Strategy",
  policy: "Policy",
  proposal: "Proposal",
};

export function CreateContextDialog({
  templates,
  onConfirm,
  onCancel,
  initialTitle = "",
  initialSummary = "",
  relationTargetTitle,
  initialRelationType = "related",
}: CreateContextDialogProps) {
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedTemplate, setSelectedTemplate] = useState<DecisionTemplate | null>(null);
  const [relationType, setRelationType] = useState<RelationType>(initialRelationType);

  const canConfirm = title.trim() && selectedTemplate;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-card shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <FilePlus2 size={16} className="text-accent" />
          <h2 className="text-fac-field text-text-primary font-medium flex-1">
            Create decision context
          </h2>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          {relationTargetTitle && (
            <div className="flex flex-col gap-1.5 rounded-card border border-border bg-overlay/40 p-3">
              <label className="text-fac-label text-text-secondary uppercase tracking-wider">
                Relation to existing decision
              </label>
              <p className="text-fac-meta text-text-primary">
                New context will be linked to:{" "}
                <span className="font-medium">{relationTargetTitle}</span>
              </p>
              <Select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value as RelationType)}
                className="w-full max-w-xs"
              >
                <option value="related">related</option>
                <option value="blocks">blocks</option>
                <option value="blocked_by">blocked_by</option>
                <option value="supersedes">supersedes</option>
                <option value="superseded_by">superseded_by</option>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Decision title <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. API Gateway Technology Selection"
              className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-field text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted"
            />
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-1.5">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Summary
              <span className="ml-2 text-text-muted normal-case tracking-normal font-normal">
                (optional)
              </span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="Brief description of what is being decided…"
              className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary resize-none focus:outline-none focus:border-accent placeholder:text-text-muted"
            />
          </div>

          {/* Template picker */}
          <div className="flex flex-col gap-2">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Template <span className="text-danger">*</span>
            </label>
            <div className="flex flex-col gap-1.5">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`flex items-start gap-3 px-4 py-3 rounded-card border text-left transition-colors ${
                    selectedTemplate?.id === tpl.id
                      ? "border-accent/40 bg-accent-dim/20"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-fac-field font-medium ${selectedTemplate?.id === tpl.id ? "text-text-primary" : "text-text-secondary"}`}
                      >
                        {tpl.name}
                      </span>
                      <span className="text-fac-meta text-text-muted border border-border rounded px-1.5 py-0.5">
                        {CATEGORY_LABELS[tpl.category] ?? tpl.category}
                      </span>
                    </div>
                    <p className="text-fac-meta text-text-muted mt-0.5">{tpl.description}</p>
                  </div>
                </button>
              ))}
            </div>
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
              onConfirm(
                title.trim(),
                summary.trim(),
                selectedTemplate!,
                relationTargetTitle ? relationType : undefined,
              )
            }
            disabled={!canConfirm}
            className="flex items-center gap-1.5 px-4 py-2 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FilePlus2 size={13} />
            Create context
          </button>
        </div>
      </div>
    </div>
  );
}
