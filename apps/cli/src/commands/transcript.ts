import { Command } from 'commander';
import chalk from 'chalk';
import { createTranscriptService } from '@repo/core';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// Create service instance
const transcriptService = createTranscriptService();

export const transcriptCommand = new Command('transcript')
  .description('Transcript management commands');

// List transcripts command
transcriptCommand
  .command('list')
  .description('List all transcripts for a meeting')
  .option('-m, --meeting-id <id>', 'Meeting ID (required)')
  .option('-c, --chunks', 'Show chunks instead of transcripts')
  .option('-s, --strategy <strategy>', 'Filter chunks by strategy (fixed, semantic, speaker, streaming)')
  .action(async (options) => {
    try {
      if (!options.meetingId) {
        console.error(chalk.red('Error: --meeting-id is required'));
        throw new Error('--meeting-id is required');
      }

      if (options.chunks) {
        // Show chunks
        let chunks = await transcriptService.getChunksByMeeting(options.meetingId);

        if (options.strategy) {
          chunks = chunks.filter((c) => c.chunkStrategy === options.strategy);
        }
        
        if (chunks.length === 0) {
          console.log(chalk.yellow('No chunks found for this meeting'));
          return;
        }

        console.log(chalk.white('Transcript Chunks:'));
        console.log('');
        
        chunks.forEach((chunk, index) => {
          console.log(chalk.gray(`${index + 1}. Chunk ${chunk.id}`));
          console.log(chalk.white(`   Sequence: ${chunk.sequenceNumber}`));
          console.log(chalk.white(`   Strategy: ${chunk.chunkStrategy}`));
          console.log(chalk.white(`   Tokens: ${chunk.tokenCount}`));
          console.log(chalk.white(`   Words: ${chunk.wordCount}`));
          if (chunk.contexts.length > 0) {
            console.log(chalk.white(`   Contexts: ${chunk.contexts.join(', ')}`));
          }
          console.log(chalk.gray(`   Text: ${chunk.text.substring(0, 100)}${chunk.text.length > 100 ? '...' : ''}`));
          console.log('');
        });
      } else {
        // Show transcripts
        const transcripts = await transcriptService.getTranscriptsByMeeting(options.meetingId);
        
        if (transcripts.length === 0) {
          console.log(chalk.yellow('No transcripts found for this meeting'));
          return;
        }

        console.log(chalk.white('Transcripts:'));
        console.log('');
        
        transcripts.forEach((transcript, index) => {
          console.log(chalk.gray(`${index + 1}. ${transcript.id}`));
          console.log(chalk.white(`   Format: ${transcript.format}`));
          console.log(chalk.white(`   Source: ${transcript.source}`));
          console.log(chalk.white(`   Uploaded: ${transcript.uploadedAt}`));
          console.log('');
        });
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Add transcript command
transcriptCommand
  .command('add')
  .description('Add transcript events')
  .option('-t, --text <text>', 'Transcript text')
  .option('-f, --file <file>', 'Transcript file path')
  .option('-s, --speaker <speaker>', 'Speaker name')
  .option('-m, --meeting-id <id>', 'Meeting ID (required)')
  .action(async (options) => {
    try {
      if (!options.text && !options.file) {
        console.error(chalk.red('Error: Either --text or --file must be provided'));
        throw new Error('Either --text or --file must be provided');
      }

      if (!options.meetingId) {
        console.error(chalk.red('Error: --meeting-id is required'));
        throw new Error('--meeting-id is required');
      }

      if (options.text) {
        // Add text event directly
        await transcriptService.addStreamEvent(
          options.meetingId,
          {
            type: 'text',
            data: {
              text: options.text,
              speaker: options.speaker || 'Unknown',
            },
          }
        );
      } else {
        // TODO: Implement file parsing
        console.error(chalk.red('Error: File parsing not yet implemented'));
        throw new Error('File parsing not yet implemented');
      }

      console.log(chalk.green('✓ Transcript event added successfully'));
      console.log(chalk.white(`Text: ${options.text}`));
      console.log(chalk.white(`Speaker: ${options.speaker || 'Unknown'}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Upload transcript file command
transcriptCommand
  .command('upload')
  .description('Upload a transcript file')
  .requiredOption('-f, --file <file>', 'Transcript file path')
  .requiredOption('-m, --meeting-id <id>', 'Meeting ID')
  .option('-s, --source <source>', 'Source type', 'upload')
  .option('-p, --format <format>', 'File format (json, txt)', 'txt')
  .option('--chunk-strategy <strategy>', 'Chunking strategy (fixed, semantic)', 'fixed')
  .option('--chunk-size <tokens>', 'Chunk size (tokens)', '500')
  .option('--overlap <tokens>', 'Chunk overlap (tokens)', '50')
  .action(async (options) => {
    try {
      const filePath = resolve(options.file);
      const content = await readFile(filePath, 'utf-8');

      // Parse content based on format
      let processedContent = content;
      if (options.format === 'json') {
        try {
          const jsonData = JSON.parse(content);
          // If it's an array of {speaker, text}, format it
          if (Array.isArray(jsonData)) {
            processedContent = jsonData
              .map((item: any) => {
                const speaker = item.speaker || 'Unknown';
                const text = item.text || '';
                return `[${speaker}]: ${text}`;
              })
              .join('\n');
          }
        } catch (e) {
          console.error(chalk.red('Error: Invalid JSON format'));
          throw new Error('Invalid JSON format');
        }
      }

      // Upload the transcript
      const transcript = await transcriptService.uploadTranscript({
        meetingId: options.meetingId,
        source: options.source,
        format: options.format,
        content: processedContent,
        metadata: {
          originalFile: options.file,
          uploadedAt: new Date().toISOString(),
        },
      });

      console.log(chalk.green('✓ Transcript uploaded successfully'));
      console.log(chalk.gray(`ID: ${transcript.id}`));
      console.log(chalk.white(`Format: ${transcript.format}`));
      console.log(chalk.white(`Source: ${transcript.source}`));
      console.log(chalk.white(`Size: ${content.length} characters`));
      
      // Auto-process into chunks
      console.log(chalk.blue('\nProcessing into chunks...'));
      const maxTokens = parseInt(options.chunkSize);
      const overlap = parseInt(options.overlap);
      const chunks = await transcriptService.processTranscript(transcript.id, {
        strategy: options.chunkStrategy as any,
        maxTokens: Number.isFinite(maxTokens) ? maxTokens : 500,
        overlap: Number.isFinite(overlap) ? overlap : 50,
      });

      console.log(chalk.green(`✓ Created ${chunks.length} chunks`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Process transcript command
transcriptCommand
  .command('process')
  .description('Process a transcript into chunks')
  .requiredOption('-t, --transcript-id <id>', 'Transcript ID')
  .option('-s, --strategy <strategy>', 'Chunking strategy (fixed, semantic, speaker)', 'fixed')
  .option('-c, --chunk-size <size>', 'Chunk size (tokens)', '500')
  .option('-o, --overlap <overlap>', 'Chunk overlap (tokens)', '50')
  .action(async (options) => {
    try {
      const chunkSize = parseInt(options.chunkSize);
      const overlap = parseInt(options.overlap);
      
      if (isNaN(chunkSize) || chunkSize < 100) {
        console.error(chalk.red('Error: Chunk size must be at least 100 tokens'));
        throw new Error('Invalid chunk size');
      }
      
      if (isNaN(overlap) || overlap < 0 || overlap >= chunkSize) {
        console.error(chalk.red('Error: Overlap must be between 0 and chunk size'));
        throw new Error('Invalid overlap');
      }

      console.log(chalk.blue(`Processing transcript ${options.transcriptId}...`));
      console.log(chalk.gray(`Strategy: ${options.strategy}`));
      console.log(chalk.gray(`Chunk size: ${chunkSize} tokens`));
      console.log(chalk.gray(`Overlap: ${overlap} tokens`));
      
      const chunks = await transcriptService.processTranscript(options.transcriptId, {
        strategy: options.strategy as any,
        maxTokens: chunkSize,
        overlap: overlap,
      });

      console.log(chalk.green(`\n✓ Processed into ${chunks.length} chunks`));
      
      // Show first few chunks as preview
      const previewCount = Math.min(3, chunks.length);
      console.log(chalk.blue('\nPreview:'));
      for (let i = 0; i < previewCount; i++) {
        const chunk = chunks[i];
        if (!chunk) continue; // Skip if chunk is undefined
        
        console.log(chalk.gray(`\nChunk ${i + 1} (${chunk.tokenCount} tokens):`));
        console.log(chalk.white(chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : '')));
      }
      
      if (chunks.length > previewCount) {
        console.log(chalk.gray(`\n... and ${chunks.length - previewCount} more chunks`));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Show transcript command
transcriptCommand
  .command('show <id>')
  .description('Show transcript details')
  .action(async (id) => {
    try {
      // Since getTranscript is not available, we'll show what we can
      console.log(chalk.white('Transcript Details:'));
      console.log('');
      console.log(chalk.gray(`ID: ${id}`));
      console.log(chalk.yellow('Note: Full transcript details not yet available in service'));
      
      // Show chunks for the meeting if available
      // TODO: Need to extract meeting ID from transcript or require it as parameter
      console.log('');
      console.log(chalk.yellow('Chunk viewing not yet implemented'));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });
