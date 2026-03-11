import { useState, useEffect, useCallback, useRef } from "react";
import { listFlaggedDecisions, listMeetingDecisionContexts } from "../api/endpoints.js";
import type { DecisionContext, FlaggedDecisionListItem } from "../api/types.js";
import { ApiError } from "../api/client.js";

interface UseMeetingAgendaOptions {
  /** Poll every 4 seconds when true. Use on SharedMeetingPage. */
  poll?: boolean;
}

interface UseMeetingAgendaResult {
  decisions: FlaggedDecisionListItem[];
  contexts: DecisionContext[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const POLL_INTERVAL_MS = 4000;

export function useMeetingAgenda(
  meetingId: string,
  options: UseMeetingAgendaOptions = {},
): UseMeetingAgendaResult {
  const { poll = false } = options;
  const [decisions, setDecisions] = useState<FlaggedDecisionListItem[]>([]);
  const [contexts, setContexts] = useState<DecisionContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!meetingId) return;
    setError(null);
    try {
      const [decisionsData, contextsData] = await Promise.all([
        listFlaggedDecisions(meetingId),
        listMeetingDecisionContexts(meetingId),
      ]);
      setDecisions(decisionsData.decisions);
      setContexts(contextsData.contexts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load agenda");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  // Polling for SharedMeetingPage
  useEffect(() => {
    if (!poll) return;
    intervalRef.current = setInterval(() => {
      void fetch();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [poll, fetch]);

  return { decisions, contexts, loading, error, refresh: fetch };
}
