import { describe, it, expect, vi, beforeEach } from "vitest";
import { MeetingService } from "../meeting-service";
import { IMeetingRepository } from "../../interfaces/i-meeting-repository";
import { CreateMeeting, Meeting } from "@repo/schema";

describe("MeetingService", () => {
  let service: MeetingService;
  let mockRepo: IMeetingRepository;

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as IMeetingRepository;

    service = new MeetingService(mockRepo);
  });

  describe("create", () => {
    it("should create a meeting with valid data", async () => {
      // Arrange
      const createData: CreateMeeting = {
        title: "Test Meeting",
        date: "2026-02-27T10:00:00Z",
        participants: ["Alice", "Bob"],
      };

      const expectedMeeting: Meeting = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        ...createData,
        status: "proposed",
        createdAt: "2026-02-27T10:00:00Z",
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedMeeting);

      // Act
      const result = await service.create(createData);

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(expectedMeeting);
      expect(result.id).toBeDefined();
    });

    it("should throw error if title is empty", async () => {
      // Arrange
      const createData = {
        title: "",
        date: "2026-02-27T10:00:00Z",
        participants: ["Alice"],
      };

      // Act & Assert
      await expect(service.create(createData)).rejects.toThrow();
    });

    it("should throw error if no participants", async () => {
      // Arrange
      const createData = {
        title: "Test Meeting",
        date: "2026-02-27T10:00:00Z",
        participants: [],
      };

      // Act & Assert
      await expect(service.create(createData)).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("should return a meeting if found", async () => {
      // Arrange
      const meetingId = "550e8400-e29b-41d4-a716-446655440000";
      const expectedMeeting: Meeting = {
        id: meetingId,
        title: "Test Meeting",
        date: "2026-02-27T10:00:00Z",
        participants: ["Alice"],
        status: "proposed",
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockRepo.findById).mockResolvedValue(expectedMeeting);

      // Act
      const result = await service.findById(meetingId);

      // Assert
      expect(mockRepo.findById).toHaveBeenCalledWith(meetingId);
      expect(result).toEqual(expectedMeeting);
    });

    it("should return null if meeting not found", async () => {
      // Arrange
      const meetingId = "non-existent-id";
      vi.mocked(mockRepo.findById).mockResolvedValue(null);

      // Act
      const result = await service.findById(meetingId);

      // Assert
      expect(mockRepo.findById).toHaveBeenCalledWith(meetingId);
      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should return all meetings", async () => {
      // Arrange
      const expectedMeetings: Meeting[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          title: "Meeting 1",
          date: "2026-02-27T10:00:00Z",
          participants: ["Alice"],
          status: "proposed",
          createdAt: new Date().toISOString(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          title: "Meeting 2",
          date: "2026-02-28T10:00:00Z",
          participants: ["Bob"],
          status: "ended",
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(mockRepo.findAll).mockResolvedValue(expectedMeetings);

      // Act
      const result = await service.findAll();

      // Assert
      expect(mockRepo.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedMeetings);
    });
  });

  describe("updateStatus", () => {
    it("should update meeting status", async () => {
      // Arrange
      const meetingId = "550e8400-e29b-41d4-a716-446655440000";
      const status = "ended" as const;
      const existingMeeting: Meeting = {
        id: meetingId,
        title: "Test Meeting",
        date: "2026-02-27T10:00:00Z",
        participants: ["Alice"],
        status: "in_session",
        createdAt: new Date().toISOString(),
      };
      const expectedMeeting: Meeting = {
        id: meetingId,
        title: "Test Meeting",
        date: "2026-02-27T10:00:00Z",
        participants: ["Alice"],
        status,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockRepo.findById).mockResolvedValue(existingMeeting);
      vi.mocked(mockRepo.updateStatus).mockResolvedValue(expectedMeeting);

      // Act
      const result = await service.updateStatus(meetingId, status);

      // Assert
      expect(mockRepo.findById).toHaveBeenCalledWith(meetingId);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(meetingId, status);
      expect(result).toEqual(expectedMeeting);
    });
  });
});
