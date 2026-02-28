/**
 * Drizzle Implementation of Expert Template and MCP Server Repositories
 */

import {
  expertTemplates,
  mcpServers,
  expertAdvice,
  type ExpertTemplateSelect,
  type ExpertAdviceSelect,
  type MCPServerSelect
} from '../schema';
import { db } from '../client';
import { eq, and, ilike, desc, asc, gte, lte, sql } from 'drizzle-orm';
import type { 
  ExpertTemplate,
  CreateExpertTemplate,
  MCPServer,
  CreateMCPServer,
  ExpertAdvice,
  CreateExpertAdvice
} from '@repo/schema';

type UpdateExpertTemplate = Partial<Omit<CreateExpertTemplate, 'id'>>;
type UpdateMCPServer = Partial<Omit<CreateMCPServer, 'id'>>;

// Interface definitions to avoid circular dependency
interface IExpertTemplateRepository {
  create(data: CreateExpertTemplate): Promise<ExpertTemplate>;
  findById(id: string): Promise<ExpertTemplate | null>;
  findAll(): Promise<ExpertTemplate[]>;
  findByType(type: string): Promise<ExpertTemplate[]>;
  findActive(): Promise<ExpertTemplate[]>;
  update(id: string, data: UpdateExpertTemplate): Promise<ExpertTemplate | null>;
  delete(id: string): Promise<boolean>;
  search(query: string): Promise<ExpertTemplate[]>;
  createMany(data: CreateExpertTemplate[]): Promise<ExpertTemplate[]>;
}

interface IMCPServerRepository {
  create(data: CreateMCPServer): Promise<MCPServer>;
  findById(id: string): Promise<MCPServer | null>;
  findByName(name: string): Promise<MCPServer | null>;
  findAll(): Promise<MCPServer[]>;
  findByType(type: string): Promise<MCPServer[]>;
  findByStatus(status: string): Promise<MCPServer[]>;
  findActive(): Promise<MCPServer[]>;
  update(id: string, data: UpdateMCPServer): Promise<MCPServer | null>;
  updateStatus(name: string, status: 'active' | 'inactive' | 'error'): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  checkHealth(): Promise<Record<string, boolean>>;
}

