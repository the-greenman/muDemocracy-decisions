import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Download, AlertCircle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import {
  getDecisionLog,
  getDecisionContext,
  getTemplateFields,
  listTemplateExportTemplates,
  exportMarkdown,
} from "@/api/endpoints";
import { formatFieldName } from "@/api/adapters";
import type { DecisionLog, DecisionField, DecisionContext, ExportTemplate } from "@/api/types";
import { MainHeader } from "@/components/shared/MainHeader";

interface DisplayField {
  id: string;
  label: string;
  value: string;
}

export function LoggedDecisionPage() {
  const { id } = useParams<{ id: string }>();
  const [log, setLog] = useState<DecisionLog | null>(null);
  const [context, setContext] = useState<DecisionContext | null>(null);
  const [templateFields, setTemplateFields] = useState<DecisionField[]>([]);
  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [selectedExportTemplateId, setSelectedExportTemplateId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const logData = await getDecisionLog(id);
      setLog(logData);
      const contextData = await getDecisionContext(logData.decisionContextId);
      setContext(contextData);
      // Load template fields to resolve UUIDs → labels
      const { fields } = await getTemplateFields(logData.templateId);
      setTemplateFields(fields);
      const { exportTemplates: availableExportTemplates } = await listTemplateExportTemplates(logData.templateId);
      setExportTemplates(availableExportTemplates);
      const defaultTemplate = availableExportTemplates.find((template) => template.isDefault) ?? availableExportTemplates[0];
      setSelectedExportTemplateId(defaultTemplate?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decision");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Build ordered display fields from log.fields (keyed by UUID) + template field order
  const displayFields: DisplayField[] = (() => {
    if (!log) return [];
    const fieldMap = new Map(templateFields.map((f) => [f.id, f]));
    // Use template order, then fall back to any remaining log.fields keys
    const ordered: DisplayField[] = templateFields
      .map((f) => {
        const value = (log.fields as Record<string, string>)[f.id] ?? "";
        if (!value) return null;
        return { id: f.id, label: formatFieldName(f.name), value };
      })
      .filter((item): item is DisplayField => item !== null);
    // Include any log field keys not in the template (shouldn't happen normally)
    Object.entries(log.fields as Record<string, string>).forEach(([key, value]) => {
      if (!fieldMap.has(key) && value) {
        ordered.push({ id: key, label: formatFieldName(key), value });
      }
    });
    return ordered;
  })();

  async function handleExport() {
    if (!id || !context) return;
    setExporting(true);
    try {
      const { markdown } = await exportMarkdown(context.id, {
        ...(selectedExportTemplateId ? { exportTemplateId: selectedExportTemplateId } : {}),
      });
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `decision-${id.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setExporting(false);
    }
  }

  const formattedDate = log?.loggedAt
    ? new Date(log.loggedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";
  const displayTitle = context?.title?.trim() || "Untitled Decision";
  const meetingHomePath = context ? `/meetings/${context.meetingId}/facilitator/home` : null;

  return (
    <div className="density-display min-h-screen bg-base">
      <MainHeader
        title={displayTitle}
        subtitle="Logged decision"
        status={{ label: "Logged", tone: "completed" }}
        navItems={[
          { label: "Landing page", to: "/", icon: <Home size={13} /> },
          ...(meetingHomePath
            ? [{ label: "Back to meeting", to: meetingHomePath, icon: <ArrowLeft size={13} /> }]
            : []),
        ]}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={selectedExportTemplateId}
              onChange={(event) => setSelectedExportTemplateId(event.target.value)}
              disabled={exporting || exportTemplates.length === 0}
              className="px-3 py-2 text-fac-meta text-text-primary border border-border rounded bg-base disabled:opacity-50"
            >
              {exportTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => void handleExport()}
              disabled={exporting || !context}
              className="flex items-center gap-2 px-3 py-2 text-fac-meta text-text-muted border border-border rounded hover:border-border-strong hover:text-text-primary transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              {exporting ? "Exporting…" : "Export"}
            </button>
          </div>
        }
      />
      <main className="max-w-4xl mx-auto px-8 py-10">
        {error && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-card border border-danger/30 bg-danger-dim text-danger text-fac-meta">
            <AlertCircle size={15} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => void load()}
              className="flex items-center gap-1.5 text-fac-meta hover:underline"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-6">
            <div className="h-12 rounded bg-surface animate-pulse-slow w-1/2" />
            <div className="h-5 rounded bg-surface animate-pulse-slow w-3/4" />
            <div className="h-40 rounded-card bg-surface animate-pulse-slow" />
            <div className="h-40 rounded-card bg-surface animate-pulse-slow" />
          </div>
        ) : log ? (
          <>
            <div className="mb-4">
              <p className="text-fac-meta text-text-muted">{log.id}</p>
            </div>

            {/* Meta bar */}
            <div className="flex items-center gap-6 px-5 py-3 rounded-card border border-border bg-surface mb-8 text-fac-meta">
              <MetaItem label="Method" value={log.decisionMethod.type} />
              <MetaItem label="Logged by" value={log.loggedBy} />
              <MetaItem label="Date" value={formattedDate} />
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-6 mb-8">
              {displayFields.map((field) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-3 p-8 rounded-card border border-border-locked bg-settled-dim/10"
                >
                  <p className="text-display-label text-text-secondary uppercase tracking-widest">
                    {field.label}
                  </p>
                  <p className="text-display-field text-text-primary leading-relaxed">
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-muted text-[11px] uppercase tracking-wider">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}
