import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DecisionContextPickerItem } from "@/api/types";
import { MeetingSearchPanel } from "@/components/shared/MeetingSearchPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface OpenContextPickerProps {
  contexts: DecisionContextPickerItem[];
  currentMeeting: { title: string; date: string };
  selectionMode: "single" | "multiple";
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  idPrefix?: string;
}

export function OpenContextPicker({
  contexts,
  currentMeeting,
  selectionMode,
  selectedIds,
  onChange,
  idPrefix = "open-context-picker",
}: OpenContextPickerProps) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);

  const querySuggestions = useMemo(() => {
    const values = new Set<string>();
    contexts.forEach((ctx) => {
      values.add(ctx.title);
      values.add(ctx.sourceMeetingTitle);
      values.add(ctx.sourceMeetingDate);
      ctx.sourceMeetingTags.forEach((tag) => values.add(tag));
    });
    return Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 16);
  }, [contexts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contexts.filter((ctx) => {
      if (selectedDate && ctx.sourceMeetingDate !== selectedDate) return false;
      if (month && !ctx.sourceMeetingDate.startsWith(month)) return false;

      if (!q) return true;
      if (ctx.title.toLowerCase().includes(q)) return true;
      if (ctx.sourceMeetingTitle.toLowerCase().includes(q)) return true;
      if (ctx.sourceMeetingDate.includes(q)) return true;
      if (ctx.sourceMeetingTags.some((tag) => tag.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [contexts, month, query, selectedDate]);

  const monthDates = useMemo(() => {
    const all = contexts
      .map((ctx) => ctx.sourceMeetingDate)
      .filter((date) => date.startsWith(month));
    return Array.from(new Set(all)).sort();
  }, [contexts, month]);

  const selectedPrimary =
    selectedIds.length > 0 ? (contexts.find((ctx) => ctx.id === selectedIds[0]) ?? null) : null;

  const selectedPrimaryIsCrossMeeting =
    !!selectedPrimary &&
    (selectedPrimary.sourceMeetingDate !== currentMeeting.date ||
      selectedPrimary.sourceMeetingTitle !== currentMeeting.title);

  function toggleContext(contextId: string) {
    if (selectionMode === "single") {
      onChange([contextId]);
      return;
    }

    onChange(
      selectedIds.includes(contextId)
        ? selectedIds.filter((id) => id !== contextId)
        : [...selectedIds, contextId],
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <MeetingSearchPanel
        query={query}
        onQueryChange={setQuery}
        month={month}
        onMonthChange={(value) => {
          setMonth(value);
          setSelectedDate("");
        }}
        queryPlaceholder="Search by date, title, or tag..."
        queryListId={`${idPrefix}-suggestions`}
        querySuggestions={querySuggestions}
        className="flex flex-wrap gap-2"
        actions={
          <Button
            onClick={() => setShowCalendar((prev) => !prev)}
            variant={showCalendar ? "outline-accent" : "secondary"}
            className="px-3 py-2 shrink-0"
          >
            <CalendarDays size={13} />
            Calendar
          </Button>
        }
      />

      {showCalendar && (
        <div className="rounded-card border border-border p-3 bg-overlay/40">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-fac-meta text-text-muted">Month</label>
            <Input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setSelectedDate("");
              }}
              inputSize="sm"
              className="bg-surface"
            />
            {selectedDate && (
              <Button
                onClick={() => setSelectedDate("")}
                variant="ghost"
                size="sm"
                className="ml-auto"
              >
                Clear date
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {monthDates.length === 0 && (
              <span className="text-fac-meta text-text-muted italic">
                No related meetings this month.
              </span>
            )}
            {monthDates.map((date) => (
              <Button
                key={date}
                onClick={() => setSelectedDate(date)}
                size="sm"
                variant={selectedDate === date ? "outline-accent" : "secondary"}
                className="px-2 py-1"
              >
                {date}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
        {filtered.map((ctx) => {
          const selected = selectedIds.includes(ctx.id);
          return (
            <button
              key={ctx.id}
              onClick={() => toggleContext(ctx.id)}
              className={`text-left p-3 rounded-card border transition-colors ${
                selected
                  ? "border-accent/40 bg-accent-dim/20"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <p className="text-fac-field text-text-primary font-medium">{ctx.title}</p>
              <p className="text-fac-meta text-text-muted mt-1">
                {ctx.sourceMeetingDate} · {ctx.sourceMeetingTitle}
              </p>
              <p className="text-fac-meta text-text-muted">
                {ctx.templateName} · {ctx.status} · {ctx.sourceMeetingTags.join(", ")}
              </p>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-fac-meta text-text-muted italic p-2">No matching contexts.</p>
        )}
      </div>

      {selectionMode === "single" && selectedPrimaryIsCrossMeeting && selectedPrimary && (
        <div className="rounded-card border border-accent/30 bg-accent-dim/15 p-3">
          <p className="text-fac-meta text-text-secondary">
            This context is from another meeting. Saving will first link the meeting relation:
          </p>
          <p className="text-fac-meta text-text-primary mt-1">
            {selectedPrimary.sourceMeetingDate} · {selectedPrimary.sourceMeetingTitle}
          </p>
        </div>
      )}
    </div>
  );
}
