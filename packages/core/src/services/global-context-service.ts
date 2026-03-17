import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";
import type { IConnectionRepository } from "../interfaces/i-connection-repository";
import type { IMeetingRepository } from "../interfaces/i-meeting-repository";
import type { IDecisionContextService } from "../interfaces/i-decision-context-service";
import type { IDecisionTemplateService } from "../interfaces/i-decision-template-service";
import type { IFlaggedDecisionService } from "../interfaces/i-flagged-decision-service";
import type {
  GlobalContext,
  GlobalContextState,
  IGlobalContextService,
  IGlobalContextStore,
} from "../interfaces/i-global-context-service";
import type { DecisionContext, DecisionTemplate } from "@repo/schema";

// ---------------------------------------------------------------------------
// Legacy stores — kept for unit tests only
// ---------------------------------------------------------------------------

export class InMemoryGlobalContextStore implements IGlobalContextStore {
  constructor(private state: GlobalContextState = {}) {}

  async load(): Promise<GlobalContextState> {
    return { ...this.state };
  }

  async save(state: GlobalContextState): Promise<void> {
    this.state = { ...state };
  }
}

export class FileGlobalContextStore implements IGlobalContextStore {
  constructor(
    private readonly filePath: string = join(homedir(), ".decision-logger", "context.json"),
  ) {}

  async load(): Promise<GlobalContextState> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as GlobalContextState;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  async save(state: GlobalContextState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
    await rename(tmp, this.filePath);
  }
}

// ---------------------------------------------------------------------------
// GlobalContextService — DB-backed via IConnectionRepository
// ---------------------------------------------------------------------------

type TemplateLookup = Pick<IDecisionTemplateService, "getDefaultTemplate" | "getTemplate">;

export class GlobalContextService implements IGlobalContextService {
  constructor(
    private readonly connectionRepository: IConnectionRepository,
    private readonly meetingRepository: IMeetingRepository,
    private readonly flaggedDecisionService: IFlaggedDecisionService,
    private readonly decisionContextService: IDecisionContextService,
    private readonly decisionTemplateService: TemplateLookup,
  ) {}

  async setActiveMeeting(connectionId: string, meetingId: string): Promise<void> {
    const meeting = await this.meetingRepository.findById(meetingId);
    if (!meeting) throw new Error("Meeting not found");
    if (meeting.status === "ended")
      throw new Error("Ended meetings cannot be selected as the active context");

    const current = await this.connectionRepository.findById(connectionId);
    if (current?.activeMeetingId === meetingId) {
      await this.connectionRepository.upsert(connectionId, { activeMeetingId: meetingId });
    } else {
      await this.connectionRepository.upsert(connectionId, {
        activeMeetingId: meetingId,
        activeDecisionId: null,
        activeDecisionContextId: null,
        activeField: null,
      });
    }
  }

  async clearMeeting(connectionId: string): Promise<void> {
    await this.connectionRepository.upsert(connectionId, {
      activeMeetingId: null,
      activeDecisionId: null,
      activeDecisionContextId: null,
      activeField: null,
    });
  }

  async setActiveDecision(
    connectionId: string,
    flaggedDecisionId: string,
    templateId?: string,
    contextId?: string,
  ): Promise<DecisionContext> {
    const decision = await this.flaggedDecisionService.getDecisionById(flaggedDecisionId);
    if (!decision) throw new Error("Flagged decision not found");

    const existing = contextId
      ? ((await this.decisionContextService.getById(contextId)) ?? undefined)
      : ((await this.decisionContextService.getContextByFlaggedDecision(flaggedDecisionId)) ??
        undefined);
    const context =
      existing ??
      (await this.decisionContextService.createContext({
        meetingId: decision.meetingId,
        flaggedDecisionId,
        title: decision.suggestedTitle,
        templateId: templateId ?? (await this.getDefaultTemplateId()),
      }));

    await this.connectionRepository.upsert(connectionId, {
      activeMeetingId: decision.meetingId,
      activeDecisionId: flaggedDecisionId,
      activeDecisionContextId: context.id,
    });

    return context;
  }

  async clearDecision(connectionId: string): Promise<void> {
    const current = await this.connectionRepository.findById(connectionId);
    await this.connectionRepository.upsert(connectionId, {
      activeMeetingId: current?.activeMeetingId ?? null,
      activeDecisionId: null,
      activeDecisionContextId: null,
      activeField: null,
    });
  }

