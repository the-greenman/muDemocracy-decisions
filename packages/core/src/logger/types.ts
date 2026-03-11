/**
 * Logger configuration and types
 */

export interface LogContext {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  operation?: string;
  service?: string;
  [key: string]: unknown;
}

export interface LoggerConfig {
  level: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  prettyPrint: boolean;
  redactFields: string[];
  service: string;
}

export interface RedactionOptions {
  fields: string[];
  replacement?: string;
  partial?: boolean;
}

export const DEFAULT_REDACT_FIELDS = [
  "password",
  "token",
  "secret",
  "key",
  "auth",
  "authorization",
  "cookie",
  "session",
  "creditCard",
  "ssn",
  "socialSecurityNumber",
  "apiKey",
  "privateKey",
];

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
