import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  selectSize?: "sm" | "md";
}

const SIZE_CLASS: Record<NonNullable<SelectProps["selectSize"]>, string> = {
  sm: "px-2 py-1.5 text-fac-meta",
  md: "px-2.5 py-1.5 text-fac-meta",
};

export function Select({ selectSize = "md", className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "rounded border border-border bg-overlay text-text-primary focus:outline-none focus:border-accent",
        SIZE_CLASS[selectSize],
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
