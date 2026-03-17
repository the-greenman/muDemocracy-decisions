import type { Connection, UpdateConnection } from "@repo/schema";

export interface IConnectionRepository {
  findById(id: string): Promise<Connection | null>;
  upsert(id: string, state: UpdateConnection): Promise<Connection>;
  updateLastSeen(id: string): Promise<void>;
}
