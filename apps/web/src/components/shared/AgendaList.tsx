import { AgendaItem } from "@/components/shared/AgendaItem";
import type { AgendaItemStatus } from "@/lib/ui-models";

type AgendaListItem = {
  id: string;
  title: string;
  status: AgendaItemStatus;
};

interface AgendaListProps {
  items: AgendaListItem[];
  activeId?: string;
  startAt?: number;
  emptyLabel?: string;
  onSelectItem?: (id: string) => void;
  renderItemActions?: (item: AgendaListItem, index: number) => React.ReactNode;
}

export function AgendaList({
  items,
  activeId,
  startAt = 1,
  emptyLabel = "No agenda items yet.",
  onSelectItem,
  renderItemActions,
}: AgendaListProps) {
  if (items.length === 0) {
    return <p className="text-fac-meta text-text-muted px-2 py-2">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <AgendaItem
          key={item.id}
          title={item.title}
          status={item.status}
          position={index + startAt}
          isActive={item.id === activeId}
          onClick={onSelectItem ? () => onSelectItem(item.id) : undefined}
          actions={renderItemActions ? renderItemActions(item, index) : undefined}
        />
      ))}
    </div>
  );
}