interface IExpertAdviceHistoryRepository {
  create(data: CreateExpertAdvice): Promise<ExpertAdvice>;
  findById(id: string): Promise<ExpertAdvice | null>;
  findByDecisionContextId(decisionContextId: string): Promise<ExpertAdvice[]>;
  findByExpertId(expertId: string): Promise<ExpertAdvice[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<ExpertAdvice[]>;
  delete(id: string): Promise<boolean>;
  getAdviceCountByExpert(expertId: string): Promise<number>;
  getAdviceCountByDecision(decisionContextId: string): Promise<number>;
}

export class DrizzleExpertTemplateRepository implements IExpertTemplateRepository {
  private mapToSchema(row: ExpertTemplateSelect): ExpertTemplate {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      promptTemplate: row.promptTemplate,
      mcpAccess: row.mcpAccess,
      outputSchema: row.outputSchema as Record<string, any> | undefined,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(data: CreateExpertTemplate): Promise<ExpertTemplate> {
    const [row] = await db
      .insert(expertTemplates)
      .values({
        name: data.name,
        type: data.type,
        promptTemplate: data.promptTemplate,
        mcpAccess: data.mcpAccess,
        outputSchema: data.outputSchema,
        isActive: data.isActive ?? true,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create expert template');
    }

    return this.mapToSchema(row);
  }

  async findById(id: string): Promise<ExpertTemplate | null> {
    const [row] = await db
      .select()
      .from(expertTemplates)
      .where(eq(expertTemplates.id, id));

    return row ? this.mapToSchema(row) : null;
  }

  async findAll(): Promise<ExpertTemplate[]> {
    const rows = await db
      .select()
      .from(expertTemplates)
      .orderBy(asc(expertTemplates.name));

    return rows.map(row => this.mapToSchema(row));
  }

  async findByType(type: string): Promise<ExpertTemplate[]> {
    const rows = await db
      .select()
      .from(expertTemplates)
      .where(eq(expertTemplates.type, type as 'technical' | 'legal' | 'stakeholder' | 'custom'))
      .orderBy(asc(expertTemplates.name));

    return rows.map(row => this.mapToSchema(row));
  }

  async findActive(): Promise<ExpertTemplate[]> {
    const rows = await db
      .select()
      .from(expertTemplates)
      .where(eq(expertTemplates.isActive, true))
      .orderBy(asc(expertTemplates.name));

    return rows.map(row => this.mapToSchema(row));
  }

  async update(id: string, data: UpdateExpertTemplate): Promise<ExpertTemplate | null> {
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.promptTemplate !== undefined) updateData.promptTemplate = data.promptTemplate;
    if (data.mcpAccess !== undefined) updateData.mcpAccess = data.mcpAccess;
    if (data.outputSchema !== undefined) updateData.outputSchema = data.outputSchema;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    const [row] = await db
      .update(expertTemplates)
      .set(updateData)
      .where(eq(expertTemplates.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async delete(id: string): Promise<boolean> {
    const [row] = await db
      .delete(expertTemplates)
      .where(eq(expertTemplates.id, id))
      .returning();

    return !!row;
  }

  async search(query: string): Promise<ExpertTemplate[]> {
    const rows = await db
      .select()
      .from(expertTemplates)
      .where(
        ilike(expertTemplates.name, `%${query}%`)
      )
      .orderBy(asc(expertTemplates.name));

    return rows.map(row => this.mapToSchema(row));
  }

  async createMany(templates: CreateExpertTemplate[]): Promise<ExpertTemplate[]> {
    const rows = await db
      .insert(expertTemplates)
      .values(
        templates.map(t => ({
          name: t.name,
          type: t.type,
          promptTemplate: t.promptTemplate,
          mcpAccess: t.mcpAccess,
          outputSchema: t.outputSchema,
          isActive: t.isActive ?? true,
        }))
      )
      .returning();

    return rows.map(row => this.mapToSchema(row));
  }
}

export class DrizzleMCPServerRepository implements IMCPServerRepository {
  private mapToSchema(row: MCPServerSelect): MCPServer {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      connectionConfig: row.connectionConfig as Record<string, any>,
      capabilities: row.capabilities as { tools?: string[]; resources?: string[] } | undefined,
    };
  }

  async create(data: CreateMCPServer): Promise<MCPServer> {
    // Transform data to handle both connection and connectionConfig fields
    const transformedData = CreateMCPServerWithCompatSchema.parse(data);
    
    const [row] = await db
      .insert(mcpServers)
      .values({
        name: transformedData.name,
        type: transformedData.type,
        connectionConfig: transformedData.connectionConfig,
        capabilities: transformedData.capabilities,
        status: transformedData.status ?? 'active',
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create MCP server');
    }

    return this.mapToSchema(row);
  }

  async findByName(name: string): Promise<MCPServer | null> {
    const [row] = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.name, name));

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async findById(id: string): Promise<MCPServer | null> {
    const [row] = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id));

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async findAll(): Promise<MCPServer[]> {
    const rows = await db
      .select()
      .from(mcpServers)
      .orderBy(asc(mcpServers.name));

    return rows.map(row => this.mapToSchema(row));
  }

  async findByType(type: string): Promise<MCPServer[]> {
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.type, type as 'stdio' | 'http' | 'sse'))
      .orderBy(asc(mcpServers.name));

    return rows.map(row => this.mapToSchema(row));
  }

  async findByStatus(status: string): Promise<MCPServer[]> {
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.status, status as 'active' | 'inactive' | 'error'))
      .orderBy(asc(mcpServers.name));

