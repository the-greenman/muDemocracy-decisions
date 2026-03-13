import { useState } from "react";
import {
  X,
  Lock,
  Unlock,
  RotateCcw,
  History,
  PlusCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { DecisionFeedback } from "@/api/types";
import type { Field, FieldVersion, SupplementaryItem } from "@/lib/ui-models";

interface FieldZoomProps {
  field: Field;
  supplementaryItems: SupplementaryItem[];
  feedbackItems: DecisionFeedback[];
  feedbackLoading: boolean;
  onClose: () => void;
  onSave: (fieldId: string, value: string) => void;
  onRegenerate: (fieldId: string) => void;
  onSubmitFeedback: (
    fieldId: string,
    payload: { comment: string; rating: "approved" | "needs_work" | "rejected" },
  ) => Promise<void>;
  onLock: (fieldId: string) => void;
  onUnlock: (fieldId: string) => void;
  onAddSupplementary: (item: Omit<SupplementaryItem, "id" | "createdAt">) => void;
  onRemoveSupplementary: (id: string) => void;
  onSelectTranscript?: (fieldId: string) => void;
  meetingId?: string;
  contextId?: string;
}

export function FieldZoom({
  field,
  supplementaryItems,
  feedbackItems,
  feedbackLoading,
  onClose,
  onSave,
  onRegenerate,
  onSubmitFeedback,
  onLock,
  onUnlock,
  onAddSupplementary,
  onRemoveSupplementary,
  onSelectTranscript,
}: FieldZoomProps) {
  const [editValue, setEditValue] = useState(field.value);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<"approved" | "needs_work" | "rejected">(
    "needs_work",
  );
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newBody, setNewBody] = useState("");
  const isLocked = field.status === "locked";
  const isGenerating = field.status === "generating";
  const isDirty = editValue !== field.value;

  const fieldItems = supplementaryItems.filter(
    (s) => s.scope === "field" && s.fieldId === field.id,
  );

  function handleSave() {
    onSave(field.id, editValue);
  }

  function handleAddEvidence() {
    if (!newBody.trim()) return;
    onAddSupplementary({
      label: newLabel.trim() || "Supplementary note",
      body: newBody.trim(),
      scope: "field",
      fieldId: field.id,
    });
    setNewLabel("");
    setNewBody("");
    setShowAddEvidence(false);
  }

  function handleRestoreVersion(v: FieldVersion) {
    setEditValue(v.value);
    setShowHistory(false);
  }

  async function handleSubmitFeedback() {
    const comment = feedbackComment.trim();
    if (!comment) return;

    setSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await onSubmitFeedback(field.id, { comment, rating: feedbackRating });
      setFeedbackComment("");
      setFeedbackRating("needs_work");
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Failed to save feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-base flex flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={16} />
          Close
        </button>
        <div className="w-px h-4 bg-border" />
        <span className="text-fac-label text-text-secondary uppercase tracking-wider flex-1">
          {field.label}
          {field.required && <span className="ml-1 text-danger">*</span>}
        </span>

        <div className="flex items-center gap-2">
          {isLocked ? (
            <button
              onClick={() => onUnlock(field.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta border border-caution/30 text-caution rounded hover:bg-caution-dim transition-colors"
            >
              <Unlock size={13} />
              Unlock to edit
            </button>
          ) : (
            <>
              <button
                onClick={() => onSelectTranscript?.(field.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta border border-border text-text-secondary rounded hover:text-text-primary hover:bg-overlay transition-colors"
              >
                Select transcript segments
              </button>
              <button
                onClick={() => onRegenerate(field.id)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta border border-accent/30 text-accent rounded hover:bg-accent-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <RotateCcw size={13} />
                Regenerate this field
              </button>
              {isDirty && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors"
                >
                  Save
                </button>
              )}
              <button
                onClick={() => onLock(field.id)}
                disabled={!editValue.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta border border-settled/30 text-settled rounded hover:bg-settled-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Lock size={13} />
                Lock
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Main edit area */}
        <div className="flex-1 flex flex-col min-w-0 px-8 py-6 gap-5 overflow-y-auto">
          {/* Field instructions */}
          {field.instructions && (
            <div className="flex flex-col gap-1 p-3 rounded-card border border-border bg-overlay/40">
              <span className="text-fac-meta text-text-muted uppercase tracking-wider text-[11px]">
                Instructions
              </span>
              <p className="text-fac-meta text-text-secondary leading-snug">{field.instructions}</p>
            </div>
          )}

          {/* Field content */}
          <div className="flex flex-col gap-2">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Content
            </label>
            {isLocked ? (
              <div className="p-4 rounded-card border border-border-locked bg-settled-dim/10 text-fac-field text-text-primary leading-relaxed whitespace-pre-wrap">
                {editValue || <span className="text-text-muted italic">Empty</span>}
              </div>
            ) : (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                disabled={isGenerating}
                className="w-full min-h-[200px] p-4 rounded-card border border-border bg-surface text-fac-field text-text-primary leading-relaxed resize-y focus:outline-none focus:border-accent placeholder:text-text-muted"
                placeholder="Enter content…"
              />
            )}
          </div>

          {/* Supplementary evidence */}
          <SupplementarySection
            items={fieldItems}
            showAdd={showAddEvidence}
            newLabel={newLabel}
            newBody={newBody}
            onToggleAdd={() => setShowAddEvidence((v) => !v)}
            onLabelChange={setNewLabel}
            onBodyChange={setNewBody}
            onAdd={handleAddEvidence}
            onRemove={onRemoveSupplementary}
            onCancelAdd={() => {
              setShowAddEvidence(false);
              setNewLabel("");
              setNewBody("");
            }}
          />

          <FieldFeedbackSection
            items={feedbackItems}
            loading={feedbackLoading}
            comment={feedbackComment}
            rating={feedbackRating}
            error={feedbackError}
            submitting={submittingFeedback}
            onCommentChange={setFeedbackComment}
            onRatingChange={setFeedbackRating}
            onSubmit={handleSubmitFeedback}
          />
        </div>

        {/* Right sidebar — version history */}
        {(field.versions?.length ?? 0) > 0 && (
          <aside className="w-72 shrink-0 border-l border-border flex flex-col bg-surface">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-2 px-4 py-3 text-fac-meta text-text-secondary hover:text-text-primary border-b border-border transition-colors"
            >
              <History size={14} />
              Version history
              {showHistory ? (
                <ChevronDown size={13} className="ml-auto" />
              ) : (
                <ChevronRight size={13} className="ml-auto" />
              )}
            </button>
            {showHistory && (
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {[...(field.versions ?? [])].reverse().map((v) => (
                  <VersionEntry
                    key={v.version}
                    version={v}
                    onRestore={() => handleRestoreVersion(v)}
                  />
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

interface FieldFeedbackSectionProps {
  items: DecisionFeedback[];
  loading: boolean;
  comment: string;
  rating: "approved" | "needs_work" | "rejected";
  error: string | null;
  submitting: boolean;
  onCommentChange: (value: string) => void;
  onRatingChange: (value: "approved" | "needs_work" | "rejected") => void;
  onSubmit: () => void;
}

function FieldFeedbackSection({
  items,
  loading,
  comment,
  rating,
  error,
  submitting,
  onCommentChange,
  onRatingChange,
  onSubmit,
}: FieldFeedbackSectionProps) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-center justify-between">
        <label className="text-fac-label text-text-secondary uppercase tracking-wider">
          Feedback
          <span className="ml-2 text-text-muted normal-case tracking-normal font-normal">
            (field-specific guidance and review history)
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-2 p-3 rounded-card border border-accent/20 bg-accent-dim/10">
        <div className="flex flex-wrap gap-2">
          {([
            ["needs_work", "Needs work"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onRatingChange(value)}
              className={`px-3 py-1.5 rounded border text-fac-meta transition-colors ${
                rating === value
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={4}
          placeholder="Add field-specific feedback for regeneration or review…"
          className="w-full p-3 rounded border border-border bg-surface text-fac-meta text-text-primary leading-relaxed resize-y focus:outline-none focus:border-accent placeholder:text-text-muted"
        />
        {error && <p className="text-fac-meta text-danger">{error}</p>}
        <div className="flex justify-end">
          <button
            onClick={onSubmit}
            disabled={submitting || !comment.trim()}
            className="px-3 py-1.5 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Save feedback"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-fac-meta text-text-muted">Loading feedback…</p>
      ) : items.length === 0 ? (
        <p className="text-fac-meta text-text-muted italic">
          No field feedback yet. Add feedback here to guide future regeneration and show review history.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...items].reverse().map((item) => (
            <FeedbackEntry key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackEntry({ item }: { item: DecisionFeedback }) {
  const createdAt = new Date(item.createdAt).toLocaleString("en-GB");
  const ratingLabel =
    item.rating === "needs_work"
      ? "Needs work"
      : item.rating === "approved"
        ? "Approved"
        : "Rejected";

  return (
    <div className="flex flex-col gap-2 p-3 rounded-card border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 text-fac-meta">
        <span className="font-medium text-text-primary">{item.authorId}</span>
        <span className="px-2 py-0.5 rounded bg-overlay/50 text-text-secondary">{ratingLabel}</span>
        <span className="px-2 py-0.5 rounded bg-overlay/50 text-text-muted">{item.source}</span>
        <span className="ml-auto text-text-muted">{createdAt}</span>
      </div>
      <p className="text-fac-meta text-text-primary whitespace-pre-wrap leading-relaxed">
        {item.comment}
      </p>
    </div>
  );
}

// ── Supplementary evidence section ──────────────────────────────

interface SupplementarySectionProps {
  items: SupplementaryItem[];
  showAdd: boolean;
  newLabel: string;
  newBody: string;
  onToggleAdd: () => void;
  onLabelChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onCancelAdd: () => void;
}

function SupplementarySection({
  items,
  showAdd,
  newLabel,
  newBody,
  onToggleAdd,
  onLabelChange,
  onBodyChange,
  onAdd,
  onRemove,
  onCancelAdd,
}: SupplementarySectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-fac-label text-text-secondary uppercase tracking-wider">
          Supplementary evidence
          <span className="ml-2 text-text-muted normal-case tracking-normal font-normal">
            (non-transcript text used as source content)
          </span>
        </label>
        <button
          onClick={onToggleAdd}
          className="flex items-center gap-1 text-fac-meta text-accent hover:text-accent/80 transition-colors"
        >
          <PlusCircle size={13} />
          Add
        </button>
      </div>

      {/* Existing items */}
      {items.length === 0 && !showAdd && (
        <p className="text-fac-meta text-text-muted italic">
          No supplementary evidence at this field scope.
        </p>
      )}
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-1.5 p-3 rounded-card border border-border bg-surface"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-fac-meta text-text-secondary font-medium">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-fac-meta text-text-muted">{item.createdAt}</span>
              <button
                onClick={() => onRemove(item.id)}
                className="text-text-muted hover:text-danger transition-colors"
                aria-label="Remove item"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <pre className="text-fac-meta text-text-primary whitespace-pre-wrap font-sans leading-snug">
            {item.body}
          </pre>
        </div>
      ))}

      {/* Add form */}
      {showAdd && (
        <div className="flex flex-col gap-2 p-3 rounded-card border border-accent/20 bg-accent-dim/10">
          <input
            type="text"
            placeholder="Label (optional)"
            value={newLabel}
            onChange={(e) => onLabelChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded border border-border bg-surface text-fac-meta text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted"
          />
          <textarea
            placeholder="Paste or type supplementary content…"
            value={newBody}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={5}
            className="w-full p-3 rounded border border-border bg-surface text-fac-meta text-text-primary leading-relaxed resize-y focus:outline-none focus:border-accent placeholder:text-text-muted"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancelAdd}
              className="px-3 py-1.5 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onAdd}
              disabled={!newBody.trim()}
              className="px-3 py-1.5 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40"
            >
              Save evidence
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Version entry ────────────────────────────────────────────────

function VersionEntry({ version, onRestore }: { version: FieldVersion; onRestore: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded border border-border bg-overlay/30">
      <div className="flex items-center gap-2">
        <span className="text-fac-meta text-text-muted">v{version.version}</span>
        <span className="text-fac-meta text-text-muted">{version.savedAt}</span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-text-muted hover:text-text-primary"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>
      {expanded && (
        <>
          <p className="text-fac-meta text-text-secondary leading-snug line-clamp-4">
            {version.value}
          </p>
          <button
            onClick={onRestore}
            className="flex items-center gap-1 text-fac-meta text-accent hover:text-accent/80 transition-colors self-start"
          >
            <RotateCcw size={12} />
            Restore
          </button>
        </>
      )}
    </div>
  );
}
