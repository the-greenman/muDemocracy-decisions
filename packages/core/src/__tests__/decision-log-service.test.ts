/**
 * Unit tests for Decision Log Service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DecisionLogService } from "../services/decision-log-service";
import type {
  IDecisionLogRepository,
  IDecisionContextRepository,
  IDecisionTemplateRepository,
  ITemplateFieldAssignmentRepository,
  IChunkRelevanceRepository,
  DecisionLog,
  DecisionContext,
} from "@repo/core";
import { logger } from "../logger";

// Mock the logger
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
  withContext: vi.fn((_, fn) => fn()),
}));

describe("DecisionLogService", () => {
  let service: DecisionLogService;
  let mockDecisionLogRepository: IDecisionLogRepository;
  let mockDecisionContextRepository: IDecisionContextRepository;
  let mockDecisionTemplateRepository: IDecisionTemplateRepository;
  let mockTemplateFieldAssignmentRepository: ITemplateFieldAssignmentRepository;
  let mockChunkRelevanceRepository: IChunkRelevanceRepository;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock repositories
    mockDecisionLogRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByMeetingId: vi.fn(),
      findByDecisionContextId: vi.fn(),
      findByLoggedBy: vi.fn(),
      findByDateRange: vi.fn(),
      countByMeetingId: vi.fn(),
    };

    mockDecisionContextRepository = {
      findById: vi.fn(),
      findByMeetingId: vi.fn(),
      findByFlaggedDecisionId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      lockField: vi.fn(),
      unlockField: vi.fn(),
      lockAllFields: vi.fn(),
      setActiveField: vi.fn(),
      updateStatus: vi.fn(),
    };

    mockDecisionTemplateRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByIdentity: vi.fn(),
      findAll: vi.fn(),
      findDefault: vi.fn(),
      setDefault: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByCategory: vi.fn(),
      findByName: vi.fn(),
      search: vi.fn(),
      createMany: vi.fn(),
    };

    mockTemplateFieldAssignmentRepository = {
      create: vi.fn(),
      findByTemplateId: vi.fn(),
      findByFieldId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByTemplateId: vi.fn(),
      createMany: vi.fn(),
      updateOrder: vi.fn(),
    };

    mockChunkRelevanceRepository = {
      upsert: vi.fn(),
      findByDecisionField: vi.fn(),
      deleteByChunk: vi.fn(),
      findByChunk: vi.fn(),
    };

    service = new DecisionLogService(
      mockDecisionLogRepository,
      mockDecisionContextRepository,
      mockDecisionTemplateRepository,
      mockTemplateFieldAssignmentRepository,
      mockChunkRelevanceRepository,
    );
  });

  describe("logDecision", () => {
    it("should log a decision successfully", async () => {
      const decisionContextId = "ctx_123";
      const loggedBy = "user_123";
      const decisionMethod = { type: "manual" as const };

      const mockContext: DecisionContext = {
        id: decisionContextId,
        meetingId: "mtg_123",
        flaggedDecisionId: "flag_123",
        title: "Test Decision",
        templateId: "tpl_123",
        activeField: undefined,
        lockedFields: ["field1"],
        draftData: { decision: "Approved", reason: "Good fit" },
        draftVersions: [],
        status: "locked",
        createdAt: "2026-02-28T10:00:00Z",
        updatedAt: "2026-02-28T10:30:00Z",
      };

      const mockDecisionLog: DecisionLog = {
        id: "log_123",
        meetingId: "mtg_123",
        decisionContextId: decisionContextId,
        templateId: "tpl_123",
        templateVersion: 1,
        fields: { decision: "Approved", reason: "Good fit" },
        decisionMethod,
        sourceChunkIds: ["chunk_1", "chunk_2"],
        loggedAt: "2026-02-28T10:31:00Z",
        loggedBy,
      };

      (mockDecisionContextRepository.findById as any).mockResolvedValue(mockContext);
      (mockDecisionTemplateRepository.findById as any).mockResolvedValue({
        id: "tpl_123",
        version: 3,
      });
      (mockTemplateFieldAssignmentRepository.findByTemplateId as any).mockResolvedValue([
        { fieldId: "decision", required: true },
        { fieldId: "reason", required: false },
      ]);
      (mockChunkRelevanceRepository.findByDecisionField as any)
        .mockResolvedValueOnce([{ chunkId: "chunk_1" }])
        .mockResolvedValueOnce([{ chunkId: "chunk_2" }, { chunkId: "chunk_1" }]);
      (mockDecisionLogRepository.create as any).mockResolvedValue(mockDecisionLog);

      const result = await service.logDecision(decisionContextId, {
        loggedBy,
        decisionMethod: { type: "manual" },
      });

      expect(mockDecisionContextRepository.findById).toHaveBeenCalledWith(decisionContextId);
      expect(mockDecisionLogRepository.create).toHaveBeenCalledWith({
        meetingId: "mtg_123",
        decisionContextId,
        templateId: "tpl_123",
        templateVersion: 3,
        fields: { decision: "Approved", reason: "Good fit" },
        decisionMethod: { type: "manual" },
        sourceChunkIds: ["chunk_1", "chunk_2"],
        loggedBy,
      });
      expect(mockDecisionContextRepository.updateStatus).toHaveBeenCalledWith(
        decisionContextId,
        "logged",
      );
      expect(result).toEqual(mockDecisionLog);
      expect(logger.info).toHaveBeenCalledWith("Decision logged successfully", {
        decisionLogId: "log_123",
        decisionContextId,
      });
    });

    it("should return null if decision context not found", async () => {
      const decisionContextId = "nonexistent";
      const loggedBy = "user_123";

      (mockDecisionContextRepository.findById as any).mockResolvedValue(null);

      const result = await service.logDecision(decisionContextId, {
        loggedBy,
        decisionMethod: { type: "manual" },
      });

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Decision context not found", {
        decisionContextId,
      });
      expect(mockDecisionLogRepository.create).not.toHaveBeenCalled();
    });

    it("should throw error if decision context is already logged", async () => {
      const decisionContextId = "ctx_123";

      const mockContext: DecisionContext = {
        id: decisionContextId,
        meetingId: "mtg_123",
        flaggedDecisionId: "flag_123",
        title: "Test Decision",
        templateId: "tpl_123",
        activeField: undefined,
        lockedFields: [],
        draftData: {},
        draftVersions: [],
        status: "logged",
        createdAt: "2026-02-28T10:00:00Z",
        updatedAt: "2026-02-28T10:30:00Z",
      };

      (mockDecisionContextRepository.findById as any).mockResolvedValue(mockContext);

      await expect(
        service.logDecision(decisionContextId, {
          loggedBy: "user_123",
          decisionMethod: { type: "manual" },
        }),
      ).rejects.toThrow("Decision has already been logged");

      expect(mockDecisionLogRepository.create).not.toHaveBeenCalled();
    });

    it("should throw when required fields are missing", async () => {
      const decisionContextId = "ctx_123";

      (mockDecisionContextRepository.findById as any).mockResolvedValue({
        id: decisionContextId,
        meetingId: "mtg_123",
        flaggedDecisionId: "flag_123",
        title: "Test Decision",
        templateId: "tpl_123",
        activeField: undefined,
        lockedFields: [],
        draftData: { decision: "" },
        draftVersions: [],
        status: "locked",
        createdAt: "2026-02-28T10:00:00Z",
        updatedAt: "2026-02-28T10:30:00Z",
      });
      (mockDecisionTemplateRepository.findById as any).mockResolvedValue({
        id: "tpl_123",
        version: 2,
      });
      (mockTemplateFieldAssignmentRepository.findByTemplateId as any).mockResolvedValue([
        { fieldId: "decision", required: true },
      ]);

      await expect(
        service.logDecision(decisionContextId, {
          loggedBy: "user_123",
          decisionMethod: { type: "manual" },
        }),
      ).rejects.toThrow("Required fields missing: decision");

      expect(mockDecisionLogRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("getDecisionLog", () => {
    it("should retrieve a decision log by ID", async () => {
      const decisionLogId = "log_123";
      const mockDecisionLog: DecisionLog = {
        id: decisionLogId,
        meetingId: "mtg_123",
        decisionContextId: "ctx_123",
        templateId: "tpl_123",
        templateVersion: 1,
        fields: { decision: "Approved" },
        decisionMethod: { type: "manual" },
        sourceChunkIds: [],
        loggedAt: "2026-02-28T10:31:00Z",
        loggedBy: "user_123",
      };

      (mockDecisionLogRepository.findById as any).mockResolvedValue(mockDecisionLog);

      const result = await service.getDecisionLog(decisionLogId);

      expect(mockDecisionLogRepository.findById).toHaveBeenCalledWith(decisionLogId);
      expect(result).toEqual(mockDecisionLog);
      expect(logger.debug).toHaveBeenCalledWith("Retrieving decision log", {
        id: decisionLogId,
      });
    });

    it("should return null if decision log not found", async () => {
      const decisionLogId = "nonexistent";

      (mockDecisionLogRepository.findById as any).mockResolvedValue(null);

      const result = await service.getDecisionLog(decisionLogId);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith("Decision log not found", {
        id: "nonexistent",
      });
    });

    it("should retrieve all decision logs for a meeting", async () => {
      const meetingId = "mtg_123";
      const mockLogs: DecisionLog[] = [
        {
          id: "log_1",
          meetingId,
          decisionContextId: "ctx_1",
          templateId: "tpl_123",
          templateVersion: 1,
          fields: { decision: "Approved" },
          decisionMethod: { type: "manual" },
          sourceChunkIds: [],
          loggedAt: "2026-02-28T10:31:00Z",
          loggedBy: "user_123",
        },
        {
          id: "log_2",
          meetingId,
          decisionContextId: "ctx_2",
          templateId: "tpl_123",
          templateVersion: 1,
          fields: { decision: "Rejected" },
          decisionMethod: { type: "vote" },
          sourceChunkIds: [],
          loggedAt: "2026-02-28T11:00:00Z",
          loggedBy: "user_456",
        },
      ];

      (mockDecisionLogRepository.findByMeetingId as any).mockResolvedValue(mockLogs);

      const result = await service.getMeetingDecisionLogs(meetingId);

      expect(mockDecisionLogRepository.findByMeetingId).toHaveBeenCalledWith(meetingId);
      expect(result).toEqual(mockLogs);
      expect(logger.debug).toHaveBeenCalledWith("Retrieved meeting decision logs", {
        meetingId,
        count: 2,
      });
    });
  });

  describe("getDecisionContextLogs", () => {
    it("should retrieve all decision logs for a decision context", async () => {
      const decisionContextId = "ctx_123";
      const mockLogs: DecisionLog[] = [
        {
          id: "log_123",
          meetingId: "mtg_123",
          decisionContextId,
          templateId: "tpl_123",
          templateVersion: 1,
          fields: { decision: "Approved" },
          decisionMethod: { type: "manual" },
          sourceChunkIds: [],
          loggedAt: "2026-02-28T10:31:00Z",
          loggedBy: "user_123",
        },
      ];

      (mockDecisionLogRepository.findByDecisionContextId as any).mockResolvedValue(mockLogs);

      const result = await service.getDecisionContextLogs(decisionContextId);

      expect(mockDecisionLogRepository.findByDecisionContextId).toHaveBeenCalledWith(
        decisionContextId,
      );
      expect(result).toEqual(mockLogs);
    });
  });

  describe("getUserDecisionLogs", () => {
    it("should retrieve all decision logs by a user", async () => {
      const loggedBy = "user_123";
      const mockLogs: DecisionLog[] = [
        {
          id: "log_1",
          meetingId: "mtg_123",
          decisionContextId: "ctx_1",
          templateId: "tpl_123",
          templateVersion: 1,
          fields: { decision: "Approved" },
          decisionMethod: { type: "manual" },
          sourceChunkIds: [],
          loggedAt: "2026-02-28T10:31:00Z",
          loggedBy,
        },
      ];

      (mockDecisionLogRepository.findByLoggedBy as any).mockResolvedValue(mockLogs);

      const result = await service.getUserDecisionLogs(loggedBy);

      expect(mockDecisionLogRepository.findByLoggedBy).toHaveBeenCalledWith(loggedBy);
      expect(result).toEqual(mockLogs);
    });
  });

  describe("getDecisionLogsByDateRange", () => {
    it("should retrieve decision logs within date range", async () => {
      const startDate = new Date("2026-02-28T00:00:00Z");
      const endDate = new Date("2026-02-28T23:59:59Z");
      const mockLogs: DecisionLog[] = [
        {
          id: "log_123",
          meetingId: "mtg_123",
          decisionContextId: "ctx_123",
          templateId: "tpl_123",
          templateVersion: 1,
          fields: { decision: "Approved" },
          decisionMethod: { type: "manual" },
          sourceChunkIds: [],
          loggedAt: "2026-02-28T10:31:00Z",
          loggedBy: "user_123",
        },
      ];

      (mockDecisionLogRepository.findByDateRange as any).mockResolvedValue(mockLogs);

      const result = await service.getDecisionLogsByDateRange(startDate, endDate);

      expect(mockDecisionLogRepository.findByDateRange).toHaveBeenCalledWith(startDate, endDate);
      expect(result).toEqual(mockLogs);
    });
  });

  describe("getMeetingDecisionStats", () => {
    it("should generate decision statistics for a meeting", async () => {
      const meetingId = "mtg_123";
      const mockLogs: DecisionLog[] = [
        {
          id: "log_1",
          meetingId,
          decisionContextId: "ctx_1",
          templateId: "tpl_123",
          templateVersion: 1,
          fields: { decision: "Approved" },
          decisionMethod: { type: "manual" },
          sourceChunkIds: [],
          loggedAt: "2026-02-28T10:31:00Z",
          loggedBy: "user_123",
        },
        {
          id: "log_2",
          meetingId,
          decisionContextId: "ctx_2",
          templateId: "tpl_123",
          templateVersion: 1,
          fields: { decision: "Rejected" },
          decisionMethod: { type: "manual" },
          sourceChunkIds: [],
          loggedAt: "2026-02-28T11:00:00Z",
          loggedBy: "user_123",
        },
        {
          id: "log_3",
          meetingId,
          decisionContextId: "ctx_3",
          templateId: "tpl_123",
          templateVersion: 1,
          fields: { decision: "Deferred" },
          decisionMethod: { type: "ai_assisted" },
          sourceChunkIds: ["chunk_1"],
          loggedAt: "2026-02-28T12:00:00Z",
          loggedBy: "user_456",
        },
      ];

      (mockDecisionLogRepository.findByMeetingId as any).mockResolvedValue(mockLogs);

      const result = await service.getMeetingDecisionStats(meetingId);

      expect(result).toEqual({
        totalDecisions: 3,
        decisionsByMethod: {
          manual: 2,
          ai_assisted: 1,
        },
        decisionsByUser: {
          user_123: 2,
          user_456: 1,
        },
      });
    });

    it("should return empty stats for meeting with no decisions", async () => {
      const meetingId = "mtg_empty";

      (mockDecisionLogRepository.findByMeetingId as any).mockResolvedValue([]);

      const result = await service.getMeetingDecisionStats(meetingId);

      expect(result).toEqual({
        totalDecisions: 0,
        decisionsByMethod: {},
        decisionsByUser: {},
      });
    });
  });
});
