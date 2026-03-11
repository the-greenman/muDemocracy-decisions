import { useState, useEffect } from "react";
import { listTemplates } from "../api/endpoints.js";
import type { DecisionTemplate } from "../api/types.js";
import { ApiError } from "../api/client.js";

interface UseTemplatesResult {
  templates: DecisionTemplate[];
  loading: boolean;
  error: string | null;
}

export function useTemplates(): UseTemplatesResult {
  const [templates, setTemplates] = useState<DecisionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then(({ templates: t }) => {
        if (!cancelled) setTemplates(t);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Failed to load templates");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { templates, loading, error };
}
