/**
 * Utilities for redacting sensitive information from logs
 */

import type { RedactionOptions } from "./types";

/**
 * Redacts sensitive values in an object
 */
export function redactSensitive<T extends Record<string, unknown> | unknown[]>(
  obj: T,
  options: RedactionOptions = { fields: [] },
): T {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const { fields, replacement = "[REDACTED]", partial = false } = options;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitive(item as Record<string, unknown>, options)) as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = fields.some((field) => lowerKey.includes(field.toLowerCase()));

    if (shouldRedact && value && typeof value === "string") {
      result[key] = partial ? redactPartial(value, replacement) : replacement;
    } else if (shouldRedact && value) {
      result[key] = replacement;
    } else if (value && typeof value === "object") {
      result[key] = redactSensitive(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Partially redacts a string (show first and last few characters)
 */
function redactPartial(str: string, replacement: string): string {
  if (str.length <= 8) {
    return replacement;
  }

  const start = str.substring(0, 4);
  const end = str.substring(str.length - 4);
  const middle = "*".repeat(str.length - 8);

  return `${start}${middle}${end}`;
}

/**
 * Creates a redaction function for Pino
 */
export function createRedactor(fields: string[]) {
  return (obj: unknown) => redactSensitive(obj as Record<string, unknown>, { fields });
}
