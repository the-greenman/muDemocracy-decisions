#!/usr/bin/env tsx
/**
 * Export OpenAPI spec to YAML
 *
 * This script generates the openapi.yaml file from the Hono OpenAPI app.
 */

import fs from "fs";
import path from "path";
import app from "../src/index";

async function exportOpenAPI() {
  // Create a test request to get the OpenAPI spec
  const req = new Request("http://localhost/openapi.json");
  const res = await app.fetch(req);

  if (!res.ok) {
    console.error("Failed to fetch OpenAPI spec:", res.status);
    process.exit(1);
  }

  const spec = await res.json();

  // Convert to YAML
  const yaml = jsonToYaml(spec);

  // Write to file
  const outputPath = path.join(process.cwd(), "openapi.yaml");
  fs.writeFileSync(outputPath, yaml, "utf-8");

  console.log(`✓ OpenAPI spec exported to ${outputPath}`);
}

function jsonToYaml(obj: any, indent = 0): string {
  const spaces = "  ".repeat(indent);
  let yaml = "";

  if (typeof obj === "object" && obj !== null) {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === "object" && item !== null) {
          yaml += `${spaces}-\n`;
          yaml += jsonToYaml(item, indent + 1);
        } else {
          yaml += `${spaces}- ${formatValue(item)}\n`;
        }
      }
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "object" && value !== null) {
          yaml += `${spaces}${key}:\n`;
          yaml += jsonToYaml(value, indent + 1);
        } else {
          yaml += `${spaces}${key}: ${formatValue(value)}\n`;
        }
      }
    }
  }

  return yaml;
}

function formatValue(value: any): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    // Quote strings that need it
    if (value.includes(":") || value.includes("#") || value.includes("\n") || value.includes('"')) {
      return JSON.stringify(value);
    }
    return value;
  }
  return String(value);
}

exportOpenAPI().catch(console.error);
