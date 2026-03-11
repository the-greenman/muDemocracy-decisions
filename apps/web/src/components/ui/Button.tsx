import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline-accent";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90",
  secondary: "border border-border text-text-muted hover:text-text-primary hover:bg-overlay",
  ghost: "text-text-muted hover:text-text-primary",
  danger: "border border-danger/30 text-danger hover:bg-danger-dim/30",
  "outline-accent": "border border-accent/30 text-accent hover:bg-accent-dim",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-fac-meta",
  md: "px-4 py-2 text-fac-meta",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    />
  );
}
