import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function AccordionSection({
  title,
  subtitle,
  defaultOpen = false,
  right,
  className,
  children,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("rounded-card border border-border bg-overlay/30", className)}>
      <button
        onClick={() => setOpen((value) => !value)}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-text-muted" />
        ) : (
          <ChevronRight size={14} className="text-text-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-fac-field text-text-primary font-medium truncate">{title}</p>
          {subtitle && <p className="text-fac-meta text-text-muted mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}
