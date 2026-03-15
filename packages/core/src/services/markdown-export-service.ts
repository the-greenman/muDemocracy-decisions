/**
 * Service for exporting decision drafts to markdown format
 */

import { IDecisionContextRepository } from "../interfaces/i-decision-context-repository.js";
import { IDecisionTemplateRepository } from "../interfaces/i-decision-template-repository.js";
import { ITemplateFieldAssignmentRepository } from "../interfaces/i-decision-template-repository.js";
import { IDecisionFieldRepository } from "../interfaces/i-decision-field-repository.js";
import { IMeetingRepository } from "../interfaces/i-meeting-repository.js";
import type { IExportTemplateService } from "../interfaces/i-export-template-service.js";
import type {
  TemplateFieldAssignment,
  DecisionField,
  ExportTemplateFieldAssignment,
} from "@repo/schema";

const FIELD_META_KEY = "__fieldMeta";

type FieldMetaRecord = Record<string, { manuallyEdited?: boolean }>;

export interface MarkdownExportOptions {
  exportTemplateId?: string;
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  includeParticipants?: boolean;
  fieldOrder?: "template" | "alphabetical";
  lockedFieldIndicator?: "prefix" | "suffix" | "none";
}

export class MarkdownExportService {
  constructor(
    private contextRepo: IDecisionContextRepository,
    private templateRepo: IDecisionTemplateRepository,
    private fieldAssignmentRepo: ITemplateFieldAssignmentRepository,
    private fieldRepo: IDecisionFieldRepository,
    private meetingRepo: IMeetingRepository,
    private exportTemplateService: IExportTemplateService,
  ) {}

