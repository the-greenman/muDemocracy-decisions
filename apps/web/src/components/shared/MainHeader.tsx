import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type HeaderTone = "active" | "completed" | "neutral";

export interface MainHeaderNavItem {
  label: string;
  to?: string;
  icon?: ReactNode;
}

interface MainHeaderProps {
  navItems?: MainHeaderNavItem[];
  title: string;
  titleTo?: string;
  subtitle?: string;
  meta?: ReactNode;
  status?: {
    label: string;
    tone?: HeaderTone;
  };
  actions?: ReactNode;
  className?: string;
}

function statusToneClass(tone: HeaderTone): string {
  if (tone === "active") {
    return "bg-accent-dim text-accent border-accent/30";
  }
  if (tone === "completed") {
    return "bg-overlay text-text-muted border-border";
  }
  return "bg-surface text-text-secondary border-border";
}

export function MainHeader({
  navItems = [],
  title,
  titleTo,
  subtitle,
  meta,
  status,
  actions,
  className = "px-6 py-4",
}: MainHeaderProps) {
  return (
    <header className={`border-b border-border ${className}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[280px]">
          {navItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {navItems.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                  {item.to ? (
                    <Link
                      to={item.to}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border text-fac-meta text-text-muted hover:text-text-primary transition-colors"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-fac-meta text-text-secondary">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                  )}
                  {index < navItems.length - 1 && (
                    <span className="text-fac-meta text-text-muted">/</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {titleTo ? (
              <Link
                to={titleTo}
                className="text-fac-title text-text-primary truncate hover:text-accent transition-colors"
              >
                {title}
              </Link>
            ) : (
              <h1 className="text-fac-title text-text-primary truncate">{title}</h1>
            )}
            {status && (
              <span
                className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-badge text-[11px] border font-medium ${statusToneClass(status.tone ?? "neutral")}`}
              >
                {status.label}
              </span>
            )}
          </div>

          {(subtitle || meta) && (
            <div className="text-fac-meta text-text-secondary mt-0.5 flex flex-wrap items-center gap-1.5">
              {subtitle && <span>{subtitle}</span>}
              {subtitle && meta && <span>·</span>}
              {meta}
            </div>
          )}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
