import { OpenAIWhisperProvider } from "./openai.js";
import { LocalWhisperProvider } from "./local.js";
import type { ITranscriptionProvider } from "./interface.js";

export function createProviderFromEnv(): ITranscriptionProvider {
  const provider = process.env.TRANSCRIPTION_PROVIDER ?? "openai";

  if (provider === "local") {
    const whisperLocalUrl = process.env.WHISPER_LOCAL_URL ?? "http://localhost:9000";
    return new LocalWhisperProvider(whisperLocalUrl);
  }

  if (provider !== "openai") {
    throw new Error(`Unknown TRANSCRIPTION_PROVIDER: "${provider}". Expected "openai" or "local".`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when TRANSCRIPTION_PROVIDER is openai");
  }

  return new OpenAIWhisperProvider(apiKey);
}