    return rows.map(row => this.mapToSchema(row));
  }

  async findActive(): Promise<MCPServer[]> {
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.status, 'active'))
      .orderBy(asc(mcpServers.name));

    return rows.map(row => this.mapToSchema(row));
  }

  async update(name: string, data: UpdateMCPServer): Promise<MCPServer | null> {
    // Transform data to handle both connection and connectionConfig fields
    const transformedData = CreateMCPServerWithCompatSchema.parse(data);
    
    const [row] = await db
      .update(mcpServers)
      .set({
        type: transformedData.type,
        connectionConfig: transformedData.connectionConfig,
        capabilities: transformedData.capabilities,
        status: transformedData.status,
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.name, name))
      .returning();

    return row ? this.mapToSchema(row) : null;
  }

  async delete(name: string): Promise<boolean> {
    const [row] = await db
      .delete(mcpServers)
      .where(eq(mcpServers.name, name))
      .returning();

    return !!row;
  }

  async updateStatus(name: string, status: 'active' | 'inactive' | 'error'): Promise<boolean> {
    const [row] = await db
      .update(mcpServers)
      .set({ 
        status,
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.name, name))
      .returning();

    return !!row;
  }

  async checkHealth(): Promise<Record<string, boolean>> {
    const servers = await this.findActive();
    const health: Record<string, boolean> = {};
    
    // For now, return all active servers as healthy
    // In a real implementation, this would ping each server
    for (const server of servers) {
      health[server.name] = true;
    }
    
    return health;
  }
}

export class DrizzleExpertAdviceHistoryRepository implements IExpertAdviceHistoryRepository {
  private mapToSchema(row: ExpertAdviceSelect): ExpertAdvice {
    return {
      id: row.id,
      decisionContextId: row.decisionContextId,
      expertId: row.expertId,
      expertName: row.expertName,
      request: row.request,
      response: row.response as any, // Keep response as is
      mcpToolsUsed: row.mcpToolsUsed || undefined,
      requestedAt: row.requestedAt.toISOString(),
    };
  }

  async create(data: CreateExpertAdvice): Promise<ExpertAdvice> {
    // Transform data to handle both advice and response fields
    const transformedData = CreateExpertAdviceWithCompatSchema.parse(data);
    
    // Map advice to response for database
    const [row] = await db
      .insert(expertAdvice)
      .values({
        decisionContextId: transformedData.decisionContextId,
        expertId: transformedData.expertId,
        expertName: transformedData.expertName,
        request: transformedData.request || 'Advice requested', // Default request if not provided
        response: transformedData.response, // Already transformed
        mcpToolsUsed: transformedData.mcpToolsUsed,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create expert advice');
    }

    return this.mapToSchema(row);
  }

  async findByDecisionContextId(decisionContextId: string): Promise<ExpertAdvice[]> {
    const rows = await db
      .select()
      .from(expertAdvice)
      .where(eq(expertAdvice.decisionContextId, decisionContextId))
      .orderBy(desc(expertAdvice.requestedAt));

    return rows.map(row => this.mapToSchema(row));
  }

  async findByExpertId(expertId: string): Promise<ExpertAdvice[]> {
    const rows = await db
      .select()
      .from(expertAdvice)
      .where(eq(expertAdvice.expertId, expertId))
      .orderBy(desc(expertAdvice.requestedAt));

    return rows.map(row => this.mapToSchema(row));
  }

  async findById(id: string): Promise<ExpertAdvice | null> {
    const [row] = await db
      .select()
      .from(expertAdvice)
      .where(eq(expertAdvice.id, id));

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<ExpertAdvice[]> {
    const rows = await db
      .select()
      .from(expertAdvice)
      .where(
        and(
          gte(expertAdvice.requestedAt, startDate),
          lte(expertAdvice.requestedAt, endDate)
        )
      )
      .orderBy(desc(expertAdvice.requestedAt));

    return rows.map(row => this.mapToSchema(row));
  }

  async findRecent(limit: number): Promise<ExpertAdvice[]> {
    const rows = await db
      .select()
      .from(expertAdvice)
      .orderBy(desc(expertAdvice.requestedAt))
      .limit(limit);

    return rows.map(row => this.mapToSchema(row));
  }

  async getAdviceCountByExpert(expertId: string): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(expertAdvice)
      .where(eq(expertAdvice.expertId, expertId));

    return Number(result[0]?.count || 0);
  }

  async delete(id: string): Promise<boolean> {
    const [row] = await db
      .delete(expertAdvice)
      .where(eq(expertAdvice.id, id))
      .returning();

    return !!row;
  }

  async getAdviceCountByDecision(decisionContextId: string): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(expertAdvice)
      .where(eq(expertAdvice.decisionContextId, decisionContextId));

    return Number(result[0]?.count || 0);
  }
}
