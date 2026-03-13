import { Lock, Loader2 } from "lucide-react";
import type { Field } from "@/lib/ui-models";

interface FieldCardProps {
  field: Field;
  density?: "display" | "facilitator";
}

export function FieldCard({ field, density = "display" }: FieldCardProps) {
  const isDisplay = density === "display";

  const containerClass = isDisplay
    ? "rounded-card border p-12 gap-4"
    : "rounded-card border p-4 gap-2";

  const labelClass = isDisplay
    ? "text-display-label text-text-secondary uppercase tracking-widest"
    : "text-fac-label text-text-secondary uppercase tracking-wider";

  const valueClass = isDisplay
    ? "text-display-field text-text-primary leading-relaxed"
    : "text-fac-field text-text-primary leading-relaxed";

  const statusBorder: Record<Field["status"], string> = {
    idle: "border-border bg-surface",
    generating: "border-caution/40 bg-caution-dim/30",
    locked: "border-border-locked bg-settled-dim/20",
    editing: "border-accent/40 bg-accent-dim/20",
  };

  return (
    <div className={`flex flex-col ${containerClass} ${statusBorder[field.status]}`}>
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <span className={labelClass}>{field.label}</span>
        <FieldStatusIcon status={field.status} />
      </div>

      {/* Instructions — display density only */}
      {isDisplay && field.instructions && (
        <p className="text-display-meta text-text-muted leading-snug">{field.instructions}</p>
      )}

      {/* Value */}
      {field.status === "generating" ? (
        <GeneratingPlaceholder isDisplay={isDisplay} />
      ) : field.value ? (
        <p className={valueClass}>{field.value}</p>
      ) : (
        <p className={`${valueClass} text-text-muted italic`}>Not yet generated</p>
      )}
    </div>
  );
}

function FieldStatusIcon({ status }: { status: Field["status"] }) {
  if (status === "locked") {
    return <Lock size={16} className="text-settled shrink-0" />;
  }
  if (status === "generating") {
    return <Loader2 size={16} className="text-caution shrink-0 animate-spin" />;
  }
  return null;
}

function GeneratingPlaceholder({ isDisplay }: { isDisplay: boolean }) {
  return (
    <div className={`flex flex-col gap-2 ${isDisplay ? "mt-2" : ""}`}>
      <div className="h-4 bg-caution/10 rounded animate-pulse-slow w-full" />
      <div className="h-4 bg-caution/10 rounded animate-pulse-slow w-4/5" />
      <div className="h-4 bg-caution/10 rounded animate-pulse-slow w-2/3" />
    </div>
  );
}
