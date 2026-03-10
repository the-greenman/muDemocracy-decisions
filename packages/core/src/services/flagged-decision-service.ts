/**
 * Service for managing flagged decisions
 * Implements business logic and validation
 */

import type { IFlaggedDecisionService } from '../interfaces/i-flagged-decision-service';
import type { IFlaggedDecisionRepository } from '../interfaces/i-flagged-decision-repository';
import type { ITranscriptChunkRepository } from '../interfaces/transcript-repositories';
import type { FlaggedDecision, CreateFlaggedDecision } from '@repo/schema';

export class FlaggedDecisionService implements IFlaggedDecisionService {
  constructor(
    private repository: IFlaggedDecisionRepository,
    private transcriptChunkRepository?: ITranscriptChunkRepository,
  ) {}

  async createFlaggedDecision(data: CreateFlaggedDecision): Promise<FlaggedDecision> {
    // Validate confidence is between 0 and 1
    if (data.confidence < 0 || data.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    // Create the flagged decision
    return await this.repository.create(data);
  }

  async getDecisionsForMeeting(meetingId: string): Promise<FlaggedDecision[]> {
    return await this.repository.findByMeetingId(meetingId);
  }

  async getDecisionById(id: string): Promise<FlaggedDecision | null> {
    return await this.repository.findById(id);
  }

  async updateDecision(
    id: string,
    data: {
      suggestedTitle?: string;
      contextSummary?: string;
      status?: FlaggedDecision['status'];
      priority?: number;
      chunkIds?: string[];
    }
  ): Promise<FlaggedDecision | null> {
    // Check if decision exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error('Decision not found');
    }

    const updateData: Partial<FlaggedDecision> = {};
    if (data.suggestedTitle !== undefined) {
      updateData.suggestedTitle = data.suggestedTitle;
    }
    if (data.contextSummary !== undefined) {
      updateData.contextSummary = data.contextSummary;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority;
    }
    if (data.chunkIds !== undefined) {
      updateData.chunkIds = data.chunkIds;
    }

    return await this.repository.update(id, updateData);
  }

  async resolveChunkIdsFromSequenceSpec(meetingId: string, segmentSpec: string): Promise<string[]> {
    if (!this.transcriptChunkRepository) {
      throw new Error('Transcript chunk repository is required to resolve segment selections');
    }

    const normalizedSpec = segmentSpec.trim().toLowerCase();
    const chunks = await this.transcriptChunkRepository.findByMeetingId(meetingId);

    if (normalizedSpec === 'all') {
      return chunks.map((chunk) => chunk.id);
    }

    const chunksBySequence = new Map(chunks.map((chunk) => [chunk.sequenceNumber, chunk.id]));
    const selectedChunkIds: string[] = [];
    const seenChunkIds = new Set<string>();

    for (const part of segmentSpec.split(',').map((value) => value.trim()).filter(Boolean)) {
      const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
      if (rangeMatch) {
        const start = Number.parseInt(rangeMatch[1] ?? '', 10);
        const end = Number.parseInt(rangeMatch[2] ?? '', 10);

        if (end < start) {
          throw new Error(`Segment range cannot be descending: ${part}`);
        }

        for (let sequence = start; sequence <= end; sequence += 1) {
          const chunkId = chunksBySequence.get(sequence);
          if (!chunkId) {
            throw new Error(`No transcript chunk found for sequence number ${sequence}`);
          }
          if (!seenChunkIds.has(chunkId)) {
            seenChunkIds.add(chunkId);
            selectedChunkIds.push(chunkId);
          }
        }
        continue;
      }

      if (/^\d+$/.test(part)) {
        const sequence = Number.parseInt(part, 10);
        const chunkId = chunksBySequence.get(sequence);
        if (!chunkId) {
          throw new Error(`No transcript chunk found for sequence number ${sequence}`);
        }
        if (!seenChunkIds.has(chunkId)) {
          seenChunkIds.add(chunkId);
          selectedChunkIds.push(chunkId);
        }
        continue;
      }

      throw new Error(`Invalid segment range format: ${part}`);
    }

    if (selectedChunkIds.length === 0) {
      throw new Error('At least one segment must be selected');
    }

    return selectedChunkIds;
  }

  async updateDecisionStatus(
    decisionId: string,
    status: FlaggedDecision['status']
  ): Promise<FlaggedDecision> {
    // Check if decision exists
    const existing = await this.repository.findById(decisionId);
    if (!existing) {
      throw new Error('Decision not found');
    }

    // Update the status
    const updated = await this.repository.updateStatus(decisionId, status);
    if (!updated) {
      throw new Error('Failed to update decision status');
    }

    return updated;
  }

  async updateDecisionPriority(decisionId: string, priority: number): Promise<void> {
    // Validate priority
    if (priority < 1 || priority > 5) {
      throw new Error('Priority must be between 1 and 5');
    }

    // Check if decision exists
    const existing = await this.repository.findById(decisionId);
    if (!existing) {
      throw new Error('Decision not found');
    }

    // Update priority
    const updated = await this.repository.updatePriority(decisionId, priority);
    if (!updated) {
      throw new Error(`Failed to update priority for decision ${decisionId}`);
    }
  }

  async prioritizeDecisions(
    decisionIds: string[],
    priorities: number[]
  ): Promise<void> {
    // Validate input arrays match
    if (decisionIds.length !== priorities.length) {
      throw new Error('Decision IDs and priorities must have the same length');
    }

    // Update each decision's priority
    for (let i = 0; i < decisionIds.length; i++) {
      const decisionId = decisionIds[i];
      const priority = priorities[i];
      if (decisionId === undefined || priority === undefined) {
        throw new Error('Decision IDs and priorities must have the same length');
      }

      // Check if decision exists
      const existing = await this.repository.findById(decisionId);
      if (!existing) {
        throw new Error(`Decision with ID ${decisionId} not found`);
      }

      // Update priority
      const updated = await this.repository.updatePriority(decisionId, priority);
      if (!updated) {
        throw new Error(`Failed to update priority for decision ${decisionId}`);
      }
    }
  }

  async deleteDecision(id: string): Promise<boolean> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return false;
    }

    return this.repository.delete(id);
  }
}
