import { useMemo, useState } from "react";
import { ClipboardList, Link2, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { OpenContextPicker } from "@/components/shared/OpenContextPicker";
import { AgendaList } from "@/components/shared/AgendaList";
import { Panel } from "@/components/ui/Panel";
import { TabButton } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import type { DecisionContextPickerItem } from "@/api/types";

interface MeetingAgendaPlannerProps {
  manualAgendaItems: string[];
  draftManualAgendaItem: string;
  onDraftManualAgendaItemChange: (value: string) => void;
  onAddManualAgendaItem: () => void;
  onRemoveManualAgendaItem: (value: string) => void;
  onMoveManualAgendaItem: (value: string, direction: "up" | "down") => void;
  selectedContextIds: string[];
  onSelectedContextIdsChange: (ids: string[]) => void;
  contexts: DecisionContextPickerItem[];
  currentMeeting: { title: string; date: string };
}

export function MeetingAgendaPlanner({
  manualAgendaItems,
  draftManualAgendaItem,
  onDraftManualAgendaItemChange,
  onAddManualAgendaItem,
  onRemoveManualAgendaItem,
  onMoveManualAgendaItem,
  selectedContextIds,
  onSelectedContextIdsChange,
  contexts,
  currentMeeting,
}: MeetingAgendaPlannerProps) {
  const [agendaTab, setAgendaTab] = useState<"manual" | "open-contexts">("manual");

  const selectedOpenContexts = useMemo(
    () => contexts.filter((ctx) => selectedContextIds.includes(ctx.id)),
    [contexts, selectedContextIds],
  );

  return (
    <>
      <Panel title="Decision agenda" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <TabButton active={agendaTab === "manual"} onClick={() => setAgendaTab("manual")} compact>
            Agenda items
          </TabButton>
          <TabButton
            active={agendaTab === "open-contexts"}
            onClick={() => setAgendaTab("open-contexts")}
            compact
          >
            Browse open contexts
          </TabButton>
        </div>

        {agendaTab === "manual" ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Agenda item title..."
                value={draftManualAgendaItem}
                onChange={(e) => onDraftManualAgendaItemChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddManualAgendaItem()}
                inputSize="sm"
                className="flex-1"
              />
              <Button
                onClick={onAddManualAgendaItem}
                disabled={!draftManualAgendaItem.trim()}
                variant="outline-accent"
                size="sm"
              >
                <Plus size={13} />
                Add
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {manualAgendaItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-overlay/60"
                >
                  <ClipboardList size={13} className="text-text-muted" />
                  <span className="text-fac-meta text-text-primary flex-1">{item}</span>
                  <IconButton
                    onClick={() => onRemoveManualAgendaItem(item)}
                    tone="danger"
                    className="w-7 h-7 border-0"
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <OpenContextPicker
              idPrefix="meeting-home-open-contexts"
              contexts={contexts}
              currentMeeting={currentMeeting}
              selectionMode="multiple"
              selectedIds={selectedContextIds}
              onChange={onSelectedContextIdsChange}
            />
          </div>
        )}
      </Panel>

      <Panel title="Agenda overview" className="lg:col-span-2">
        {manualAgendaItems.length === 0 && selectedOpenContexts.length === 0 ? (
          <p className="text-fac-meta text-text-muted mt-1">
            Add agenda items or existing contexts to shape meeting flow before opening a decision
            workspace.
          </p>
        ) : (
          <AgendaList
            items={[
              ...manualAgendaItems.map((item) => ({
                id: `manual-${item}`,
                title: `${item} (candidate — promotion required)`,
                status: "pending" as const,
              })),
              ...selectedOpenContexts.map((ctx) => ({
                id: `ctx-${ctx.id}`,
                title: `${ctx.title} (open context)`,
                status: ctx.status === "deferred" ? ("deferred" as const) : ("drafted" as const),
              })),
            ]}
            renderItemActions={(item, index) => {
              if (!item.id.startsWith("manual-")) return null;

              const canMoveUp = index > 0;
              const manualLastIndex = manualAgendaItems.length - 1;
              const canMoveDown = index < manualLastIndex;
              const manualValue = item.id.replace("manual-", "");

              return (
                <>
                  <IconButton
                    onClick={() => onMoveManualAgendaItem(manualValue, "up")}
                    disabled={!canMoveUp}
                    className="w-7 h-7"
                    aria-label={`Move ${item.title} up`}
                  >
                    <ArrowUp size={12} />
                  </IconButton>
                  <IconButton
                    onClick={() => onMoveManualAgendaItem(manualValue, "down")}
                    disabled={!canMoveDown}
                    className="w-7 h-7"
                    aria-label={`Move ${item.title} down`}
                  >
                    <ArrowDown size={12} />
                  </IconButton>
                </>
              );
            }}
          />
        )}
        {manualAgendaItems.length > 0 && (
          <p className="mt-2 text-fac-meta text-text-muted">
            Items labelled “candidate” are sent to Suggested queue and require promotion before
            entering the decision agenda.
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-fac-meta text-text-muted">
          <Link2 size={13} />
          Cross-meeting context linking is applied when open contexts are attached in facilitator
          workspace.
        </div>
      </Panel>
    </>
  );
}
