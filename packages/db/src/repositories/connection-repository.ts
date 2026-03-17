import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { connections, ConnectionSelect } from "../schema.js";
import type { Connection, UpdateConnection } from "@repo/schema";

function toConnection(row: ConnectionSelect): Connection {
  return {
    id: row.id,
    activeMeetingId: row.activeMeetingId ?? null,
    activeDecisionId: row.activeDecisionId ?? null,
    activeDecisionContextId: row.activeDecisionContextId ?? null,
    activeField: row.activeField ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastSeen: row.lastSeen.toISOString(),
  };
}

type ConnectionPatch = {
  activeMeetingId?: string | null;
  activeDecisionId?: string | null;
  activeDecisionContextId?: string | null;
  activeField?: string | null;
  updatedAt?: Date;
  lastSeen?: Date;
};

function definedOnly(state: UpdateConnection): ConnectionPatch {
  const patch: ConnectionPatch = {};
  if ("activeMeetingId" in state) patch.activeMeetingId = state.activeMeetingId ?? null;
  if ("activeDecisionId" in state) patch.activeDecisionId = state.activeDecisionId ?? null;
  if ("activeDecisionContextId" in state)
    patch.activeDecisionContextId = state.activeDecisionContextId ?? null;
  if ("activeField" in state) patch.activeField = state.activeField ?? null;
  return patch;
}

export class DrizzleConnectionRepository {
  async findById(id: string): Promise<Connection | null> {
    const [row] = await db.select().from(connections).where(eq(connections.id, id)).limit(1);
    return row ? toConnection(row) : null;
  }

  async upsert(id: string, state: UpdateConnection): Promise<Connection> {
    const now = new Date();
    const patch = definedOnly(state);
    const [row] = await db
      .insert(connections)
      .values({ id, ...patch, updatedAt: now, lastSeen: now })
      .onConflictDoUpdate({
        target: connections.id,
        set: { ...patch, updatedAt: now, lastSeen: now },
      })
      .returning();
    if (!row) throw new Error(`Failed to upsert connection ${id}`);
    return toConnection(row);
  }

  async updateLastSeen(id: string): Promise<void> {
    await db
      .update(connections)
      .set({ lastSeen: new Date() })
      .where(eq(connections.id, id));
  }
}
