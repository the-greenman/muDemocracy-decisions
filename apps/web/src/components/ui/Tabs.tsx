import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  compact?: boolean;
}

export function TabButton({ active, onClick, children, compact = false }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "transition-colors",
        compact
          ? "px-2.5 py-1.5 rounded text-fac-meta border"
          : "flex-1 flex items-center justify-center gap-1 px-3 py-2.5 text-fac-meta font-medium border-b-2",
        active
          ? compact
            ? "border-accent/40 text-accent bg-accent-dim/20"
            : "border-accent text-accent"
          : compact
            ? "border-border text-text-muted hover:text-text-primary"
            : "border-transparent text-text-muted hover:text-text-secondary",
      )}
    >
      {children}
    </button>
  );
}
