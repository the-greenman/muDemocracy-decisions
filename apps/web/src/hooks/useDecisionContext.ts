import { useState, useEffect, useCallback } from "react";
import { getDecisionContext, getTemplateFields } from "../api/endpoints.js";
import { buildUIFields } from "../api/adapters.js";
import type { DecisionContext, DecisionField } from "../api/types.js";
import type { Field } from "../lib/ui-models.js";
import { ApiError } from "../api/client.js";

interface UseDecisionContextResult {
  context: DecisionContext | null;
  fields: Field[];
  templateFields: DecisionField[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDecisionContext(id: string | null): UseDecisionContextResult {
  const [context, setContext] = useState<DecisionContext | null>(null);
  const [templateFields, setTemplateFields] = useState<DecisionField[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) {
      setContext(null);
      setFields([]);
      setTemplateFields([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ctx = await getDecisionContext(id);
      const { fields: tplFields } = await getTemplateFields(ctx.templateId);
      setContext(ctx);
      setTemplateFields(tplFields);
      setFields(buildUIFields(tplFields, ctx));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load context");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { context, fields, templateFields, loading, error, refresh: fetch };
}
