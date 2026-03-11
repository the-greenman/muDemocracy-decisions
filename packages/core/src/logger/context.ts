/**
 * Correlation ID and context management for async operations
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { LogContext } from "./types";

interface CorrelationContext extends LogContext {
  correlationId: string;
}

const contextStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Runs a function within a correlation context
 */
export function withContext<T>(context: Partial<CorrelationContext>, fn: () => T): T {
  const current = contextStorage.getStore() || {};
  const mergedContext: CorrelationContext = {
    correlationId: generateCorrelationId(),
    ...current,
    ...context,
  };

  return contextStorage.run(mergedContext, fn);
}

/**
 * Gets the current correlation context
 */
export function getContext(): CorrelationContext | undefined {
  return contextStorage.getStore();
}

/**
 * Gets the current correlation ID
 */
export function getCorrelationId(): string | undefined {
  return contextStorage.getStore()?.correlationId;
}

/**
 * Adds context to the existing correlation context
 */
export function addContext<T>(additionalContext: Partial<LogContext>, fn: () => T): T {
  const current = contextStorage.getStore();
  if (!current) {
    return withContext(additionalContext, fn);
  }

  const merged = { ...current, ...additionalContext };
  return contextStorage.run(merged, fn);
}

/**
 * Generates a new correlation ID
 */
function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

/**
 * Middleware for Express to add correlation ID
 */
export function correlationMiddleware() {
  return (req: any, res: any, next: any) => {
    const correlationId = req.headers["x-correlation-id"] || generateCorrelationId();
    req.correlationId = correlationId;
    res.setHeader("x-correlation-id", correlationId);

    withContext(
      {
        correlationId,
        requestId: req.id,
        operation: `${req.method} ${req.path}`,
      },
      next,
    );
  };
}
