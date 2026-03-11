import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: "sm" | "md";
}

const SIZE_CLASS: Record<NonNullable<InputProps["inputSize"]>, string> = {
  sm: "px-2.5 py-1.5 text-fac-meta",
  md: "px-3 py-2 text-fac-meta",
};

export function Input({ inputSize = "md", className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "rounded border border-border bg-overlay text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent",
        SIZE_CLASS[inputSize],
        className,
      )}
      {...props}
    />
  );
}
