import { Lock, Unlock, RefreshCw, Maximize2, Paperclip } from "lucide-react";
import { FieldCard } from "@/components/shared/FieldCard";
import type { Field } from "@/lib/ui-models";

interface FacilitatorFieldCardProps {
  field: Field;
  supplementaryCount?: number;
  onLock?: (fieldId: string) => void;
  onUnlock?: (fieldId: string) => void;
  onRegenerate?: (fieldId: string) => void;
  onZoom?: (fieldId: string) => void;
}

export function FacilitatorFieldCard({
  field,
  supplementaryCount = 0,
  onLock,
  onUnlock,
  onRegenerate,
  onZoom,
}: FacilitatorFieldCardProps) {
  return (
    <div className="flex flex-col gap-0">
      <FieldCard field={field} density="facilitator" />

      {/* Control strip */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-x border-b border-border rounded-b-card bg-surface/50">
        {field.status === "locked" ? (
          <IconButton
            icon={<Unlock size={14} />}
            label="Unlock field"
            onClick={() => onUnlock?.(field.id)}
            className="text-text-muted hover:text-caution"
          />
        ) : (
          <IconButton
            icon={<Lock size={14} />}
            label="Lock field"
            onClick={() => onLock?.(field.id)}
            className="text-text-muted hover:text-settled"
            disabled={!field.value || field.status === "generating"}
          />
        )}
        <IconButton
          icon={<RefreshCw size={14} />}
          label="Regenerate field"
          onClick={() => onRegenerate?.(field.id)}
          className="text-text-muted hover:text-accent"
          disabled={field.status === "locked" || field.status === "generating"}
        />
        <IconButton
          icon={<Maximize2 size={14} />}
          label="Zoom into field"
          onClick={() => onZoom?.(field.id)}
          className="text-text-muted hover:text-text-primary"
          disabled={!onZoom}
        />

        {/* Supplementary content indicator */}
        {supplementaryCount > 0 && (
          <span
            className="flex items-center gap-1 ml-1 text-fac-meta text-accent/70"
            title={`${supplementaryCount} supplementary item${supplementaryCount !== 1 ? "s" : ""}`}
          >
            <Paperclip size={12} />
            {supplementaryCount}
          </span>
        )}
      </div>
    </div>
  );
}

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

function IconButton({ icon, label, onClick, className = "", disabled }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
    >
      {icon}
    </button>
  );
}
