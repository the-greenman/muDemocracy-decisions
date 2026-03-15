import { describe, expect, it } from "vitest";
import {
  CORE_TEMPLATES,
  prepareDefaultExportTemplatesForSeeding,
} from "../seed-data/decision-templates";

describe("export-template seed data", () => {
  it("derives a default export template for every core deliberation template", () => {
    const exportTemplates = prepareDefaultExportTemplatesForSeeding();

    expect(exportTemplates).toHaveLength(CORE_TEMPLATES.length);
    for (const exportTemplate of exportTemplates) {
      expect(exportTemplate.fields.length).toBeGreaterThan(0);
      expect(exportTemplate.name).toContain("Default Export");
    }
  });

  it("keeps derived export-template fields as an ordered subset of the parent deliberation template", () => {
    const exportTemplates = prepareDefaultExportTemplatesForSeeding();
    const parentByIdentity = new Map(
      CORE_TEMPLATES.map((template) => [
        `${template.namespace}:${template.name}`,
        template,
      ]),
    );

    for (const exportTemplate of exportTemplates) {
      const parent = parentByIdentity.get(`${exportTemplate.namespace}:${exportTemplate.name.replace(/ Default Export$/, "")}`);
      expect(parent).toBeDefined();
      const parentFieldIds = new Set(parent?.fields.map((field) => field.fieldId));

      exportTemplate.fields.forEach((field, index) => {
        expect(parentFieldIds.has(field.fieldId)).toBe(true);
        expect(field.order).toBe(index);
      });
    }
  });
});
