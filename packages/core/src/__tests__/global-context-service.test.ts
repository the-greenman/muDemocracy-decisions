import { describe, it, expect, beforeEach } from "vitest";
import type {
  IDecisionContextService,
  IFlaggedDecisionService,
  IMeetingRepository,
} from "@repo/core";
import type { DecisionContext, DecisionTemplate, FlaggedDecision, Meeting } from "@repo/schema";
import type {
  IGlobalContextService,
  IGlobalContextStore,
  GlobalContextState,
} from "../interfaces/i-global-context-service";
import { GlobalContextService } from "../services/global-context-service";

class MockGlobalContextStore implements IGlobalContextStore {
  private state: GlobalContextState = {};

  async load(): Promise<GlobalContextState> {
    return { ...this.state };
  }

  async save(state: GlobalContextState): Promise<void> {
    this.state = { ...state };
  }
}

class MockMeetingRepository implements IMeetingRepository {
  constructor(private meetings: Map<string, Meeting>) {}

  async create(): Promise<Meeting> {
    throw new Error("Not implemented");
  }

  async findById(id: string): Promise<Meeting | null> {
    return this.meetings.get(id) ?? null;
  }

  async findAll(): Promise<Meeting[]> {
    return Array.from(this.meetings.values());
  }

  async update(): Promise<Meeting> {
    throw new Error("Not implemented");
  }

  async updateStatus(): Promise<Meeting> {
    throw new Error("Not implemented");
  }
}

class MockFlaggedDecisionService implements IFlaggedDecisionService {
  constructor(private decisions: Map<string, FlaggedDecision>) {}

  async createFlaggedDecision(): Promise<FlaggedDecision> {
    throw new Error("Not implemented");
  }

  async getDecisionsForMeeting(meetingId: string): Promise<FlaggedDecision[]> {
    return Array.from(this.decisions.values()).filter(
      (decision) => decision.meetingId === meetingId,
    );
  }

  async getDecisionById(id: string): Promise<FlaggedDecision | null> {
    return this.decisions.get(id) ?? null;
  }

  async updateDecision(): Promise<FlaggedDecision | null> {
    throw new Error("Not implemented");
  }

  async resolveChunkIdsFromSequenceSpec(): Promise<string[]> {
    throw new Error("Not implemented");
  }

  async updateDecisionStatus(): Promise<FlaggedDecision> {
    throw new Error("Not implemented");
  }

  async updateDecisionPriority(): Promise<void> {
    throw new Error("Not implemented");
  }

  async prioritizeDecisions(): Promise<void> {
    throw new Error("Not implemented");
  }
}

class MockDecisionContextService implements IDecisionContextService {
  private contexts = new Map<string, DecisionContext>();

  seed(context: DecisionContext) {
    this.contexts.set(context.id, context);
  }