  /**
   * Export a decision context to markdown format
   */
  async exportToMarkdown(contextId: string, options: MarkdownExportOptions = {}): Promise<string> {
    const {
      exportTemplateId,
      includeMetadata = true,
      includeTimestamps = true,
      includeParticipants = true,
      fieldOrder = "template",
    } = options;

    // Fetch all necessary data
    const context = await this.contextRepo.findById(contextId);
    if (!context) {
      throw new Error("Decision context not found");
    }

    const template = await this.templateRepo.findById(context.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const meeting = await this.meetingRepo.findById(context.meetingId);
    const fieldAssignments = await this.fieldAssignmentRepo.findByTemplateId(template.id);
    const exportTemplate = exportTemplateId
      ? await this.exportTemplateService.getExportTemplate(template.id, exportTemplateId)
      : await this.exportTemplateService.getDefaultExportTemplate(template.id);
    const exportAssignmentsByFieldId = new Map<string, ExportTemplateFieldAssignment>(
      exportTemplate.fields.map((assignment) => [assignment.fieldId, assignment]),
    );

    // Get field details
    const fields = new Map<string, DecisionField>();
    for (const assignment of fieldAssignments) {
      const field = await this.fieldRepo.findById(assignment.fieldId);
      if (field) {
        fields.set(field.id, field);
      }
    }

    // Sort fields according to option
    let sortedFields: Array<{
      field: DecisionField;
      assignment: TemplateFieldAssignment;
      exportAssignment?: ExportTemplateFieldAssignment;
    }> = [];
    for (const assignment of fieldAssignments) {
      const field = fields.get(assignment.fieldId);
      const exportAssignment = exportAssignmentsByFieldId.get(assignment.fieldId);
      if (field && exportAssignment) {
        sortedFields.push({ field, assignment, exportAssignment });
      }
    }

    if (fieldOrder === "alphabetical") {
      sortedFields.sort((a, b) =>
        this.formatFieldHeading(a.field.name, a.exportAssignment?.title).localeCompare(
          this.formatFieldHeading(b.field.name, b.exportAssignment?.title),
        ),
      );
    } else {
      sortedFields.sort((a, b) => {
        const left = a.exportAssignment;
        const right = b.exportAssignment;
        if (!left || !right) {
          return 0;
        }
        return left.order - right.order;
      });
    }

    // Fields section
    const draftData = context.draftData || {};
    const fieldMeta = this.getFieldMeta(draftData);

    // Build markdown
    let markdown = "";

    // Header with decision title (prefer explicit context title, then derived statement)
    const title =
      this.resolveDecisionTitle(context.title, draftData, sortedFields) || "Untitled Decision";
    markdown += `# Decision: ${title}\n\n`;

    // Metadata section
    if (includeMetadata) {
      markdown += "---\n\n";

      if (meeting) {
        markdown += `**Meeting:** ${meeting.title}\n`;
        if (includeParticipants && meeting.participants.length > 0) {
          markdown += `**Participants:** ${meeting.participants.join(", ")}\n`;
        }
      }

      if (includeTimestamps) {
        markdown += `**Created:** ${new Date(context.createdAt).toLocaleString()}\n`;
        markdown += `**Updated:** ${new Date(context.updatedAt).toLocaleString()}\n`;
      }

      markdown += `**Decision ID:** ${context.id}\n`;
      markdown += `\n---\n\n`;
    }

    for (const { field, exportAssignment } of sortedFields) {
      const value = draftData[field.id] || "";
      const isManuallyEdited = fieldMeta[field.id]?.manuallyEdited === true;

      // Field name
      let fieldName = this.formatFieldHeading(field.name, exportAssignment?.title);
      if (isManuallyEdited) {
        fieldName = `[MANUALLY EDITED] ${fieldName}`;
      }

      markdown += `## ${fieldName}\n\n`;

      // Field value
      if (value) {
        // Format based on field type
        if (field.fieldType === "textarea") {
          markdown += `${value}\n\n`;
        } else if (field.fieldType === "multiselect") {
          const items = Array.isArray(value) ? value : value.split("\n").filter(Boolean);
          for (const item of items) {
            markdown += `- ${item}\n`;
          }
          markdown += "\n";
        } else {
          markdown += `${value}\n\n`;
        }
      } else {
        markdown += `*${field.description || "No value provided"}*\n\n`;
      }
    }

    // Footer metadata
    if (includeMetadata) {
      markdown += "---\n\n";
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

  private getFieldMeta(draftData: Record<string, unknown>): FieldMetaRecord {
    const meta = draftData[FIELD_META_KEY];
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      return {};
    }

    return meta as FieldMetaRecord;
  }

  private resolveDecisionTitle(
    contextTitle: string | undefined,
    draftData: Record<string, unknown>,
    sortedFields: Array<{
      field: DecisionField;
      assignment: TemplateFieldAssignment;
      exportAssignment?: ExportTemplateFieldAssignment;
    }>,
  ): string | null {
    if (typeof contextTitle === "string" && contextTitle.trim().length > 0) {
      return contextTitle.trim();
    }

    const decisionStatementField = sortedFields.find(
      ({ field }) => field.name === "decision_statement",
    );
    if (!decisionStatementField) {
      return null;
    }

    const value = draftData[decisionStatementField.field.id];
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private formatFieldHeading(fieldName: string, exportTitle?: string): string {
    const base = typeof exportTitle === "string" && exportTitle.trim().length > 0 ? exportTitle : fieldName;

    return base
      .split("_")
      .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
      .join(" ");
  }

  /**
   * Export multiple decision contexts to a single markdown file
   */
  async exportMultipleToMarkdown(
    contextIds: string[],
    options: MarkdownExportOptions = {},
  ): Promise<string> {
    const sections: string[] = [];

    for (const contextId of contextIds) {
      const markdown = await this.exportToMarkdown(contextId, options);
      sections.push(markdown);

      // Add separator between decisions
      if (contextIds.length > 1 && contextId !== contextIds[contextIds.length - 1]) {
        sections.push("\n\n---\n\n# --- Next Decision ---\n\n");
      }
    }

    return sections.join("");
  }
}
