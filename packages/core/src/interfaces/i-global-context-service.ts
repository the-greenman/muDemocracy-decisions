import type {
  DecisionContext,
  DecisionLog,
  DecisionTemplate,
  FlaggedDecision,
  Meeting,
  TranscriptChunk,
} from "@repo/schema";

export type GlobalContextState = {
  activeMeetingId?: string;
  activeDecisionId?: string;
  activeDecisionContextId?: string;
  activeField?: string;
};

export type GlobalContext = GlobalContextState & {
  activeMeeting?: Meeting;
  activeDecision?: FlaggedDecision;
  activeDecisionContext?: DecisionContext;
  activeTemplate?: DecisionTemplate;
};

export interface IGlobalContextStore {
  load(): Promise<GlobalContextState>;
  save(state: GlobalContextState): Promise<void>;
}

/**
 * Subscriber-facing event payload (without the monotonic id).
 * "resync" is a sentinel sent when the ring buffer cannot replay — the client
 * must re-fetch state via REST.
 */
export type ConnectionSSEEvent =
  | { type: "context"; data: GlobalContext }
  | { type: "chunk"; data: TranscriptChunk }
  | { type: "flagged"; data: FlaggedDecision }
  | { type: "logged"; data: DecisionLog }
  | { type: "resync" };

/**
 * Bus-level event — includes the per-connection monotonic id used as the SSE
 * `id:` field for reconnect support.
 */
export type BusEvent = ConnectionSSEEvent & { id: number };

export type BroadcastContext = {
  decisionContextId: string | null;
  fieldId: string | null;
};

export interface IGlobalContextService {
  setActiveMeeting(connectionId: string, meetingId: string): Promise<void>;
  clearMeeting(connectionId: string): Promise<void>;
  setBroadcastContext(meetingId: string, decisionContextId: string | null, fieldId: string | null): Promise<BroadcastContext>;
  clearBroadcastContext(meetingId: string): Promise<void>;
  getBroadcastContext(meetingId: string): Promise<BroadcastContext>;
  setActiveDecision(
    connectionId: string,
    flaggedDecisionId: string,
    templateId?: string,
    contextId?: string,
  ): Promise<DecisionContext>;
  clearDecision(connectionId: string): Promise<void>;
  setActiveField(connectionId: string, fieldId: string): Promise<void>;
  clearField(connectionId: string): Promise<void>;
  getContext(connectionId: string): Promise<GlobalContext>;

  // Phase 2: SSE event subscription
  subscribe(connectionId: string, listener: (event: BusEvent) => void): () => void;
  emitChunk(connectionId: string, chunk: TranscriptChunk): void;
  emitFlagged(connectionId: string, decision: FlaggedDecision): void;
  emitLogged(connectionId: string, log: DecisionLog): void;
  /**
   * Returns buffered events since `afterId`.
   * Returns `"resync"` if the gap is larger than the ring buffer.
   * Returns `undefined` if no ring buffer exists yet for this connection.
   */
  replayEvents(connectionId: string, afterId: number): BusEvent[] | "resync" | undefined;
}
