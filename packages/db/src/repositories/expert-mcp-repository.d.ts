/**
 * Drizzle Implementation of Expert Template and MCP Server Repositories
 */
import type { ExpertTemplate, CreateExpertTemplate, MCPServer, CreateMCPServer, ExpertAdvice, CreateExpertAdvice } from '@repo/schema';
type UpdateExpertTemplate = Partial<Omit<CreateExpertTemplate, 'id'>>;
type UpdateMCPServer = Partial<Omit<CreateMCPServer, 'id'>>;
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
export declare class DrizzleExpertTemplateRepository implements IExpertTemplateRepository {
    private mapToSchema;
    create(data: CreateExpertTemplate): Promise<ExpertTemplate>;
    findById(id: string): Promise<ExpertTemplate | null>;
    findAll(): Promise<ExpertTemplate[]>;
    findByType(type: string): Promise<ExpertTemplate[]>;
    findActive(): Promise<ExpertTemplate[]>;
    update(id: string, data: UpdateExpertTemplate): Promise<ExpertTemplate | null>;
    delete(id: string): Promise<boolean>;
    search(query: string): Promise<ExpertTemplate[]>;
    createMany(templates: CreateExpertTemplate[]): Promise<ExpertTemplate[]>;
}
export declare class DrizzleMCPServerRepository implements IMCPServerRepository {
    private mapToSchema;
    create(data: CreateMCPServer): Promise<MCPServer>;
    findByName(name: string): Promise<MCPServer | null>;
    findById(id: string): Promise<MCPServer | null>;
    findAll(): Promise<MCPServer[]>;
    findByType(type: string): Promise<MCPServer[]>;
    findByStatus(status: string): Promise<MCPServer[]>;
    findActive(): Promise<MCPServer[]>;
    update(name: string, data: UpdateMCPServer): Promise<MCPServer | null>;
    delete(name: string): Promise<boolean>;
    updateStatus(name: string, status: 'active' | 'inactive' | 'error'): Promise<boolean>;
    checkHealth(): Promise<Record<string, boolean>>;
    healthCheck(): Promise<Record<string, boolean>>;
}
export declare class DrizzleExpertAdviceHistoryRepository implements IExpertAdviceHistoryRepository {
    private mapToSchema;
    create(data: CreateExpertAdvice): Promise<ExpertAdvice>;
    findByDecisionContextId(decisionContextId: string): Promise<ExpertAdvice[]>;
    findByExpertId(expertId: string): Promise<ExpertAdvice[]>;
    findById(id: string): Promise<ExpertAdvice | null>;
    findByDateRange(startDate: Date, endDate: Date): Promise<ExpertAdvice[]>;
    findRecent(limit: number): Promise<ExpertAdvice[]>;
    getAdviceCountByExpert(expertId: string): Promise<number>;
    delete(id: string): Promise<boolean>;
    getAdviceCountByDecision(decisionContextId: string): Promise<number>;
}
export {};
