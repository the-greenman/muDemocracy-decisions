import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "neutral" | "danger" | "success";
}

const TONE_CLASS: Record<NonNullable<IconButtonProps["tone"]>, string> = {
  neutral: "border border-border text-text-muted hover:text-text-primary",
  danger: "border border-danger/30 text-danger hover:bg-danger-dim/30",
  success: "border border-settled/40 text-settled hover:bg-settled/10",
};

export function IconButton({
  tone = "neutral",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center w-8 h-8 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    />
  );
}
