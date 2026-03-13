import type { TagCategory } from "@/lib/ui-models";

interface TagPillProps {
  name: string;
  category: TagCategory;
}

const CATEGORY_CLASSES: Record<TagCategory, string> = {
  topic: "bg-tag-topic-bg text-tag-topic border-tag-topic/30",
  team: "bg-tag-team-bg text-tag-team border-tag-team/30",
  project: "bg-tag-project-bg text-tag-project border-tag-project/30",
};

export function TagPill({ name, category }: TagPillProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-pill text-fac-meta border font-medium ${CATEGORY_CLASSES[category]}`}
    >
      {name}
    </span>
  );
}
