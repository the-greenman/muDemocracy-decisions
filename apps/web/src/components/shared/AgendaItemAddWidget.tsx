import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type AgendaItemAddWidgetProps = {
  onAdd: (title: string) => Promise<void> | void;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  placeholder?: string;
  buttonLabel?: string;
};

export function AgendaItemAddWidget({
  onAdd,
  disabled = false,
  loading = false,
  error = null,
  placeholder = "Add agenda item title...",
  buttonLabel = "Add agenda item",
}: AgendaItemAddWidgetProps) {
  const [title, setTitle] = useState("");

  async function handleAdd() {
    const value = title.trim();
    if (!value || disabled || loading) return;
    await onAdd(value);
    setTitle("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void handleAdd()}
          placeholder={placeholder}
          inputSize="sm"
          className="flex-1 bg-surface"
          disabled={disabled || loading}
        />
        <Button
          onClick={() => void handleAdd()}
          disabled={!title.trim() || disabled || loading}
          variant="outline-accent"
          size="sm"
        >
          <Plus size={13} />
          {loading ? "Adding…" : buttonLabel}
        </Button>
      </div>
      {error && <p className="text-fac-meta text-danger">{error}</p>}
    </div>
  );
}
