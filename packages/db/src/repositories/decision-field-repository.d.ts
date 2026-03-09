/**
 * Drizzle implementation of Decision Field Repository
 */
import type { DecisionField, CreateDecisionField } from '@repo/schema';
type DecisionFieldIdentityLookup = {
    namespace?: string;
    name: string;
    version?: number;
};
interface IDecisionFieldRepository {
    create(data: CreateDecisionField): Promise<DecisionField>;
    findAll(): Promise<DecisionField[]>;
    findById(id: string): Promise<DecisionField | null>;
    findByIdentity(identity: DecisionFieldIdentityLookup): Promise<DecisionField | null>;
    findByCategory(category: string): Promise<DecisionField[]>;
    findByType(type: string): Promise<DecisionField[]>;
    update(id: string, data: Partial<CreateDecisionField>): Promise<DecisionField | null>;
    delete(id: string): Promise<boolean>;
}
export declare class DrizzleDecisionFieldRepository implements IDecisionFieldRepository {
    create(data: CreateDecisionField): Promise<DecisionField>;
    findById(id: string): Promise<DecisionField | null>;
    findByIdentity(identity: DecisionFieldIdentityLookup): Promise<DecisionField | null>;
    findAll(): Promise<DecisionField[]>;
    findByCategory(category: string): Promise<DecisionField[]>;
    update(id: string, data: Partial<CreateDecisionField>): Promise<DecisionField | null>;
    delete(id: string): Promise<boolean>;
    createMany(fields: CreateDecisionField[]): Promise<DecisionField[]>;
    search(query: string): Promise<DecisionField[]>;
    findByType(type: string): Promise<DecisionField[]>;
    private mapToSchema;
}
export {};
