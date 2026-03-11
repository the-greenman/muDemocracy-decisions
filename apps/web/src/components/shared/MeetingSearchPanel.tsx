import type { ReactNode } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface TagOption {
  value: string;
  label: string;
}

interface MeetingSearchPanelProps {
  query: string;
  onQueryChange: (next: string) => void;
  month: string;
  onMonthChange: (next: string) => void;
  queryPlaceholder: string;
  tagValue?: string;
  onTagChange?: (next: string) => void;
  tagOptions?: TagOption[];
  actions?: ReactNode;
  queryListId?: string;
  querySuggestions?: string[];
  className?: string;
}

export function MeetingSearchPanel({
  query,
  onQueryChange,
  month,
  onMonthChange,
  queryPlaceholder,
  tagValue,
  onTagChange,
  tagOptions,
  actions,
  queryListId,
  querySuggestions,
  className,
}: MeetingSearchPanelProps) {
  return (
    <div className={className ?? "flex flex-wrap gap-2 mb-3"}>
      <Input
        list={queryListId}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={queryPlaceholder}
        className="min-w-0 flex-1"
      />

      {queryListId && querySuggestions && querySuggestions.length > 0 && (
        <datalist id={queryListId}>
          {querySuggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}

      <Input
        type="month"
        value={month}
        onChange={(e) => onMonthChange(e.target.value)}
        inputSize="sm"
        className="w-auto shrink-0"
      />

      {tagValue !== undefined && onTagChange && tagOptions && tagOptions.length > 0 && (
        <Select value={tagValue} onChange={(e) => onTagChange(e.target.value)} className="w-auto">
          {tagOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}

      {actions}
    </div>
  );
}
