/**
 * Integration tests for DrizzleConnectionRepository
 * TDD: tests written before implementation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DrizzleConnectionRepository } from "../../src/repositories/connection-repository";
import { db } from "../../src/client";
import { connections, meetings } from "../../src/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

describe("DrizzleConnectionRepository", () => {
  let repo: DrizzleConnectionRepository;
  let testConnectionId: string;
  let testMeetingId: string;

  beforeEach(async () => {
    repo = new DrizzleConnectionRepository();
    testConnectionId = randomUUID();
    testMeetingId = randomUUID();

    await db.insert(meetings).values({
      id: testMeetingId,
      title: "Test Meeting",
      date: new Date("2026-01-01T00:00:00.000Z"),
      participants: ["Alice", "Bob"],
      status: "in_session",
    });
  });

  afterEach(async () => {
    await db.delete(connections).where(eq(connections.id, testConnectionId));
    await db.delete(meetings).where(eq(meetings.id, testMeetingId));
  });

  describe("findById", () => {
    it("returns null when connection does not exist", async () => {
      const result = await repo.findById(testConnectionId);
      expect(result).toBeNull();
    });

    it("returns the connection when it exists", async () => {
      await db.insert(connections).values({ id: testConnectionId });
      const result = await repo.findById(testConnectionId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(testConnectionId);
      expect(result!.activeMeetingId).toBeNull();
    });
  });

  describe("upsert", () => {
    it("creates a new connection on first call", async () => {
      const result = await repo.upsert(testConnectionId, {});
      expect(result.id).toBe(testConnectionId);
      expect(result.activeMeetingId).toBeNull();
    });

    it("sets activeMeetingId on upsert", async () => {
      const result = await repo.upsert(testConnectionId, {
        activeMeetingId: testMeetingId,
      });
      expect(result.activeMeetingId).toBe(testMeetingId);
    });

    it("updates an existing connection", async () => {
      await repo.upsert(testConnectionId, { activeMeetingId: testMeetingId });
      const updated = await repo.upsert(testConnectionId, { activeMeetingId: null });
      expect(updated.activeMeetingId).toBeNull();
    });

    it("is idempotent — second upsert with same state returns same values", async () => {
      await repo.upsert(testConnectionId, { activeMeetingId: testMeetingId });
      const second = await repo.upsert(testConnectionId, { activeMeetingId: testMeetingId });
      expect(second.activeMeetingId).toBe(testMeetingId);
    });

    it("preserves unmentioned fields when updating a subset", async () => {
      await repo.upsert(testConnectionId, { activeMeetingId: testMeetingId });
      const updated = await repo.upsert(testConnectionId, { activeField: randomUUID() });
      expect(updated.activeMeetingId).toBe(testMeetingId);
    });
  });

  describe("updateLastSeen", () => {
    it("completes without error and preserves other fields", async () => {
      await repo.upsert(testConnectionId, { activeMeetingId: testMeetingId });
      await expect(repo.updateLastSeen(testConnectionId)).resolves.toBeUndefined();
      const result = await repo.findById(testConnectionId);
      expect(result).not.toBeNull();
      expect(result!.activeMeetingId).toBe(testMeetingId);
      expect(new Date(result!.lastSeen).getTime()).not.toBeNaN();
    });
  });
});
