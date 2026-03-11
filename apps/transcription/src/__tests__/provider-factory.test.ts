import { afterEach, describe, expect, it } from 'vitest';
import { LocalWhisperProvider } from '../providers/local.js';
import { OpenAIWhisperProvider } from '../providers/openai.js';
import { createProviderFromEnv } from '../providers/index.js';

const previousProvider = process.env.TRANSCRIPTION_PROVIDER;
const previousOpenAiKey = process.env.OPENAI_API_KEY;
const previousLocalUrl = process.env.WHISPER_LOCAL_URL;

afterEach(() => {
  if (previousProvider === undefined) {
    delete process.env.TRANSCRIPTION_PROVIDER;
  } else {
    process.env.TRANSCRIPTION_PROVIDER = previousProvider;
  }

  if (previousOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = previousOpenAiKey;
  }

  if (previousLocalUrl === undefined) {
    delete process.env.WHISPER_LOCAL_URL;
  } else {
    process.env.WHISPER_LOCAL_URL = previousLocalUrl;
  }
});

describe('createProviderFromEnv', () => {
  it('returns local provider when TRANSCRIPTION_PROVIDER=local', () => {
    process.env.TRANSCRIPTION_PROVIDER = 'local';
    process.env.WHISPER_LOCAL_URL = 'http://whisper:9000';

    const provider = createProviderFromEnv();
    expect(provider).toBeInstanceOf(LocalWhisperProvider);
  });

  it('returns openai provider by default', () => {
    delete process.env.TRANSCRIPTION_PROVIDER;
    process.env.OPENAI_API_KEY = 'test-key';

    const provider = createProviderFromEnv();
    expect(provider).toBeInstanceOf(OpenAIWhisperProvider);
  });

  it('throws when openai provider selected without OPENAI_API_KEY', () => {
    process.env.TRANSCRIPTION_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;

    expect(() => createProviderFromEnv()).toThrow('OPENAI_API_KEY is required');
  });

  it('throws when TRANSCRIPTION_PROVIDER is an unknown value', () => {
    process.env.TRANSCRIPTION_PROVIDER = 'whisper-cloud';

    expect(() => createProviderFromEnv()).toThrow('Unknown TRANSCRIPTION_PROVIDER: "whisper-cloud"');
  });
});
