# Transcript Preprocessing Architecture

**Status**: authoritative
**Owns**: transcript normalization contract, canonical segment shape, pluggable preprocessor seam, ingest-time preprocessing policy
**Must sync with**: `docs/transcript-context-management.md`, `docs/transcript-reading-and-segment-selection-architecture.md`, `docs/plans/iterative-implementation-plan.md`, `packages/schema`

## Purpose

Define a durable preprocessing architecture that improves transcript readability and consistency without committing to source-specific import pipelines.

The system should keep one canonical internal segment format and allow optional preprocessing plugins to normalize non-standard transcript input into that format.

## Decision Summary

1. Canonical internal transcript format is Whisper-style segments.
2. Preprocessing is a pluggable normalization seam, not a source-specific import framework.
3. Preprocessing runs at ingest time before chunking and reading projection generation.
4. Raw transcript input remains stored for auditability and reprocessing.

## Non-Goals

- Designing dedicated importer stacks for each transcription vendor.
- Coupling preprocessing logic to decision detection or expert inference.
- Replacing chunking strategy architecture.

## Canonical Segment Contract

All downstream services should consume normalized segments with at least:

- `sequenceNumber` (deterministic, ordered per meeting)
- `text` (non-empty)
- `speaker` (optional; may be `null`)
- `startTimeMs` / `endTimeMs` (optional)
- `sourceMetadata` (optional provenance map)

For missing speaker metadata, UI/CLI presentation should use fallback label `Speaker unknown`.

## Preprocessor Interface

Preprocessors are stateless transformers from raw transcript payload to canonical segments.

Required behavior:

- accept raw transcript payload + ingest options
- emit canonical segments
- preserve deterministic ordering
- never drop content silently
- attach warnings when assumptions are applied

Suggested interface shape in core:

```ts
interface TranscriptPreprocessor {
  id: string;
  canProcess(input: RawTranscriptInput): boolean;
  process(input: RawTranscriptInput, options?: PreprocessOptions): Promise<PreprocessResult>;
}
```

`PreprocessResult` should include:

- `segments`
- `warnings`
- `stats` (counts, timing)

## Default Preprocessor Policy

### Default v1 processor

Whisper-canonical pass-through processor:

- accepts already segmented Whisper-like input
- validates required fields
- normalizes optional fields
- returns segments unchanged semantically

### Baseline fallback processor

Plain-text normalization processor for non-segmented text:

- split into readable rows using conservative heuristics
- preserve paragraph boundaries first
- optionally split oversized blocks by sentence boundaries
- mark `speaker = null` when unknown

This is a normalization fallback, not an importer type.

## Pipeline Placement

At ingest:

1. store raw transcript payload
2. run selected preprocessor
3. store normalized canonical segments
4. run chunking/indexing
5. derive reading projection

Reading mode and chunking must consume the same canonical segment output.

## Selection And Context Implications

- Better row sizing from preprocessing improves drag-range segment selection.
- Cross-meeting decision contexts remain unchanged; preprocessing is meeting-local normalization.
- Confirmed selection persistence still stores reading-row IDs + resolved chunk IDs.

## Observability

For each preprocessing run, persist/log:

- preprocessor ID and version
- ingest source type
- input/output counts
- warnings emitted
- processing duration

If fallback heuristics are used, warnings should be visible in debug/log tooling.

## Failure Modes And Safeguards

1. Over-splitting: too many tiny rows.
- Safeguard: minimum row size + merge short fragments.

2. Under-splitting: very long rows reduce readability.
- Safeguard: max-length threshold with sentence-aware split fallback.

3. Metadata loss.
- Safeguard: preserve original metadata in `sourceMetadata`.

4. Non-deterministic output.
- Safeguard: stable ordering rules and deterministic tests.

## API/CLI Contract Notes

Preprocessing is internal to ingest flow. API/CLI surfaces should remain source-agnostic:

- transcript upload/stream commands accept raw payload
- normalized segment shape is returned/queried via transcript/chunk/reading endpoints
- no vendor-specific route families required

## Rollout

1. Add preprocessor interface and registry in core transcript ingest path.
2. Implement Whisper pass-through default processor.
3. Implement plain-text normalization fallback processor.
4. Add preprocessing observability to ingest logs/metadata.
5. Add parity tests for deterministic normalization and reading-mode impact.
