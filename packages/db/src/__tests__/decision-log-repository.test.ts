/**
 * Unit tests for Decision Log Repository
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
// Mock the client module
vi.mock("../client", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  client: {},
}));

// Import after mocking
import { DrizzleDecisionLogRepository } from "../repositories/decision-log-repository";
import type { CreateDecisionLog } from "@repo/schema";
import { db } from "../client";
import { decisionLogs } from "../schema";

// Mock drizzle operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(() => ({ mapWith: vi.fn() })),
}));

describe("DrizzleDecisionLogRepository", () => {
  let repository: DrizzleDecisionLogRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DrizzleDecisionLogRepository();
  });

  describe("create", () => {
    it("should create a decision log", async () => {
      const createData: CreateDecisionLog = {
        meetingId: "mtg_123",
        decisionContextId: "ctx_456",
        templateId: "tpl_789",
        templateVersion: 1,
        fields: { decision: "Approved" },
        decisionMethod: { type: "manual" },
        sourceChunkIds: ["chunk_1", "chunk_2"],
        loggedBy: "user_123",
      };

      const mockRow = {
        id: "log_123",
        meetingId: createData.meetingId,
        decisionContextId: createData.decisionContextId,
        templateId: createData.templateId,
        templateVersion: createData.templateVersion,
        fields: createData.fields,
        decisionMethod: createData.decisionMethod,
        sourceChunkIds: createData.sourceChunkIds,
        loggedAt: new Date(),
        loggedBy: createData.loggedBy,
      };

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRow]),
      };

      (db.insert as any).mockReturnValue(mockInsert);

      const result = await repository.create(createData);

      expect(db.insert).toHaveBeenCalledWith(decisionLogs);
      expect(mockInsert.values).toHaveBeenCalledWith({
        meetingId: createData.meetingId,
        decisionContextId: createData.decisionContextId,
        templateId: createData.templateId,
        templateVersion: createData.templateVersion,
        fields: createData.fields,
        decisionMethod: createData.decisionMethod,
        sourceChunkIds: createData.sourceChunkIds,
        loggedBy: createData.loggedBy,
      });
      expect(mockInsert.returning).toHaveBeenCalled();

      expect(result).toEqual({
        id: mockRow.id,
        meetingId: mockRow.meetingId,
        decisionContextId: mockRow.decisionContextId,
        templateId: mockRow.templateId,
        templateVersion: mockRow.templateVersion,
        fields: mockRow.fields,
        decisionMethod: mockRow.decisionMethod,
        sourceChunkIds: mockRow.sourceChunkIds,
        loggedAt: mockRow.loggedAt.toISOString(),
        loggedBy: mockRow.loggedBy,
      });
    });
  });

  describe("findById", () => {
    it("should find a decision log by ID", async () => {
      const mockRow = {
        id: "log_123",
        meetingId: "mtg_123",
        decisionContextId: "ctx_456",
        templateId: "tpl_789",
        templateVersion: 1,
        fields: { decision: "Approved" },
        decisionMethod: { type: "manual" },
        sourceChunkIds: ["chunk_1", "chunk_2"],
        loggedAt: new Date(),
        loggedBy: "user_123",
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRow]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await repository.findById("log_123");

      expect(db.select).toHaveBeenCalled();
      expect(mockSelect.from).toHaveBeenCalledWith(decisionLogs);
      expect(result).toEqual({
        id: mockRow.id,
        meetingId: mockRow.meetingId,
        decisionContextId: mockRow.decisionContextId,
        templateId: mockRow.templateId,
        templateVersion: mockRow.templateVersion,
        fields: mockRow.fields,
        decisionMethod: mockRow.decisionMethod,
        sourceChunkIds: mockRow.sourceChunkIds,
        loggedAt: mockRow.loggedAt.toISOString(),
        loggedBy: mockRow.loggedBy,
      });
    });

    it("should return null if decision log not found", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByMeetingId", () => {
    it("should find all decision logs for a meeting", async () => {
      const mockRows = [
        {
          id: "log_1",
          meetingId: "mtg_123",
          decisionContextId: "ctx_1",
          templateId: "tpl_789",
          templateVersion: 1,
          fields: { decision: "Approved" },
          decisionMethod: { type: "manual" },
          sourceChunkIds: [],
          loggedAt: new Date("2026-02-28T10:00:00Z"),
          loggedBy: "user_123",
        },
        {
          id: "log_2",
          meetingId: "mtg_123",
          decisionContextId: "ctx_2",
          templateId: "tpl_789",
          templateVersion: 1,
          fields: { decision: "Rejected" },
          decisionMethod: { type: "ai_assisted" },
          sourceChunkIds: ["chunk_1"],
          loggedAt: new Date("2026-02-28T11:00:00Z"),
          loggedBy: "user_456",
        },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockRows),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await repository.findByMeetingId("mtg_123");

      expect(result).toHaveLength(2);
      expect(result[0]!).toMatchObject({
        id: "log_1",
        meetingId: "mtg_123",
        decisionContextId: "ctx_1",
        fields: { decision: "Approved" },
        decisionMethod: { type: "manual" },
      });
    });
  });

  describe("findByDecisionContextId", () => {
    it("should find all decision logs for a decision context", async () => {
      const mockRow = {
        id: "log_123",
        meetingId: "mtg_123",
        decisionContextId: "ctx_456",
        templateId: "tpl_789",
        templateVersion: 1,
        fields: { decision: "Approved" },
        decisionMethod: { type: "manual" },
        sourceChunkIds: [],
        loggedAt: new Date(),
        loggedBy: "user_123",
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([mockRow]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await repository.findByDecisionContextId("ctx_456");

      expect(mockSelect.orderBy).toHaveBeenCalled();
      expect(result![0]!.decisionContextId).toBe("ctx_456");
    });
  });

  describe("findByLoggedBy", () => {
    it("should find all decision logs by a specific user", async () => {
      const mockRows = [
        {
          id: "log_1",
          meetingId: "mtg_123",
          decisionContextId: "ctx_1",
          templateId: "tpl_789",
          templateVersion: 1,
          fields: { decision: "Approved" },
          decisionMethod: { type: "manual" },
          sourceChunkIds: [],
          loggedAt: new Date(),
          loggedBy: "user_123",
        },
        {
          id: "log_2",
          meetingId: "mtg_456",
          decisionContextId: "ctx_2",
          templateId: "tpl_789",
          templateVersion: 1,
          fields: { decision: "Rejected" },
          decisionMethod: { type: "consensus" },
          sourceChunkIds: [],
          loggedAt: new Date(),
          loggedBy: "user_123",
        },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockRows),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await repository.findByLoggedBy("user_123");

      expect(result).toHaveLength(2);
      expect(result.every((log) => log.loggedBy === "user_123")).toBe(true);
    });
  });

  describe("findByDateRange", () => {
    it("should find decision logs within a date range", async () => {
      const startDate = new Date("2026-02-28T00:00:00Z");
      const endDate = new Date("2026-02-28T23:59:59Z");

      const mockRow = {
        id: "log_123",
        meetingId: "mtg_123",
        decisionContextId: "ctx_456",
        templateId: "tpl_789",
        templateVersion: 1,
        fields: { decision: "Approved" },
        decisionMethod: { type: "manual" },
        sourceChunkIds: [],
        loggedAt: new Date("2026-02-28T10:00:00Z"),
        loggedBy: "user_123",
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([mockRow]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await repository.findByDateRange(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0]!.loggedAt).toBe("2026-02-28T10:00:00.000Z");
    });
  });

  describe("countByMeetingId", () => {
    it("should count decision logs for a meeting", async () => {
      const mockSelect = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await repository.countByMeetingId("mtg_123");

      expect(result).toBe(5);
    });

    it("should return 0 if no decision logs found", async () => {
      const mockSelect = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await repository.countByMeetingId("mtg_123");

      expect(result).toBe(0);
    });
  });
});
