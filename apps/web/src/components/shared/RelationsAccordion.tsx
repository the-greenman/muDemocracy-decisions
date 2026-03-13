import { Trash2 } from "lucide-react";
import type { Relation, RelationType } from "@/lib/ui-models";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

interface RelationsAccordionProps {
  relations: Relation[];
  className?: string;
  title?: string;
  emptyLabel?: string;
  density?: "facilitator" | "display";
  onRemoveRelation?: (relationId: string) => void;
}

type RelationGroupConfig = {
  label: string;
  description: string;
  badgeClass: string;
};

const RELATION_CONFIG: Record<RelationType, RelationGroupConfig> = {
  related: {
    label: "Related",
    description: "Helpful related context for this decision.",
    badgeClass: "border-accent/30 text-accent bg-accent-dim/20",
  },
  blocks: {
    label: "Blocks",
    description: "This decision currently blocks the target item.",
    badgeClass: "border-danger/30 text-danger bg-danger-dim/20",
  },
  blocked_by: {
    label: "Blocked By",
    description: "This decision depends on the target item.",
    badgeClass: "border-caution/30 text-caution bg-caution-dim/20",
  },
  supersedes: {
    label: "Supersedes",
    description: "This decision replaces prior guidance.",
    badgeClass: "border-settled/30 text-settled bg-settled-dim/20",
  },
  superseded_by: {
    label: "Superseded By",
    description: "A newer decision has replaced this one.",
    badgeClass: "border-caution/30 text-caution bg-caution-dim/20",
  },
};

const RELATION_ORDER: RelationType[] = [
  "related",
  "blocks",
  "blocked_by",
  "supersedes",
  "superseded_by",
];

export function RelationsAccordion({
  relations,
  className,
  title = "Related decisions",
  emptyLabel = "No relations linked yet.",
  density = "facilitator",
  onRemoveRelation,
}: RelationsAccordionProps) {
  if (relations.length === 0) {
    return (
      <p
        className={cn(
          "text-text-muted italic",
          density === "display" ? "text-display-meta" : "text-fac-meta",
          className,
        )}
      >
        {emptyLabel}
      </p>
    );
  }

  const grouped = RELATION_ORDER.map((type) => ({
    type,
    items: relations.filter((relation) => relation.relationType === type),
  })).filter((entry) => entry.items.length > 0);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p
        className={cn(
          density === "display" ? "text-display-label" : "text-fac-label",
          "text-text-secondary uppercase tracking-widest",
        )}
      >
        {title}
      </p>

      {grouped.map((group, index) => {
        const config = RELATION_CONFIG[group.type];

        return (
          <AccordionSection
            key={group.type}
            title={`${config.label} (${group.items.length})`}
            subtitle={config.description}
            defaultOpen={index === 0}
          >
            <div className="flex flex-col gap-2">
              {group.items.map((relation) => (
                <article
                  key={relation.id}
                  className="rounded border border-border bg-surface px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded-badge border text-[11px] font-medium",
                        config.badgeClass,
                      )}
                    >
                      {config.label}
                    </span>
                    <span className="text-fac-meta text-text-muted">{relation.targetId}</span>
                    {onRemoveRelation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveRelation(relation.id)}
                        className="ml-auto text-danger hover:bg-danger-dim/20"
                      >
                        <Trash2 size={12} />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-text-primary mt-1.5 leading-relaxed",
                      density === "display" ? "text-display-meta" : "text-fac-field",
                    )}
                  >
                    {relation.targetTitle}
                  </p>
                </article>
              ))}
            </div>
          </AccordionSection>
        );
      })}
    </div>
  );
}
