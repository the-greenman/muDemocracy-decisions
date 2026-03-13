import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Copy, X } from "lucide-react";
import type { DecisionTemplate, DecisionField } from "@/api/types";
import { getTemplateFields } from "@/api/endpoints";
import { formatFieldName } from "@/api/adapters";
import type { Field } from "@/lib/ui-models";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface ChangeTemplateDialogProps {
  templates: DecisionTemplate[];
  currentTemplateId: string | null;
  currentFields: Field[];
  onConfirm: (templateId: string, fieldValues: Record<string, string>) => void;
  onCancel: () => void;
}

export function ChangeTemplateDialog({
  templates,
  currentTemplateId,
  currentFields,
  onConfirm,
  onCancel,
}: ChangeTemplateDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    currentTemplateId ?? templates[0]?.id ?? "",
  );
  const [targetFields, setTargetFields] = useState<DecisionField[]>([]);
  const [targetValues, setTargetValues] = useState<Record<string, string>>({});
  const [loadingFields, setLoadingFields] = useState(false);

  // Load fields for the selected template
  useEffect(() => {
    if (!selectedTemplateId) return;
    setLoadingFields(true);
    getTemplateFields(selectedTemplateId)
      .then(({ fields }) => {
        setTargetFields(fields);
        // Carry over values by matching field name → label
        const next: Record<string, string> = {};
        for (const f of fields) {
          const label = formatFieldName(f.name);
          const match = currentFields.find((c) => c.label === label);
          next[f.id] = match?.value ?? "";
        }
        setTargetValues(next);
      })
      .catch(() => setTargetFields([]))
      .finally(() => setLoadingFields(false));
  }, [selectedTemplateId, currentFields]);

  const unavailableFields = useMemo(() => {
    const targetLabels = new Set(targetFields.map((f) => formatFieldName(f.name)));
    return currentFields.filter((f) => !targetLabels.has(f.label));
  }, [currentFields, targetFields]);

  const addedLabels = useMemo(() => {
    const currentLabels = new Set(currentFields.map((f) => f.label));
    return targetFields
      .map((f) => formatFieldName(f.name))
      .filter((label) => !currentLabels.has(label));
  }, [currentFields, targetFields]);

  function updateTargetValue(fieldId: string, value: string) {
    setTargetValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function handleCopy(value: string) {
    void navigator.clipboard?.writeText(value);
  }

  function handleConfirm() {
    if (!selectedTemplateId) return;
    onConfirm(selectedTemplateId, targetValues);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-surface border border-border rounded-card shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <ArrowRightLeft size={16} className="text-accent" />
          <h2 className="text-fac-field text-text-primary font-medium flex-1">
            Change decision template
          </h2>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              New template
            </label>
            <Select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="max-w-sm"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          </div>

          {loadingFields ? (
            <p className="text-fac-meta text-text-muted italic">Loading fields…</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="rounded-card border border-danger/25 bg-danger-dim/10 p-3">
                <h3 className="text-fac-field text-text-primary font-medium">
                  Fields becoming unavailable
                </h3>
                <p className="text-fac-meta text-text-muted mt-1">
                  These fields do not exist in the selected template. Copy text you want to
                  preserve.
                </p>
                <div className="mt-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {unavailableFields.length === 0 && (
                    <p className="text-fac-meta text-text-muted italic">
                      No fields are being removed.
                    </p>
                  )}
                  {unavailableFields.map((field) => (
                    <article
                      key={field.id}
                      className="rounded border border-border bg-overlay/50 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-fac-meta text-text-primary font-medium">{field.label}</p>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCopy(field.value)}
                          className="px-2 py-1"
                        >
                          <Copy size={12} />
                          Copy
                        </Button>
                      </div>
                      <textarea
                        value={field.value}
                        readOnly
                        rows={3}
                        className="mt-2 w-full p-2 rounded border border-border bg-surface text-fac-meta text-text-secondary resize-y"
                      />
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-card border border-border bg-overlay/20 p-3">
                <h3 className="text-fac-field text-text-primary font-medium">
                  Destination fields
                </h3>
                <p className="text-fac-meta text-text-muted mt-1">
                  Paste or edit values below before applying template change.
                </p>
                {addedLabels.length > 0 && (
                  <p className="mt-2 text-fac-meta text-caution">
                    New fields in this template: {addedLabels.join(", ")}
                  </p>
                )}
                <div className="mt-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {targetFields.map((field) => (
                    <article
                      key={field.id}
                      className="rounded border border-border bg-overlay/40 p-2.5"
                    >
                      <p className="text-fac-meta text-text-primary font-medium">
                        {formatFieldName(field.name)}
                      </p>
                      <textarea
                        value={targetValues[field.id] ?? ""}
                        onChange={(e) => updateTargetValue(field.id, e.target.value)}
                        rows={3}
                        className="mt-2 w-full p-2 rounded border border-border bg-surface text-fac-meta text-text-primary resize-y focus:outline-none focus:border-accent"
                      />
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
          <Button onClick={onCancel} variant="ghost">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="primary"
            disabled={!selectedTemplateId || loadingFields}
          >
            Apply template change
          </Button>
        </div>
      </div>
    </div>
  );
}