  async createContext(data: {
    meetingId: string;
    flaggedDecisionId: string;
    title: string;
    templateId: string;
  }): Promise<DecisionContext> {
    const context: DecisionContext = {
      id: crypto.randomUUID(),
      meetingId: data.meetingId,
      flaggedDecisionId: data.flaggedDecisionId,
      title: data.title,
      templateId: data.templateId,
      lockedFields: [],
      draftVersions: [],
      status: "drafting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(context.id, context);
    return context;
  }

  async updateDraftData(): Promise<DecisionContext | null> {
    throw new Error("Not implemented");
  }

  async setFieldValue(): Promise<DecisionContext | null> {
    throw new Error("Not implemented");
  }

  async saveSnapshot(): Promise<DecisionContext | null> {
    throw new Error("Not implemented");
  }

  async rollback(): Promise<DecisionContext | null> {
    throw new Error("Not implemented");
  }

  async listVersions(): Promise<Array<{ version: number; savedAt: string; fieldCount: number }>> {
    return [];
  }

  async lockField(): Promise<DecisionContext | null> {
    throw new Error("Not implemented");
  }

  async unlockField(): Promise<DecisionContext | null> {
    throw new Error("Not implemented");
  }

  async setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null> {
    const context = this.contexts.get(id);
    if (!context) {
      return null;
    }

    const updated: DecisionContext = {
      ...context,
      activeField: fieldId ?? undefined,
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(id, updated);
    return updated;
  }

  async submitForReview(): Promise<DecisionContext | null> {
    throw new Error("Not implemented");
  }

  async approveAndLock(): Promise<DecisionContext | null> {
    throw new Error("Not implemented");
  }

  async reopenForEditing(): Promise<DecisionContext | null> {
    throw new Error("Not implemented");
  }

  async getById(id: string): Promise<DecisionContext | null> {
    return this.contexts.get(id) ?? null;
  }

  async getContextByFlaggedDecision(flaggedDecisionId: string): Promise<DecisionContext | null> {
    return (
      Array.from(this.contexts.values()).find(
        (context) => context.flaggedDecisionId === flaggedDecisionId,
      ) ?? null
    );
  }

  async getAllContextsForMeeting(meetingId: string): Promise<DecisionContext[]> {
    return Array.from(this.contexts.values()).filter((context) => context.meetingId === meetingId);
  }
}

class MockDecisionTemplateLookup {
  constructor(private defaultTemplateId: string) {}

  async getTemplate(id: string): Promise<DecisionTemplate | null> {
    return {
      id,
      name: "Default Template",
      description: "Default template",
      category: "standard",
      fields: [],
      version: 1,
      isDefault: id === this.defaultTemplateId,
      isCustom: false,
      createdAt: new Date().toISOString(),
    };
  }

  async getDefaultTemplate(): Promise<DecisionTemplate | null> {
    return {
      id: this.defaultTemplateId,
      name: "Default Template",
      description: "Default template",
      category: "standard",
      fields: [],
      version: 1,
      isDefault: true,
      isCustom: false,
      createdAt: new Date().toISOString(),
    };
  }
}

describe("GlobalContextService", () => {
  let store: MockGlobalContextStore;
  let meetings: Map<string, Meeting>;
  let decisions: Map<string, FlaggedDecision>;
  let meetingRepository: IMeetingRepository;
  let flaggedDecisionService: IFlaggedDecisionService;
  let decisionContextService: MockDecisionContextService;
  let templateService: MockDecisionTemplateLookup;
  let service: IGlobalContextService;
  let meeting: Meeting;
  let decision: FlaggedDecision;
  let defaultTemplateId: string;

  beforeEach(() => {
    store = new MockGlobalContextStore();
    defaultTemplateId = crypto.randomUUID();

    meeting = {
      id: crypto.randomUUID(),
      title: "Planning Meeting",
      date: new Date().toISOString(),
      participants: ["Alice", "Bob"],
      status: "active",
      createdAt: new Date().toISOString(),
    };

    decision = {
      id: crypto.randomUUID(),
      meetingId: meeting.id,
      suggestedTitle: "Approve roadmap",
      contextSummary: "Team aligned on roadmap scope",
      confidence: 1,
      chunkIds: [crypto.randomUUID()],
      status: "pending",
      priority: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    meetings = new Map([[meeting.id, meeting]]);
    decisions = new Map([[decision.id, decision]]);
    meetingRepository = new MockMeetingRepository(meetings);
    flaggedDecisionService = new MockFlaggedDecisionService(decisions);
    decisionContextService = new MockDecisionContextService();
    templateService = new MockDecisionTemplateLookup(defaultTemplateId);
    service = new GlobalContextService(
      store,
      meetingRepository,
      flaggedDecisionService,
      decisionContextService,
      templateService,
    );
  });

  it("sets and returns the active meeting with nested meeting data", async () => {
    await service.setActiveMeeting(meeting.id);

    const context = await service.getContext();

    expect(context.activeMeetingId).toBe(meeting.id);
    expect(context.activeMeeting?.title).toBe("Planning Meeting");
    expect(context.activeDecisionId).toBeUndefined();
  });

  it("creates a decision context from a flagged decision using the default template", async () => {
    const context = await service.setActiveDecision(decision.id);
    const loaded = await service.getContext();

    expect(context.meetingId).toBe(meeting.id);
    expect(context.flaggedDecisionId).toBe(decision.id);
    expect(context.templateId).toBe(defaultTemplateId);
    expect(loaded.activeMeetingId).toBe(meeting.id);
    expect(loaded.activeDecisionId).toBe(decision.id);
    expect(loaded.activeDecisionContextId).toBe(context.id);
    expect(loaded.activeDecision?.suggestedTitle).toBe("Approve roadmap");
    expect(loaded.activeDecisionContext?.id).toBe(context.id);
  });

  it("reuses an existing decision context for the flagged decision", async () => {
    const existing: DecisionContext = {
      id: crypto.randomUUID(),
      meetingId: meeting.id,
      flaggedDecisionId: decision.id,
      title: decision.suggestedTitle,
      templateId: defaultTemplateId,
      lockedFields: [],
      draftVersions: [],
      status: "drafting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    decisionContextService.seed(existing);

    const context = await service.setActiveDecision(decision.id);

    expect(context.id).toBe(existing.id);
  });

  it("sets and clears the active field on the active decision context", async () => {
    const context = await service.setActiveDecision(decision.id);

    await service.setActiveField("options");
    let loaded = await service.getContext();
    expect(loaded.activeField).toBe("options");
    expect(loaded.activeDecisionContext?.activeField).toBe("options");

    await service.clearField();
    loaded = await service.getContext();
    expect(loaded.activeField).toBeUndefined();
    expect(loaded.activeDecisionContext?.activeField).toBeUndefined();
    expect(loaded.activeDecisionContextId).toBe(context.id);
  });

  it("clears decision and field while preserving the active meeting", async () => {
    await service.setActiveMeeting(meeting.id);
    await service.setActiveDecision(decision.id);
    await service.setActiveField("options");

    await service.clearDecision();
    const context = await service.getContext();

    expect(context.activeMeetingId).toBe(meeting.id);
    expect(context.activeDecisionId).toBeUndefined();
    expect(context.activeDecisionContextId).toBeUndefined();
    expect(context.activeField).toBeUndefined();
  });

  it("clears the entire context when clearing the active meeting", async () => {
    await service.setActiveMeeting(meeting.id);
    await service.setActiveDecision(decision.id);
    await service.setActiveField("options");

    await service.clearMeeting();
    const context = await service.getContext();

    expect(context.activeMeetingId).toBeUndefined();
    expect(context.activeDecisionId).toBeUndefined();
    expect(context.activeDecisionContextId).toBeUndefined();
    expect(context.activeField).toBeUndefined();
  });

  it("persists context state across service instances sharing the same store", async () => {
    const first = new GlobalContextService(
      store,
      meetingRepository,
      flaggedDecisionService,
      decisionContextService,
      templateService,
    );
    await first.setActiveMeeting(meeting.id);
    const createdContext = await first.setActiveDecision(decision.id, defaultTemplateId);
    await first.setActiveField("decision_statement");

    const second = new GlobalContextService(
      store,
      meetingRepository,
      flaggedDecisionService,
      decisionContextService,
      templateService,
    );
    const loaded = await second.getContext();

    expect(loaded.activeMeetingId).toBe(meeting.id);
    expect(loaded.activeDecisionId).toBe(decision.id);
    expect(loaded.activeDecisionContextId).toBe(createdContext.id);
    expect(loaded.activeField).toBe("decision_statement");
  });
});
