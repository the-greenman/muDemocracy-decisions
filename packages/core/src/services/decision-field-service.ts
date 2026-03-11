/**
 * Decision Field Service
 * Manages the field library with extraction prompts and validation rules
 */

import type { DecisionField, CreateDecisionField } from "@repo/schema";
import type { IDecisionFieldService } from "../interfaces/i-decision-field-service";
import type {
  IDecisionFieldRepository,
  DecisionFieldIdentityLookup,
} from "../interfaces/i-decision-field-repository";

export class DecisionFieldService implements IDecisionFieldService {
  constructor(private repository: IDecisionFieldRepository) {}

  async createField(data: CreateDecisionField): Promise<DecisionField> {
    // Validate field definition
    const isValid = await this.validateFieldDefinition(data);
    if (!isValid) {
      throw new Error("Invalid field definition");
    }

    const field = await this.repository.create(data);
    return field;
  }

  async getField(id: string): Promise<DecisionField | null> {
    const field = await this.repository.findById(id);
    return field;
  }

  async getFieldByIdentity(identity: DecisionFieldIdentityLookup): Promise<DecisionField | null> {
    const field = await this.repository.findByIdentity(identity);
    return field;
  }

  async getAllFields(): Promise<DecisionField[]> {
    const fields = await this.repository.findAll();
    return fields;
  }

  async getFieldsByCategory(category: string): Promise<DecisionField[]> {
    const fields = await this.repository.findByCategory(category);
    return fields;
  }

  async getFieldsByType(type: string): Promise<DecisionField[]> {
    const fields = await this.repository.findByType(type);
    return fields;
  }

  async updateField(id: string, data: Partial<CreateDecisionField>): Promise<DecisionField | null> {
    const existingField = await this.repository.findById(id);
    if (!existingField) {
      return null;
    }

    const updatedData = { ...existingField, ...data };
    const isValid = await this.validateFieldDefinition(updatedData);
    if (!isValid) {
      throw new Error("Invalid field definition");
    }

    const field = await this.repository.update(id, data);
    return field;
  }

  async deleteField(id: string): Promise<boolean> {
    const existingField = await this.repository.findById(id);
    if (!existingField) {
      return false;
    }

    const success = await this.repository.delete(id);
    return success;
  }

  async searchFields(query: string): Promise<DecisionField[]> {
    const fields = await this.repository.search(query);
    return fields;
  }

  async getFieldCategories(): Promise<string[]> {
    const fields = await this.repository.findAll();
    const categories = [...new Set(fields.map((f) => f.category))].sort();
    return categories;
  }

  async getFieldTypes(): Promise<string[]> {
    const fields = await this.repository.findAll();
    const types = [...new Set(fields.map((f) => f.fieldType))].sort();
    return types;
  }

  async seedFields(fields: CreateDecisionField[]): Promise<DecisionField[]> {
    const createdFields = await this.repository.createMany(fields);
    return createdFields;
  }

  async validateFieldDefinition(field: CreateDecisionField): Promise<boolean> {
    if (!field.name?.trim()) {
      return false;
    }

    if (!field.description?.trim()) {
      return false;
    }

    if (!field.category?.trim()) {
      return false;
    }

    if (!field.fieldType?.trim()) {
      return false;
    }

    // Validate fieldType is one of the allowed values
    const validFieldTypes = ["text", "textarea", "select", "multiselect", "number", "date", "url"];
    if (!validFieldTypes.includes(field.fieldType)) {
      return false;
    }

    if (field.extractionPrompt && !field.extractionPrompt.trim()) {
      return false;
    }

    if (field.validationRules) {
      try {
        JSON.parse(JSON.stringify(field.validationRules));
      } catch {
        return false;
      }
    }

    return true;
  }

  async getValidationSchema(fieldId: string): Promise<any> {
    const field = await this.repository.findById(fieldId);
    if (!field) {
      return null;
    }

    const schema: any = {
      type: field.fieldType,
      required: true,
    };

    // Add field-specific validation
    if (field.validationRules) {
      schema.rules = field.validationRules;
    }

    // Add placeholder if available
    if (field.placeholder) {
      schema.placeholder = field.placeholder;
    }

    // Add description for context
    if (field.description) {
      schema.description = field.description;
    }

    return schema;
  }
}
