/**
 * Service for exporting decision drafts to markdown format
 */

import { IDecisionContextRepository } from '../interfaces/i-decision-context-repository';
import { IDecisionTemplateRepository } from '../interfaces/i-decision-template-repository';
import { ITemplateFieldAssignmentRepository } from '../interfaces/i-decision-template-repository';
import { IDecisionFieldRepository } from '../interfaces/i-decision-field-repository';
import { IMeetingRepository } from '../interfaces/i-meeting-repository';
import type { TemplateFieldAssignment, DecisionField } from '@repo/schema';

export interface MarkdownExportOptions {
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  includeParticipants?: boolean;
  fieldOrder?: 'template' | 'alphabetical';
  lockedFieldIndicator?: 'prefix' | 'suffix' | 'none';
}

export class MarkdownExportService {
  constructor(
    private contextRepo: IDecisionContextRepository,
    private templateRepo: IDecisionTemplateRepository,
    private fieldAssignmentRepo: ITemplateFieldAssignmentRepository,
    private fieldRepo: IDecisionFieldRepository,
    private meetingRepo: IMeetingRepository
  ) {}

  /**
   * Export a decision context to markdown format
   */
  async exportToMarkdown(
    contextId: string,
    options: MarkdownExportOptions = {}
  ): Promise<string> {
    const {
      includeMetadata = true,
      includeTimestamps = true,
      includeParticipants = true,
      fieldOrder = 'template',
      lockedFieldIndicator = 'prefix'
    } = options;

    // Fetch all necessary data
    const context = await this.contextRepo.findById(contextId);
    if (!context) {
      throw new Error('Decision context not found');
    }

    const template = await this.templateRepo.findById(context.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const meeting = await this.meetingRepo.findById(context.meetingId);
    const fieldAssignments = await this.fieldAssignmentRepo.findByTemplateId(template.id);
    
    // Get field details
    const fields = new Map<string, DecisionField>();
    for (const assignment of fieldAssignments) {
      const field = await this.fieldRepo.findById(assignment.fieldId);
      if (field) {
        fields.set(field.id, field);
      }
    }

    // Build markdown
    let markdown = '';

    // Header with decision title
    const title = context.draftData?.decision_statement || 'Untitled Decision';
    markdown += `# Decision: ${title}\n\n`;

    // Metadata section
    if (includeMetadata) {
      markdown += '---\n\n';
      
      if (meeting) {
        markdown += `**Meeting:** ${meeting.title}\n`;
        if (includeParticipants && meeting.participants.length > 0) {
          markdown += `**Participants:** ${meeting.participants.join(', ')}\n`;
        }
      }
      
      if (includeTimestamps) {
        markdown += `**Created:** ${new Date(context.createdAt).toLocaleString()}\n`;
        markdown += `**Updated:** ${new Date(context.updatedAt).toLocaleString()}\n`;
      }
      
      markdown += `**Decision ID:** ${context.id}\n`;
      markdown += `\n---\n\n`;
    }

    // Sort fields according to option
    let sortedFields: Array<{ field: DecisionField; assignment: TemplateFieldAssignment }> = [];
    for (const assignment of fieldAssignments) {
      const field = fields.get(assignment.fieldId);
      if (field) {
        sortedFields.push({ field, assignment });
      }
    }

    if (fieldOrder === 'alphabetical') {
      sortedFields.sort((a, b) => a.field.name.localeCompare(b.field.name));
    } else {
      // Keep template order
      sortedFields.sort((a, b) => a.assignment.order - b.assignment.order);
    }

    // Fields section
    const draftData = context.draftData || {};
    const lockedFields = context.lockedFields || [];

    for (const { field } of sortedFields) {
      const value = draftData[field.id] || '';
      const isLocked = lockedFields.includes(field.id);
      
      // Field name with lock indicator
      let fieldName = field.name;
      if (isLocked && lockedFieldIndicator === 'prefix') {
        fieldName = `[LOCKED] ${fieldName}`;
      } else if (isLocked && lockedFieldIndicator === 'suffix') {
        fieldName = `${fieldName} [LOCKED]`;
      }
      
      markdown += `## ${fieldName}\n\n`;
      
      // Field value
      if (value) {
        // Format based on field type
        if (field.fieldType === 'textarea') {
          markdown += `${value}\n\n`;
        } else if (field.fieldType === 'multiselect') {
          const items = Array.isArray(value) ? value : value.split('\n').filter(Boolean);
          for (const item of items) {
            markdown += `- ${item}\n`;
          }
          markdown += '\n';
        } else {
          markdown += `${value}\n\n`;
        }
      } else {
        markdown += `*${field.description || 'No value provided'}*\n\n`;
      }
    }

    // Footer metadata
    if (includeMetadata) {
      markdown += '---\n\n';
      markdown += `*Exported from Decision Logger on ${new Date().toLocaleString()}*\n`;
      
      if (template) {
        markdown += `*Template: ${template.name}*\n`;
      }
      
      if (context.flaggedDecisionId) {
        markdown += `*Flagged Decision ID: ${context.flaggedDecisionId}*\n`;
      }
    }

    return markdown;
  }

  /**
   * Export multiple decision contexts to a single markdown file
   */
  async exportMultipleToMarkdown(
    contextIds: string[],
    options: MarkdownExportOptions = {}
  ): Promise<string> {
    const sections: string[] = [];
    
    for (const contextId of contextIds) {
      const markdown = await this.exportToMarkdown(contextId, options);
      sections.push(markdown);
      
      // Add separator between decisions
      if (contextIds.length > 1 && contextId !== contextIds[contextIds.length - 1]) {
        sections.push('\n\n---\n\n# --- Next Decision ---\n\n');
      }
    }
    
    return sections.join('');
  }
}
