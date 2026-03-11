import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Copy, X } from "lucide-react";
import { TEMPLATES, getMockFieldsForTemplate, getTemplateFieldDefinitions } from "@/lib/mock-data";
import type { Field, Template } from "@/lib/mock-data";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface ChangeTemplateDialogProps {
  currentTemplateName: string;
  currentFields: Field[];
  onConfirm: (template: Template, nextFields: Field[]) => void;
  onCancel: () => void;
}

export function ChangeTemplateDialog({
  currentTemplateName,
  currentFields,
  onConfirm,
  onCancel,
}: ChangeTemplateDialogProps) {
  const [templateId, setTemplateId] = useState(
    TEMPLATES.find((template) => template.name === currentTemplateName)?.id ??
      TEMPLATES[0]?.id ??
      "",
  );
  const [targetValues, setTargetValues] = useState<Record<string, string>>({});

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((template) => template.id === templateId) ?? null,
    [templateId],
  );

  const targetLabels = useMemo(() => {
    if (!selectedTemplate) return [];
    return getTemplateFieldDefinitions(selectedTemplate.name).map((field) => field.label);
  }, [selectedTemplate]);

  const unavailableFields = useMemo(
    () => currentFields.filter((field) => !targetLabels.includes(field.label)),
    [currentFields, targetLabels],
  );

  const addedLabels = useMemo(
    () => targetLabels.filter((label) => !currentFields.some((field) => field.label === label)),
    [currentFields, targetLabels],
  );

  useEffect(() => {
    if (!selectedTemplate) return;

    const nextFields = getMockFieldsForTemplate(selectedTemplate.name);
    const seed: Record<string, string> = {};

    nextFields.forEach((field) => {
      const match = currentFields.find((current) => current.label === field.label);
      seed[field.label] = match?.value ?? "";
    });

    setTargetValues(seed);
  }, [currentFields, selectedTemplate]);

  function updateTargetValue(label: string, value: string) {
    setTargetValues((prev) => ({ ...prev, [label]: value }));
  }

  function handleCopy(value: string) {
    void navigator.clipboard?.writeText(value);
  }

  function handleConfirm() {
    if (!selectedTemplate) return;

    const nextFields = getMockFieldsForTemplate(selectedTemplate.name).map((field) => ({
      ...field,
      value: targetValues[field.label] ?? "",
    }));

    onConfirm(selectedTemplate, nextFields);
  }

  const canConfirm = !!selectedTemplate;

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
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="max-w-sm"
            >
              {TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-card border border-danger/25 bg-danger-dim/10 p-3">
              <h3 className="text-fac-field text-text-primary font-medium">
                Fields becoming unavailable
              </h3>
              <p className="text-fac-meta text-text-muted mt-1">
                These fields do not exist in the selected template. Copy text you want to preserve.
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
              <h3 className="text-fac-field text-text-primary font-medium">Destination fields</h3>
              <p className="text-fac-meta text-text-muted mt-1">
                Paste or edit values below before applying template change.
              </p>
              {addedLabels.length > 0 && (
                <p className="mt-2 text-fac-meta text-caution">
                  New fields in this template: {addedLabels.join(", ")}
                </p>
              )}
              <div className="mt-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
                {targetLabels.map((label) => (
                  <article key={label} className="rounded border border-border bg-overlay/40 p-2.5">
                    <p className="text-fac-meta text-text-primary font-medium">{label}</p>
                    <textarea
                      value={targetValues[label] ?? ""}
                      onChange={(e) => updateTargetValue(label, e.target.value)}
                      rows={3}
                      className="mt-2 w-full p-2 rounded border border-border bg-surface text-fac-meta text-text-primary resize-y focus:outline-none focus:border-accent"
                    />
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
          <Button onClick={onCancel} variant="ghost">
            Cancel
          </Button>
          <Button onClick={handleConfirm} variant="primary" disabled={!canConfirm}>
            Apply template change
          </Button>
        </div>
      </div>
    </div>
  );
}
