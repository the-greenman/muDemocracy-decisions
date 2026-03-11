export function resolveDecisionLoggerApiUrl(): string {
  return process.env.DECISION_LOGGER_API_URL ?? process.env.API_BASE_URL ?? "http://localhost:3001";
}

export function applyDecisionLoggerApiUrlOverride(apiUrl: string | undefined): void {
  if (apiUrl === undefined) {
    return;
  }

  process.env.DECISION_LOGGER_API_URL = apiUrl;
  process.env.API_BASE_URL = apiUrl;
}
