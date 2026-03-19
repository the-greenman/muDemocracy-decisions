import type { Connection, UpdateConnection } from "@repo/schema";

export interface IConnectionRepository {
  findById(id: string): Promise<Connection | null>;
  findAll(opts?: { limit?: number }): Promise<Connection[]>;
  create(id: string): Promise<Connection>;
  upsert(id: string, state: UpdateConnection): Promise<Connection>;
  updateLastSeen(id: string): Promise<void>;
}
