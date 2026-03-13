import type { AgendaItemStatus } from "@/lib/ui-models";

interface StatusBadgeProps {
  status: AgendaItemStatus;
}

const STATUS_CONFIG: Record<AgendaItemStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-surface text-text-secondary border-border" },
  active: { label: "In Progress", className: "bg-accent-dim text-accent border-accent/30" },
  drafted: { label: "Drafted", className: "bg-caution-dim text-caution border-caution/30" },
  logged: { label: "Logged", className: "bg-settled-dim text-settled border-settled/30" },
  deferred: { label: "Deferred", className: "bg-overlay text-text-muted border-border" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-badge text-fac-meta border font-medium ${className}`}
    >
      {label}
    </span>
  );
}
