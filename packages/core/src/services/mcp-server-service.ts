/**
 * MCP Server Service
 * Manages MCP server configurations and status
 */

import type { MCPServer, CreateMCPServer, UpdateMCPServer } from "@repo/schema";
import type { IMCPServerRepository } from "../interfaces/i-mcp-server-repository.js";
import { logger } from "../logger/index.js";

export interface IMCPServerService {
  // Basic CRUD operations
  createServer(data: CreateMCPServer): Promise<MCPServer>;
  getServer(name: string): Promise<MCPServer | null>;
  getAllServers(): Promise<MCPServer[]>;
  getServersByType(type: string): Promise<MCPServer[]>;
  getServersByStatus(status: string): Promise<MCPServer[]>;
  getActiveServers(): Promise<MCPServer[]>;
  updateServer(name: string, data: UpdateMCPServer): Promise<MCPServer | null>;
  deleteServer(name: string): Promise<boolean>;

  // Status management
  updateServerStatus(name: string, status: "active" | "inactive" | "error"): Promise<boolean>;

  // Health check
  performHealthCheck(): Promise<Record<string, boolean>>;

  // Validation
  validateServer(server: CreateMCPServer): Promise<{ isValid: boolean; errors: string[] }>;
}

export class MCPServerService implements IMCPServerService {
  constructor(private repository: IMCPServerRepository) {}

  async createServer(data: CreateMCPServer): Promise<MCPServer> {
    logger.info("Creating MCP server", { name: data.name, type: data.type });

    // Validate the server
    const validation = await this.validateServer(data);
    if (!validation.isValid) {
      throw new Error(`Invalid server: ${validation.errors.join(", ")}`);
    }

    // Check if server already exists
    const existing = await this.repository.findByName(data.name);
    if (existing) {
      throw new Error(`MCP server with name '${data.name}' already exists`);
    }

    const server = await this.repository.create(data);
    logger.info("MCP server created successfully", { name: server.name });

    return server;
  }

  async getServer(name: string): Promise<MCPServer | null> {
    logger.debug("Getting MCP server", { name });
    return await this.repository.findByName(name);
  }

  async getAllServers(): Promise<MCPServer[]> {
    logger.debug("Getting all MCP servers");
    return await this.repository.findAll();
  }

  async getServersByType(type: string): Promise<MCPServer[]> {
    logger.debug("Getting MCP servers by type", { type });
    return await this.repository.findByType(type);
  }

  async getServersByStatus(status: string): Promise<MCPServer[]> {
    logger.debug("Getting MCP servers by status", { status });
    return await this.repository.findByStatus(status);
  }

  async getActiveServers(): Promise<MCPServer[]> {
    logger.debug("Getting active MCP servers");
    return await this.repository.findActive();
  }

  async updateServer(name: string, data: UpdateMCPServer): Promise<MCPServer | null> {
    logger.info("Updating MCP server", { name });

    const existing = await this.repository.findByName(name);
    if (!existing) {
      logger.warn("MCP server not found for update", { name });
      return null;
    }

    // Validate update data
    if (data.name && data.name !== name) {
      throw new Error("Cannot change MCP server name");
    }

    const updated = await this.repository.update(name, data);
    if (updated) {
      logger.info("MCP server updated successfully", { name });
    }

    return updated;
  }

  async deleteServer(name: string): Promise<boolean> {
    logger.info("Deleting MCP server", { name });

    const existing = await this.repository.findByName(name);
    if (!existing) {
      logger.warn("MCP server not found for deletion", { name });
      return false;
    }

    const deleted = await this.repository.delete(name);
    if (deleted) {
      logger.info("MCP server deleted successfully", { name });
    }

    return deleted;
  }

  async updateServerStatus(
    name: string,
    status: "active" | "inactive" | "error",
  ): Promise<boolean> {
    logger.info("Updating MCP server status", { name, status });

    const existing = await this.repository.findByName(name);
    if (!existing) {
      logger.warn("MCP server not found for status update", { name });
      return false;
    }

    const updated = await this.repository.updateStatus(name, status);
    if (updated) {
      logger.info("MCP server status updated successfully", { name, status });
    }

    return updated;
  }

  async performHealthCheck(): Promise<Record<string, boolean>> {
    logger.debug("Performing MCP server health check");

    const health = await this.repository.healthCheck();

    // Log any unhealthy servers
    for (const [server, isHealthy] of Object.entries(health)) {
      if (!isHealthy) {
        logger.warn("MCP server health check failed", { server });
      }
    }

    return health;
  }

  async validateServer(server: CreateMCPServer): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Name validation
    if (!server.name || server.name.trim().length === 0) {
      errors.push("Name is required");
    } else if (!/^[a-zA-Z0-9_-]+$/.test(server.name)) {
      errors.push("Name can only contain letters, numbers, hyphens, and underscores");
    }

    // Type validation
    if (!server.type || !["stdio", "http", "sse"].includes(server.type)) {
      errors.push("Type must be one of: stdio, http, sse");
    }

    // Connection config validation
    if (!server.connectionConfig || typeof server.connectionConfig !== "object") {
      errors.push("Connection config is required and must be an object");
    } else {
      // Type-specific validation
      if (server.type === "stdio") {
        if (!server.connectionConfig.command) {
          errors.push("STDIO servers require a command in connection config");
        }
      } else if (server.type === "http") {
        if (!server.connectionConfig.url) {
          errors.push("HTTP servers require a URL in connection config");
        }
      }
    }

    // Capabilities validation if provided
    if (server.capabilities) {
      if (typeof server.capabilities !== "object") {
        errors.push("Capabilities must be an object");
      } else {
        if (server.capabilities.tools && !Array.isArray(server.capabilities.tools)) {
          errors.push("Capabilities.tools must be an array");
        }
        if (server.capabilities.resources && !Array.isArray(server.capabilities.resources)) {
          errors.push("Capabilities.resources must be an array");
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
