/**
 * Interface for MCP Server Repository
 * Manages MCP server configurations and status
 */

import type { MCPServer, CreateMCPServer, UpdateMCPServer } from "@repo/schema";

export interface IMCPServerRepository {
  // Basic CRUD operations
  create(data: CreateMCPServer): Promise<MCPServer>;
  findByName(name: string): Promise<MCPServer | null>;
  findAll(): Promise<MCPServer[]>;
  findByType(type: string): Promise<MCPServer[]>;
  findByStatus(status: string): Promise<MCPServer[]>;
  findActive(): Promise<MCPServer[]>;
  update(name: string, data: UpdateMCPServer): Promise<MCPServer | null>;
  delete(name: string): Promise<boolean>;

  // Status management
  updateStatus(name: string, status: "active" | "inactive" | "error"): Promise<boolean>;

  // Health check
  healthCheck(): Promise<Record<string, boolean>>;
}
