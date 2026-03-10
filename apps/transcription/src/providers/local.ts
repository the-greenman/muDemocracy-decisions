import type { ITranscriptionProvider, TranscriptionResult } from './interface.js';

export class LocalWhisperProvider implements ITranscriptionProvider {
  async transcribe(
    _audio: Buffer,
    _options: { filename: string; language?: string },
  ): Promise<TranscriptionResult> {
    throw new Error('LocalWhisperProvider is planned for T2 and is not implemented yet');
  }
}
