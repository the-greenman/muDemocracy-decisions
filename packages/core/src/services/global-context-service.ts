import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";
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
    await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf-8");
  }
}

type TemplateLookup = Pick<IDecisionTemplateService, "getDefaultTemplate" | "getTemplate">;

export class GlobalContextService implements IGlobalContextService {
  constructor(
    private readonly store: IGlobalContextStore,
    private readonly meetingRepository: IMeetingRepository,
    private readonly flaggedDecisionService: IFlaggedDecisionService,
    private readonly decisionContextService: IDecisionContextService,
    private readonly decisionTemplateService: TemplateLookup,
  ) {}

  async setActiveMeeting(meetingId: string): Promise<void> {
    const meeting = await this.meetingRepository.findById(meetingId);
    if (!meeting) {
      throw new Error("Meeting not found");
    }
    if (meeting.status === "ended") {
      throw new Error("Ended meetings cannot be selected as the active context");
    }

    const current = await this.store.load();
    if (current.activeMeetingId === meetingId) {
      // Same meeting — preserve decision context
      await this.store.save({ ...current, activeMeetingId: meetingId });
    } else {
      // Different meeting — clear decision context
      await this.store.save({ activeMeetingId: meetingId });
    }
  }

  async clearMeeting(): Promise<void> {
    await this.store.save({});
  }

  async setActiveDecision(
    flaggedDecisionId: string,
    templateId?: string,
    contextId?: string,
  ): Promise<DecisionContext> {
    const decision = await this.flaggedDecisionService.getDecisionById(flaggedDecisionId);
    if (!decision) {
      throw new Error("Flagged decision not found");
    }

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

    await this.store.save({
      activeMeetingId: decision.meetingId,
      activeDecisionId: flaggedDecisionId,
      activeDecisionContextId: context.id,
    });

    return context;
  }

  async clearDecision(): Promise<void> {
    const current = await this.store.load();
    const nextState: GlobalContextState = {};
    if (current.activeMeetingId !== undefined) {
      nextState.activeMeetingId = current.activeMeetingId;
    }

    await this.store.save(nextState);
  }

  async setActiveField(fieldId: string): Promise<void> {
    const current = await this.store.load();
    if (!current.activeDecisionContextId) {
      throw new Error("No active decision context");
    }

    const updated = await this.decisionContextService.setActiveField(
      current.activeDecisionContextId,
      fieldId,
    );
    if (!updated) {
      throw new Error("Decision context not found");
    }

    await this.store.save({
      ...current,
      activeField: fieldId,
    });
  }

  async clearField(): Promise<void> {
    const current = await this.store.load();
    if (current.activeDecisionContextId) {
      const updated = await this.decisionContextService.setActiveField(
        current.activeDecisionContextId,
        null,
      );
      if (!updated) {
        throw new Error("Decision context not found");
      }
    }

    const nextState: GlobalContextState = {};
    if (current.activeMeetingId !== undefined) {
      nextState.activeMeetingId = current.activeMeetingId;
    }
    if (current.activeDecisionId !== undefined) {
      nextState.activeDecisionId = current.activeDecisionId;
    }
    if (current.activeDecisionContextId !== undefined) {
      nextState.activeDecisionContextId = current.activeDecisionContextId;
    }

    await this.store.save(nextState);
  }

  async getContext(): Promise<GlobalContext> {
    const state = await this.store.load();
    const activeMeeting = state.activeMeetingId
      ? ((await this.meetingRepository.findById(state.activeMeetingId)) ?? undefined)
      : undefined;
    if (state.activeMeetingId !== undefined && activeMeeting?.status === "ended") {
      await this.store.save({});
      return {};
    }
    if (state.activeMeetingId !== undefined && activeMeeting === undefined) {
      await this.store.save({});
      return {};
    }
    const activeDecision = state.activeDecisionId
      ? ((await this.flaggedDecisionService.getDecisionById(state.activeDecisionId)) ?? undefined)
      : undefined;
    const activeDecisionContext = state.activeDecisionContextId
      ? ((await this.decisionContextService.getById(state.activeDecisionContextId)) ?? undefined)
      : state.activeDecisionId
        ? ((await this.decisionContextService.getContextByFlaggedDecision(state.activeDecisionId)) ??
          undefined)
        : undefined;
    const activeTemplate = activeDecisionContext?.templateId
      ? await this.getTemplateById(activeDecisionContext.templateId)
      : undefined;

    const context: GlobalContext = {};
    const resolvedActiveField =
      state.activeField ?? activeDecisionContext?.activeField ?? undefined;
    if (state.activeMeetingId !== undefined) {
      context.activeMeetingId = state.activeMeetingId;
    }
    if (state.activeDecisionId !== undefined) {
      context.activeDecisionId = state.activeDecisionId;
    }
    const resolvedDecisionContextId = activeDecisionContext?.id ?? state.activeDecisionContextId;
    if (resolvedDecisionContextId !== undefined) {
      context.activeDecisionContextId = resolvedDecisionContextId;
    }
    if (resolvedActiveField !== undefined) {
      context.activeField = resolvedActiveField;
    }
    if (activeMeeting !== undefined) {
      context.activeMeeting = activeMeeting;
    }
    if (activeDecision !== undefined) {
      context.activeDecision = activeDecision;
    }
    if (activeDecisionContext !== undefined) {
      context.activeDecisionContext = activeDecisionContext;
    }
    if (activeTemplate !== undefined) {
      context.activeTemplate = activeTemplate;
    }

    return context;
  }

  private async getDefaultTemplateId(): Promise<string> {
    const template = await this.decisionTemplateService.getDefaultTemplate();
    if (!template) {
      throw new Error("Default template not found");
    }
    return template.id;
  }

  private async getTemplateById(templateId: string): Promise<DecisionTemplate | undefined> {
    return (await this.decisionTemplateService.getTemplate(templateId)) ?? undefined;
  }
}
