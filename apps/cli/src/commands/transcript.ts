import { Command } from 'commander';
import chalk from 'chalk';
import { createTranscriptService } from '@repo/core';

// Create service instance
const transcriptService = createTranscriptService();

export const transcriptCommand = new Command('transcript')
  .description('Transcript management commands');

// List transcripts command
transcriptCommand
  .command('list')
  .description('List all transcripts for a meeting')
  .option('-m, --meeting-id <id>', 'Meeting ID (required)')
  .action(async (options) => {
    try {
      if (!options.meetingId) {
        console.error(chalk.red('Error: --meeting-id is required'));
        throw new Error('--meeting-id is required');
      }

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
  .option('-p, --format <format>', 'File format', 'json')
  .action(async (_options) => {
    try {
      // TODO: Implement file upload
      console.error(chalk.red('Error: File upload not yet implemented'));
      throw new Error('File upload not yet implemented');
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
  .option('-s, --strategy <strategy>', 'Chunking strategy', 'fixed')
  .option('-c, --chunk-size <size>', 'Chunk size', '1000')
  .action(async (_options) => {
    try {
      // TODO: Implement transcript processing
      console.error(chalk.red('Error: Transcript processing not yet implemented'));
      throw new Error('Transcript processing not yet implemented');
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
