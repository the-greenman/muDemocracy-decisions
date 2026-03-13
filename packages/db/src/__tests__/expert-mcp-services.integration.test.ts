/**
 * Integration tests for Expert and MCP Services
 * Tests against real test database
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { ExpertTemplateService, MCPServerService, ExpertAdviceService } from "@repo/core";
import {
  DrizzleExpertTemplateRepository,
  DrizzleMCPServerRepository,
  DrizzleExpertAdviceHistoryRepository,
} from "../repositories/expert-mcp-repository";
import { db } from "../client";
import { meetings, flaggedDecisions, decisionContexts, decisionTemplates } from "../schema";
import { sql } from "drizzle-orm";
import type { CreateExpertTemplate, CreateMCPServer, CreateExpertAdvice } from "@repo/core";
import { randomUUID } from "crypto";

const expertTemplateNamePrefix = "Expert/MCP Service Test ";
const mcpServerNamePrefix = "expert-mcp-service-";

describe("Expert and MCP Service Integration Tests", () => {
  let expertTemplateService: ExpertTemplateService;
  let mcpServerService: MCPServerService;
  let expertAdviceService: ExpertAdviceService;
  let testDecisionContextId: string;

  beforeAll(async () => {
    const expertRepo = new DrizzleExpertTemplateRepository();
    const mcpRepo = new DrizzleMCPServerRepository();
    const adviceRepo = new DrizzleExpertAdviceHistoryRepository();

    expertTemplateService = new ExpertTemplateService(expertRepo);
    mcpServerService = new MCPServerService(mcpRepo);
    expertAdviceService = new ExpertAdviceService(adviceRepo, expertRepo);
  });

  beforeEach(async () => {
    // Clean up test data
    await db.execute(sql`
      DELETE FROM expert_advice
      WHERE expert_id IN (
        SELECT id FROM expert_templates WHERE name LIKE ${`${expertTemplateNamePrefix}%`}
      )
    `);
    await db.execute(sql`
      DELETE FROM expert_templates WHERE name LIKE ${`${expertTemplateNamePrefix}%`}
    `);
    await db.execute(sql`
      DELETE FROM mcp_servers WHERE name LIKE ${`${mcpServerNamePrefix}%`}
    `);

    const [template] = await db
      .insert(decisionTemplates)
      .values({
        namespace: "test",
        name: `Expert Advice Service Template ${randomUUID()}`,
        description: "Template for expert advice service integration tests",
        category: "standard",
        version: 1,
        isDefault: false,
        isCustom: false,
      })
      .returning();

    const [meeting] = await db
      .insert(meetings)
      .values({
        title: `Expert Advice Service Meeting ${randomUUID()}`,
        date: new Date("2026-03-01T00:00:00.000Z"),
        participants: ["Alice", "Bob"],
        status: "in_session",
      })
      .returning();

    const [flaggedDecision] = await db
      .insert(flaggedDecisions)
      .values({
        meetingId: meeting!.id,
        suggestedTitle: "Expert advice service decision",
        contextSummary: "Decision used for expert advice service tests",
        confidence: 0.9,
        chunkIds: [],
        priority: 0,
        status: "pending",
        suggestedTemplateId: null,
        templateConfidence: null,
      })
      .returning();

    const [context] = await db
      .insert(decisionContexts)
      .values({
        meetingId: meeting!.id,
        flaggedDecisionId: flaggedDecision!.id,
        title: "Expert advice service context",
        templateId: template!.id,
        activeField: null,
        lockedFields: [],
        draftData: {},
        status: "drafting",
      })
      .returning();

    testDecisionContextId = context!.id;
  });

  afterAll(async () => {
    // Clean up
    await db.execute(sql`
      DELETE FROM expert_advice
      WHERE expert_id IN (
        SELECT id FROM expert_templates WHERE name LIKE ${`${expertTemplateNamePrefix}%`}
      )
    `);
    await db.execute(sql`
      DELETE FROM expert_templates WHERE name LIKE ${`${expertTemplateNamePrefix}%`}
    `);
    await db.execute(sql`
      DELETE FROM mcp_servers WHERE name LIKE ${`${mcpServerNamePrefix}%`}
    `);
  });

  describe("ExpertTemplateService Integration", () => {
    it("should create and retrieve expert templates", async () => {
      const data: CreateExpertTemplate = {
        name: `${expertTemplateNamePrefix}Technical Architect`,
        type: "technical",
        promptTemplate: "You are a technical architect. Review this decision...",
        mcpAccess: ["github", "jira"],
        isActive: true,
      };

      const created = await expertTemplateService.createTemplate(data);
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe(data.name);

      const retrieved = await expertTemplateService.getTemplate(created.id);
      expect(retrieved).toEqual(created);
    });

    it("should get templates by type", async () => {
      const technicalTemplate: CreateExpertTemplate = {
        name: `${expertTemplateNamePrefix}Technical Expert`,
        type: "technical",
        promptTemplate: "You are a technical expert",
        mcpAccess: [],
        isActive: true,
      };

      const legalTemplate: CreateExpertTemplate = {
        name: `${expertTemplateNamePrefix}Legal Expert`,
        type: "legal",
        promptTemplate: "You are a legal expert",
        mcpAccess: [],
        isActive: true,
      };

      await expertTemplateService.createTemplate(technicalTemplate);
      await expertTemplateService.createTemplate(legalTemplate);

      const technicalExperts = await expertTemplateService.getTemplatesByType("technical");
      expect(technicalExperts.some((expert) => expert.name === technicalTemplate.name)).toBe(true);

      const legalExperts = await expertTemplateService.getTemplatesByType("legal");
      expect(legalExperts.some((expert) => expert.name === legalTemplate.name)).toBe(true);
    });

    it("should search templates", async () => {
      const template1: CreateExpertTemplate = {
        name: `${expertTemplateNamePrefix}Database Architect`,
        type: "technical",
        promptTemplate: "You are a database architect",
        mcpAccess: [],
        isActive: true,
      };

      const template2: CreateExpertTemplate = {
        name: `${expertTemplateNamePrefix}Legal Counsel`,
        type: "legal",
        promptTemplate: "You are legal counsel",
        mcpAccess: [],
        isActive: true,
      };

      await expertTemplateService.createTemplate(template1);
      await expertTemplateService.createTemplate(template2);

      const searchResults = await expertTemplateService.searchTemplates("architect");
      expect(searchResults.some((expert) => expert.name === template1.name)).toBe(true);
    });
  });

  describe("MCPServerService Integration", () => {
    it("should create and retrieve MCP servers", async () => {
      const data: CreateMCPServer = {
        name: `${mcpServerNamePrefix}github-mcp`,
        type: "stdio",
        connectionConfig: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
        },
        status: "active",
        capabilities: {
          tools: ["search_code", "get_file", "create_issue"],
          resources: ["repositories", "issues"],
        },
      };

      const created = await mcpServerService.createServer(data);
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe(data.name);

      const retrieved = await mcpServerService.getServer(data.name);
      expect(retrieved).toEqual(created);
    });

    it("should update server status", async () => {
      const data: CreateMCPServer = {
        name: `${mcpServerNamePrefix}test-server`,
        type: "http",
        connectionConfig: { url: "http://localhost:3000" },
        status: "active",
      };

      await mcpServerService.createServer(data);

      const updated = await mcpServerService.updateServerStatus(data.name, "inactive");
      expect(updated).toBe(true);

      const server = await mcpServerService.getServer(data.name);
      expect(server!.status).toBe("inactive");
    });

    it("should get servers by type", async () => {
      const stdioServer: CreateMCPServer = {
        name: `${mcpServerNamePrefix}stdio-server`,
        type: "stdio",
        connectionConfig: { command: "node", args: ["server.js"] },
        status: "active",
      };

      const httpServer: CreateMCPServer = {
        name: `${mcpServerNamePrefix}http-server`,
        type: "http",
        connectionConfig: { url: "http://localhost:3000" },
        status: "active",
      };

      await mcpServerService.createServer(stdioServer);
      await mcpServerService.createServer(httpServer);

      const stdioServers = await mcpServerService.getServersByType("stdio");
      expect(stdioServers.some((server) => server.name === stdioServer.name)).toBe(true);

      const httpServers = await mcpServerService.getServersByType("http");
      expect(httpServers.some((server) => server.name === httpServer.name)).toBe(true);
    });
  });

  describe("ExpertAdviceService Integration", () => {
    it("should create and retrieve expert advice", async () => {
      // First create an expert template
      const expertData: CreateExpertTemplate = {
        name: "Security Expert",
        type: "technical",
        promptTemplate: "You are a security expert",
        mcpAccess: [],
        isActive: true,
      };
      const expert = await expertTemplateService.createTemplate(expertData);

      const adviceData: CreateExpertAdvice = {
        decisionContextId: testDecisionContextId,
        expertId: expert.id,
        expertName: expert.name,
        request: "Is this approach secure?",
        response: {
          suggestions: ["Implement authentication", "Use HTTPS"],
          concerns: ["Potential SQL injection vulnerability"],
          questions: ["What data will be stored?"],
        },
        mcpToolsUsed: ["security-scanner"],
      };

      const created = await expertAdviceService.createAdvice(adviceData);
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.decisionContextId).toBe(adviceData.decisionContextId);

      const retrieved = await expertAdviceService.getAdviceById(created.id);
      expect(retrieved).toEqual(created);
    });

    it("should consult with an expert", async () => {
      // Create an expert template
      const expertData: CreateExpertTemplate = {
        name: "Performance Expert",
        type: "technical",
        promptTemplate: "You are a performance optimization expert",
        mcpAccess: ["profiler"],
        isActive: true,
      };
      const expert = await expertTemplateService.createTemplate(expertData);

      const decisionContextId = testDecisionContextId;
      const request = "How can we optimize this query?";

      const advice = await expertAdviceService.consultExpert(expert.id, decisionContextId, request);

      expect(advice).toBeDefined();
      expect(advice.expertId).toBe(expert.id);
      expect(advice.decisionContextId).toBe(decisionContextId);
      expect(advice.response.suggestions).toBeDefined();
      expect(advice.response.suggestions.length).toBeGreaterThan(0);
    });

    it("should get advice by decision context", async () => {
      // Create experts
      const expert1 = await expertTemplateService.createTemplate({
        name: "Expert 1",
        type: "technical",
        promptTemplate: "You are expert 1",
        mcpAccess: [],
        isActive: true,
      });

      const expert2 = await expertTemplateService.createTemplate({
        name: "Expert 2",
        type: "legal",
        promptTemplate: "You are expert 2",
        mcpAccess: [],
        isActive: true,
      });

      const decisionContextId = testDecisionContextId;

      // Create advice from both experts
      await expertAdviceService.createAdvice({
        decisionContextId,
        expertId: expert1.id,
        expertName: expert1.name,
        request: "Test request 1",
        response: { suggestions: ["Advice 1"] },
      });

      await expertAdviceService.createAdvice({
        decisionContextId,
        expertId: expert2.id,
        expertName: expert2.name,
        request: "Test request 2",
        response: { suggestions: ["Advice 2"] },
      });

      const adviceList = await expertAdviceService.getAdviceByDecisionContext(decisionContextId);
      expect(adviceList).toHaveLength(2);
    });

    it("should get advice counts", async () => {
      // Create expert
      const expert = await expertTemplateService.createTemplate({
        name: "Test Expert",
        type: "technical",
        promptTemplate: "You are a test expert",
        mcpAccess: [],
        isActive: true,
      });

      const decisionContextId = testDecisionContextId;

      // Create multiple advice entries
      for (let i = 0; i < 3; i++) {
        await expertAdviceService.createAdvice({
          decisionContextId,
          expertId: expert.id,
          expertName: expert.name,
          request: `Request ${i}`,
          response: { suggestions: [`Suggestion ${i}`] },
        });
      }

      const expertCount = await expertAdviceService.getAdviceCountByExpert(expert.id);
      expect(expertCount).toBe(3);

      const decisionCount = await expertAdviceService.getAdviceCountByDecision(decisionContextId);
      expect(decisionCount).toBe(3);
    });
  });

  describe("Cross-Service Integration", () => {
    it("should create expert with MCP access and use it in advice", async () => {
      const mcpServer = await mcpServerService.createServer({
        name: `${mcpServerNamePrefix}code-analyzer`,
        type: "stdio",
        connectionConfig: { command: "code-analyzer" },
        capabilities: { tools: ["analyze", "suggest"] },
        status: "active",
      });

      const expert = await expertTemplateService.createTemplate({
        name: `${expertTemplateNamePrefix}Code Review Expert`,
        type: "technical",
        promptTemplate: "You are a code review expert",
        mcpAccess: [mcpServer.name],
        isActive: true,
      });

      const advice = await expertAdviceService.createAdvice({
        decisionContextId: testDecisionContextId,
        expertId: expert.id,
        expertName: expert.name,
        request: "Review this code",
        response: {
          suggestions: ["Add error handling", "Improve variable names"],
          concerns: ["Potential performance issue"],
        },
        mcpToolsUsed: ["analyze"],
      });

      expect(advice.mcpToolsUsed).toContain("analyze");
      expect(expert.mcpAccess).toContain(mcpServer.name);
    });
  });
});