  async setActiveField(connectionId: string, fieldId: string): Promise<void> {
    const current = await this.connectionRepository.findById(connectionId);
    if (!current?.activeDecisionContextId) throw new Error("No active decision context");

    const updated = await this.decisionContextService.setActiveField(
      current.activeDecisionContextId,
      fieldId,
    );
    if (!updated) throw new Error("Decision context not found");

    await this.connectionRepository.upsert(connectionId, { activeField: fieldId });
  }

  async clearField(connectionId: string): Promise<void> {
    const current = await this.connectionRepository.findById(connectionId);
    if (current?.activeDecisionContextId) {
      const updated = await this.decisionContextService.setActiveField(
        current.activeDecisionContextId,
        null,
      );
      if (!updated) throw new Error("Decision context not found");
    }
    await this.connectionRepository.upsert(connectionId, { activeField: null });
  }

  async getContext(connectionId: string): Promise<GlobalContext> {
    const conn = await this.connectionRepository.findById(connectionId);
    if (!conn) return {};

    const state: GlobalContextState = {};
    if (conn.activeMeetingId) state.activeMeetingId = conn.activeMeetingId;
    if (conn.activeDecisionId) state.activeDecisionId = conn.activeDecisionId;
    if (conn.activeDecisionContextId) state.activeDecisionContextId = conn.activeDecisionContextId;
    if (conn.activeField) state.activeField = conn.activeField;

    const activeMeeting = state.activeMeetingId
      ? ((await this.meetingRepository.findById(state.activeMeetingId)) ?? undefined)
      : undefined;

    if (state.activeMeetingId !== undefined && activeMeeting?.status === "ended") {
      await this.connectionRepository.upsert(connectionId, {
        activeMeetingId: null,
        activeDecisionId: null,
        activeDecisionContextId: null,
        activeField: null,
      });
      return {};
    }
    if (state.activeMeetingId !== undefined && activeMeeting === undefined) {
      await this.connectionRepository.upsert(connectionId, {
        activeMeetingId: null,
        activeDecisionId: null,
        activeDecisionContextId: null,
        activeField: null,
      });
      return {};
    }

    const activeDecision = state.activeDecisionId
      ? ((await this.flaggedDecisionService.getDecisionById(state.activeDecisionId)) ?? undefined)
      : undefined;
    const activeDecisionContext = state.activeDecisionContextId
      ? ((await this.decisionContextService.getById(state.activeDecisionContextId)) ?? undefined)
      : state.activeDecisionId
        ? ((await this.decisionContextService.getContextByFlaggedDecision(
            state.activeDecisionId,
          )) ?? undefined)
        : undefined;
    const activeTemplate = activeDecisionContext?.templateId
      ? await this.getTemplateById(activeDecisionContext.templateId)
      : undefined;

    const resolvedActiveField =
      state.activeField ?? activeDecisionContext?.activeField ?? undefined;
    const resolvedDecisionContextId = activeDecisionContext?.id ?? state.activeDecisionContextId;

    const context: GlobalContext = {};
    if (state.activeMeetingId !== undefined) context.activeMeetingId = state.activeMeetingId;
    if (state.activeDecisionId !== undefined) context.activeDecisionId = state.activeDecisionId;
    if (resolvedDecisionContextId !== undefined)
      context.activeDecisionContextId = resolvedDecisionContextId;
    if (resolvedActiveField !== undefined) context.activeField = resolvedActiveField;
    if (activeMeeting !== undefined) context.activeMeeting = activeMeeting;
    if (activeDecision !== undefined) context.activeDecision = activeDecision;
    if (activeDecisionContext !== undefined) context.activeDecisionContext = activeDecisionContext;
    if (activeTemplate !== undefined) context.activeTemplate = activeTemplate;

    return context;
  }

  private async getDefaultTemplateId(): Promise<string> {
    const template = await this.decisionTemplateService.getDefaultTemplate();
    if (!template) throw new Error("Default template not found");
    return template.id;
  }

  private async getTemplateById(templateId: string): Promise<DecisionTemplate | undefined> {
    return (await this.decisionTemplateService.getTemplate(templateId)) ?? undefined;
  }
}
