import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PanelProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  right?: ReactNode;
}

export function Panel({ title, right, className, children, ...props }: PanelProps) {
  return (
    <section
      className={cn("rounded-card border border-border bg-surface p-4", className)}
      {...props}
    >
      {(title || right) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title ? (
            <h2 className="text-fac-field text-text-primary font-medium">{title}</h2>
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
