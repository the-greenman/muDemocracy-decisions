import { ArrowUpCircle, X, Clock } from "lucide-react";
import type { Candidate } from "@/lib/ui-models";

interface CandidateCardProps {
  candidate: Candidate;
  onPromote?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export function CandidateCard({ candidate, onPromote, onDismiss }: CandidateCardProps) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-card border border-candidate-new/30 bg-caution-dim/20">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-fac-field text-text-primary font-medium leading-snug">
            {candidate.title}
          </p>
          <p className="text-fac-meta text-text-secondary mt-1 leading-snug">{candidate.summary}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <span className="flex items-center gap-1 text-fac-meta text-text-muted">
          <Clock size={12} />
          {candidate.detectedAt}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => onDismiss?.(candidate.id)}
          className="flex items-center gap-1 px-2 py-1 rounded text-fac-meta text-text-muted hover:text-danger hover:bg-danger-dim transition-colors"
        >
          <X size={13} />
          Dismiss
        </button>
        <button
          onClick={() => onPromote?.(candidate.id)}
          className="flex items-center gap-1 px-2 py-1 rounded text-fac-meta text-accent hover:bg-accent-dim transition-colors font-medium"
        >
          <ArrowUpCircle size={13} />
          Promote
        </button>
      </div>
    </div>
  );
}
