/**
 * Integration tests for Expert and MCP Repositories
 * Tests against real test database
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { 
  DrizzleExpertTemplateRepository,
  DrizzleMCPServerRepository,
  DrizzleExpertAdviceHistoryRepository 
} from '../repositories/expert-mcp-repository';
import { db } from '../client';
import { sql } from 'drizzle-orm';
import type {
  CreateExpertTemplate,
  CreateMCPServer,
  CreateExpertAdvice
} from '@repo/core';

describe('Expert and MCP Repository Integration Tests', () => {
  let expertRepo: DrizzleExpertTemplateRepository;
  let mcpRepo: DrizzleMCPServerRepository;
  let adviceRepo: DrizzleExpertAdviceHistoryRepository;

  beforeAll(async () => {
    expertRepo = new DrizzleExpertTemplateRepository();
    mcpRepo = new DrizzleMCPServerRepository();
    adviceRepo = new DrizzleExpertAdviceHistoryRepository();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.execute(sql`DELETE FROM expert_advice`);
    await db.execute(sql`DELETE FROM expert_templates`);
    await db.execute(sql`DELETE FROM mcp_servers`);
  });

  afterAll(async () => {
    // Clean up
    await db.execute(sql`DELETE FROM expert_advice`);
    await db.execute(sql`DELETE FROM expert_templates`);
    await db.execute(sql`DELETE FROM mcp_servers`);
  });

  describe('ExpertTemplateRepository', () => {
    it('should create and find an expert template', async () => {
      const data: CreateExpertTemplate = {
        name: 'Test Expert',
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: ['github'],
        isActive: true,
      };

      const created = await expertRepo.create(data);
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe(data.name);
      expect(created.type).toBe(data.type);

      const found = await expertRepo.findById(created.id);
      expect(found).toEqual(created);
    });

    it('should find all expert templates', async () => {
      const data1: CreateExpertTemplate = {
        name: 'Expert 1',
        type: 'technical',
        promptTemplate: 'You are expert 1',
        mcpAccess: [],
        isActive: true,
      };

      const data2: CreateExpertTemplate = {
        name: 'Expert 2',
        type: 'legal',
        promptTemplate: 'You are expert 2',
        mcpAccess: ['docs'],
        isActive: true,
      };

      await expertRepo.create(data1);
      await expertRepo.create(data2);

      const all = await expertRepo.findAll();
      expect(all).toHaveLength(2);
      expect(all.map(e => e.name)).toContain('Expert 1');
      expect(all.map(e => e.name)).toContain('Expert 2');
    });

    it('should update an expert template', async () => {
      const data: CreateExpertTemplate = {
        name: 'Test Expert',
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: ['github'],
        isActive: true,
      };

      const created = await expertRepo.create(data);
      const updated = await expertRepo.update(created.id, {
        name: 'Updated Expert',
        isActive: false,
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Expert');
      expect(updated!.isActive).toBe(false);
    });

    it('should delete an expert template', async () => {
      const data: CreateExpertTemplate = {
        name: 'Test Expert',
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: ['github'],
        isActive: true,
      };

      const created = await expertRepo.create(data);
      const deleted = await expertRepo.delete(created.id);

      expect(deleted).toBe(true);

      const found = await expertRepo.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('MCPServerRepository', () => {
    it('should create and find an MCP server', async () => {
      const data: CreateMCPServer = {
        name: 'test-server',
        type: 'stdio',
        connectionConfig: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github']
        },
        status: 'active',
      };

      const created = await mcpRepo.create(data);
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe(data.name);
      expect(created.type).toBe(data.type);

      const found = await mcpRepo.findByName('test-server');
      expect(found).toEqual(created);
    });

    it('should find all MCP servers', async () => {
      const data1: CreateMCPServer = {
        name: 'server-1',
        type: 'stdio',
        connectionConfig: { command: 'node', args: ['server1.js'] },
        status: 'active',
      };

      const data2: CreateMCPServer = {
        name: 'server-2',
        type: 'http',
        connectionConfig: { url: 'http://localhost:3001' },
        status: 'inactive',
      };

      await mcpRepo.create(data1);
      await mcpRepo.create(data2);

      const all = await mcpRepo.findAll();
      expect(all).toHaveLength(2);
      expect(all.map(s => s.name)).toContain('server-1');
      expect(all.map(s => s.name)).toContain('server-2');
    });

    it('should update MCP server status', async () => {
      const data: CreateMCPServer = {
        name: 'test-server',
        type: 'stdio',
        connectionConfig: { command: 'test' },
        status: 'active',
      };

      await mcpRepo.create(data);
      const updated = await mcpRepo.updateStatus('test-server', 'inactive');

      expect(updated).toBe(true);

      const server = await mcpRepo.findByName('test-server');
      expect(server!.status).toBe('inactive');
    });
  });

  describe('ExpertAdviceHistoryRepository', () => {
    it('should create and find expert advice', async () => {
      // First create an expert template
      const expertData: CreateExpertTemplate = {
        name: 'Test Expert',
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: [],
        isActive: true,
      };
      const expert = await expertRepo.create(expertData);

      const data: CreateExpertAdvice = {
        decisionContextId: '550e8400-e29b-41d4-a716-446655440004',
        expertId: expert.id,
        expertName: expert.name,
        response: { suggestions: ['Test suggestion'] },
        request: 'Test request',
      };

      const created = await adviceRepo.create(data);
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.decisionContextId).toBe(data.decisionContextId);
      expect(created.expertId).toBe(data.expertId);

      const found = await adviceRepo.findById(created.id);
      expect(found).toEqual(created);
    });

    it('should find advice by decision context ID', async () => {
      // Create expert
      const expertData: CreateExpertTemplate = {
        name: 'Test Expert',
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: [],
        isActive: true,
      };
      const expert = await expertRepo.create(expertData);

      const decisionContextId = '550e8400-e29b-41d4-a716-446655440004';

      // Create multiple advice entries
      const advice1: CreateExpertAdvice = {
        decisionContextId,
        expertId: expert.id,
        expertName: expert.name,
        response: { suggestions: ['Suggestion 1'] },
        request: 'Request 1',
      };

      const advice2: CreateExpertAdvice = {
        decisionContextId,
        expertId: expert.id,
        expertName: expert.name,
        response: { suggestions: ['Suggestion 2'] },
        request: 'Request 2',
      };

      await adviceRepo.create(advice1);
      await adviceRepo.create(advice2);

      const found = await adviceRepo.findByDecisionContextId(decisionContextId);
      expect(found).toHaveLength(2);
    });

    it('should get advice count by expert', async () => {
      // Create expert
      const expertData: CreateExpertTemplate = {
        name: 'Test Expert',
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: [],
        isActive: true,
      };
      const expert = await expertRepo.create(expertData);

      // Create advice entries
      for (let i = 0; i < 3; i++) {
        const advice: CreateExpertAdvice = {
          decisionContextId: `550e8400-e29b-41d4-a716-44665544000${i}`,
          expertId: expert.id,
          expertName: expert.name,
          response: { suggestions: [`Suggestion ${i}`] },
          request: `Request ${i}`,
        };
        await adviceRepo.create(advice);
      }

      const count = await adviceRepo.getAdviceCountByExpert(expert.id);
      expect(count).toBe(3);
    });
  });
});
