import { CheckCircle2, Circle, Clock, PlayCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AgendaItemStatus } from "@/lib/ui-models";

interface AgendaItemProps {
  title: string;
  status: AgendaItemStatus;
  position: number;
  isActive?: boolean;
  onClick?: () => void;
  actions?: React.ReactNode;
}

const STATUS_ICON: Record<AgendaItemStatus, React.ReactNode> = {
  pending: <Circle size={18} className="text-text-muted shrink-0" />,
  active: <PlayCircle size={18} className="text-accent shrink-0" />,
  drafted: <Clock size={18} className="text-caution shrink-0" />,
  logged: <CheckCircle2 size={18} className="text-settled shrink-0" />,
  deferred: <Clock size={18} className="text-text-muted shrink-0" />,
};

export function AgendaItem({
  title,
  status,
  position,
  isActive,
  onClick,
  actions,
}: AgendaItemProps) {
  const interactive = !!onClick;

  const rowClass = cn(
    "flex items-center gap-3 px-4 py-3 rounded-card border transition-colors",
    isActive ? "border-accent/40 bg-accent-dim/30" : "border-transparent hover:border-border",
    interactive ? "cursor-pointer" : "",
  );

  const content = (
    <>
      <span className="text-text-muted text-fac-meta w-5 text-right shrink-0">{position}</span>
      {STATUS_ICON[status]}
      <span
        className={`text-fac-field flex-1 min-w-0 truncate ${
          isActive ? "text-text-primary font-medium" : "text-text-secondary"
        }`}
      >
        {title}
      </span>
    </>
  );

  return (
    <div className={rowClass}>
      {interactive ? (
        <button onClick={onClick} className="flex items-center gap-3 min-w-0 flex-1 text-left">
          {content}
        </button>
      ) : (
        content
      )}
      {actions && <div className="shrink-0 flex items-center gap-1">{actions}</div>}
    </div>
  );
}
