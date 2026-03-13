import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type AddParticipantHandler = (name: string) => boolean | Promise<boolean>;

interface ParticipantAddWidgetProps {
  onAdd: AddParticipantHandler;
  disabled?: boolean;
  placeholder?: string;
  buttonLabel?: string;
  size?: "sm" | "md";
}

export function ParticipantAddWidget({
  onAdd,
  disabled = false,
  placeholder = "Add participant",
  buttonLabel = "Add",
  size = "sm",
}: ParticipantAddWidgetProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const name = value.trim();
    if (!name || submitting || disabled) return;

    setSubmitting(true);
    setError(null);

    try {
      const added = await onAdd(name);
      if (!added) {
        setError("Participant already exists or could not be added.");
        return;
      }
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add participant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          inputSize={size}
          className="flex-1 bg-surface"
          disabled={disabled || submitting}
        />
        <Button
          onClick={() => void submit()}
          disabled={!value.trim() || disabled || submitting}
          variant="outline-accent"
          size={size}
        >
          <UserPlus size={13} />
          {submitting ? "Adding..." : buttonLabel}
        </Button>
      </div>
      {error && <p className="text-[10px] text-danger">{error}</p>}
    </div>
  );
}
