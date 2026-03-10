import { OpenAIWhisperProvider } from './openai.js';
import { LocalWhisperProvider } from './local.js';
import type { ITranscriptionProvider } from './interface.js';

export function createProviderFromEnv(): ITranscriptionProvider {
  const provider = process.env.TRANSCRIPTION_PROVIDER ?? 'openai';

  if (provider === 'local') {
    return new LocalWhisperProvider();
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required when TRANSCRIPTION_PROVIDER is openai');
  }

  return new OpenAIWhisperProvider(apiKey);
}
