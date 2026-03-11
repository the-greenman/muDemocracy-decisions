import { useState, useEffect, useCallback } from "react";
import { getMeeting, getMeetingSummary } from "../api/endpoints.js";
import type { Meeting, MeetingSummary } from "../api/types.js";
import { ApiError } from "../api/client.js";

interface UseMeetingResult {
  meeting: Meeting | null;
  summary: MeetingSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMeeting(id: string): UseMeetingResult {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [meetingData, summaryData] = await Promise.all([
        getMeeting(id),
        getMeetingSummary(id).catch(() => null),
      ]);
      setMeeting(meetingData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load meeting");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { meeting, summary, loading, error, refresh: fetch };
}
