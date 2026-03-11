/**
 * Unit tests for Expert and MCP Repositories
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DrizzleExpertTemplateRepository,
  DrizzleMCPServerRepository,
  DrizzleExpertAdviceHistoryRepository,
} from "../repositories/expert-mcp-repository";
import { db } from "../client";
import type {
  CreateExpertTemplate,
  UpdateExpertTemplate,
  CreateMCPServer,
  CreateExpertAdvice,
} from "@repo/core";

// Mock the database
vi.mock("../client", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
  },
}));

describe("DrizzleExpertTemplateRepository", () => {
  let repository: DrizzleExpertTemplateRepository;

  beforeEach(() => {
    repository = new DrizzleExpertTemplateRepository();
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create an expert template", async () => {
      const data: CreateExpertTemplate = {
        name: "Test Expert",
        type: "technical",
        promptTemplate: "You are a technical expert",
        mcpAccess: ["github"],
        isActive: true,
      };

      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440010",
        name: data.name,
        type: data.type,
        promptTemplate: data.promptTemplate,
        mcpAccess: data.mcpAccess,
        outputSchema: null,
        isActive: data.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockRow]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      vi.mocked(db.insert).mockImplementation(mockInsert as any);

      const result = await repository.create(data);

      expect(result).toEqual({
        id: mockRow.id,
        name: mockRow.name,
        type: mockRow.type,
        promptTemplate: mockRow.promptTemplate,
        mcpAccess: mockRow.mcpAccess,
        outputSchema: mockRow.outputSchema,
        isActive: mockRow.isActive,
        createdAt: mockRow.createdAt.toISOString(),
        updatedAt: mockRow.updatedAt.toISOString(),
      });
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe("findById", () => {
    it("should return an expert template by ID", async () => {
      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440010",
        name: "Test Expert",
        type: "technical",
        promptTemplate: "You are a technical expert",
        mcpAccess: ["github"],
        outputSchema: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockRow]),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await repository.findById("550e8400-e29b-41d4-a716-446655440010");

      expect(result).toEqual({
        id: mockRow.id,
        name: mockRow.name,
        type: mockRow.type,
        promptTemplate: mockRow.promptTemplate,
        mcpAccess: mockRow.mcpAccess,
        outputSchema: mockRow.outputSchema,
        isActive: mockRow.isActive,
        createdAt: mockRow.createdAt.toISOString(),
        updatedAt: mockRow.updatedAt.toISOString(),
      });
    });

    it("should return null if expert template not found", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await repository.findById("550e8400-e29b-41d4-a716-446655440999");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update an expert template", async () => {
      const updateData: UpdateExpertTemplate = {
        name: "Updated Expert",
        isActive: false,
      };

      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440010",
        name: updateData.name,
        type: "technical",
        promptTemplate: "You are a technical expert",
        mcpAccess: ["github"],
        outputSchema: null,
        isActive: updateData.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockRow]),
          }),
        }),
      });
      vi.mocked(db.update).mockImplementation(mockUpdate as any);

      const result = await repository.update("550e8400-e29b-41d4-a716-446655440010", updateData);

      expect(result).toEqual({
        id: mockRow.id,
        name: mockRow.name,
        type: mockRow.type,
        promptTemplate: mockRow.promptTemplate,
        mcpAccess: mockRow.mcpAccess,
        outputSchema: mockRow.outputSchema,
        isActive: mockRow.isActive,
        createdAt: mockRow.createdAt.toISOString(),
        updatedAt: mockRow.updatedAt.toISOString(),
      });
    });
  });

  describe("delete", () => {
    it("should delete an expert template", async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "550e8400-e29b-41d4-a716-446655440010" }]),
        }),
      });
      vi.mocked(db.delete).mockImplementation(mockDelete as any);

      const result = await repository.delete("550e8400-e29b-41d4-a716-446655440010");

      expect(result).toBe(true);
    });

    it("should return false if expert template not found", async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.delete).mockImplementation(mockDelete as any);

      const result = await repository.delete("550e8400-e29b-41d4-a716-446655440999");

      expect(result).toBe(false);
    });
  });
});

describe("DrizzleMCPServerRepository", () => {
  let repository: DrizzleMCPServerRepository;

  beforeEach(() => {
    repository = new DrizzleMCPServerRepository();
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create an MCP server", async () => {
      const data: CreateMCPServer = {
        name: "test-server",
        type: "stdio",
        connectionConfig: { command: "test-command" },
        status: "active",
        capabilities: { tools: ["test"] },
      };

      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440011",
        name: data.name,
        type: data.type,
        connectionConfig: data.connectionConfig,
        capabilities: data.capabilities,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRow]),
        }),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert as any);

      const result = await repository.create(data);

      expect(result).toEqual({
        id: mockRow.id,
        name: mockRow.name,
        type: mockRow.type,
        connectionConfig: mockRow.connectionConfig,
        capabilities: mockRow.capabilities,
        status: mockRow.status,
        createdAt: mockRow.createdAt.toISOString(),
        updatedAt: mockRow.updatedAt.toISOString(),
      });
    });
  });

  describe("findByName", () => {
    it("should return an MCP server by name", async () => {
      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440011",
        name: "test-server",
        type: "stdio",
        connectionConfig: { command: "test" },
        capabilities: { tools: ["test"] },
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockRow]),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await repository.findByName("test-server");

      expect(result).toEqual({
        id: mockRow.id,
        name: mockRow.name,
        type: mockRow.type,
        connectionConfig: mockRow.connectionConfig,
        capabilities: mockRow.capabilities,
        status: mockRow.status,
        createdAt: mockRow.createdAt.toISOString(),
        updatedAt: mockRow.updatedAt.toISOString(),
      });
    });
  });

  describe("updateStatus", () => {
    it("should update MCP server status", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ name: "test-server" }]),
          }),
        }),
      });
      vi.mocked(db.update).mockImplementation(mockUpdate as any);

      const result = await repository.updateStatus("test-server", "inactive");

      expect(result).toBe(true);
    });
  });
});

describe("DrizzleExpertAdviceHistoryRepository", () => {
  let repository: DrizzleExpertAdviceHistoryRepository;

  beforeEach(() => {
    repository = new DrizzleExpertAdviceHistoryRepository();
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create expert advice", async () => {
      const data: CreateExpertAdvice = {
        decisionContextId: "550e8400-e29b-41d4-a716-446655440004",
        expertId: "550e8400-e29b-41d4-a716-446655440010",
        expertName: "Test Expert",
        response: { suggestions: ["Test suggestion"] },
        request: "Test request",
      };

      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440012",
        decisionContextId: data.decisionContextId,
        expertId: data.expertId,
        expertName: data.expertName,
        request: data.request,
        response: data.response,
        mcpToolsUsed: null,
        requestedAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRow]),
        }),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert as any);

      const result = await repository.create(data);

      expect(result).toEqual({
        id: mockRow.id,
        decisionContextId: mockRow.decisionContextId,
        expertId: mockRow.expertId,
        expertName: mockRow.expertName,
        request: mockRow.request,
        response: mockRow.response,
        mcpToolsUsed: undefined,
        requestedAt: mockRow.requestedAt.toISOString(),
      });
    });
  });

  describe("findByDecisionContextId", () => {
    it("should return advice by decision context ID", async () => {
      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440012",
        decisionContextId: "550e8400-e29b-41d4-a716-446655440004",
        expertId: "550e8400-e29b-41d4-a716-446655440010",
        expertName: "Test Expert",
        request: "Test request",
        response: { suggestions: ["Test suggestion"] },
        mcpToolsUsed: null,
        requestedAt: new Date(),
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockRow]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await repository.findByDecisionContextId(
        "550e8400-e29b-41d4-a716-446655440004",
      );

      expect(result).toEqual([
        {
          id: mockRow.id,
          decisionContextId: mockRow.decisionContextId,
          expertId: mockRow.expertId,
          expertName: mockRow.expertName,
          request: mockRow.request,
          response: mockRow.response,
          mcpToolsUsed: undefined,
          requestedAt: mockRow.requestedAt.toISOString(),
        },
      ]);
    });
  });

  describe("getAdviceCountByExpert", () => {
    it("should return advice count by expert", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await repository.getAdviceCountByExpert(
        "550e8400-e29b-41d4-a716-446655440010",
      );

      expect(result).toBe(5);
    });

    it("should return 0 if no advice found", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await repository.getAdviceCountByExpert(
        "550e8400-e29b-41d4-a716-446655440010",
      );

      expect(result).toBe(0);
    });
  });
});
