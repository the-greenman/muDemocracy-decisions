import type { SupplementaryContent, CreateSupplementaryContent } from '@repo/schema';
export declare class DrizzleSupplementaryContentRepository {
    create(data: CreateSupplementaryContent): Promise<SupplementaryContent>;
    findByContext(contextTag: string): Promise<SupplementaryContent[]>;
    delete(id: string): Promise<boolean>;
    private toSchema;
}
