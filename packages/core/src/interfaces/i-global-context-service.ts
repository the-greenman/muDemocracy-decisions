import type { DecisionContext, DecisionTemplate, FlaggedDecision, Meeting } from "@repo/schema";

export type GlobalContextState = {
  activeMeetingId?: string;
  activeDecisionId?: string;
  activeDecisionContextId?: string;
  activeField?: string;
};

export type GlobalContext = GlobalContextState & {
  activeMeeting?: Meeting;
  activeDecision?: FlaggedDecision;
  activeDecisionContext?: DecisionContext;
  activeTemplate?: DecisionTemplate;
};

export interface IGlobalContextStore {
  load(): Promise<GlobalContextState>;
  save(state: GlobalContextState): Promise<void>;
}

export interface IGlobalContextService {
  setActiveMeeting(connectionId: string, meetingId: string): Promise<void>;
  clearMeeting(connectionId: string): Promise<void>;
  setActiveDecision(connectionId: string, flaggedDecisionId: string, templateId?: string, contextId?: string): Promise<DecisionContext>;
  clearDecision(connectionId: string): Promise<void>;
  setActiveField(connectionId: string, fieldId: string): Promise<void>;
  clearField(connectionId: string): Promise<void>;
  getContext(connectionId: string): Promise<GlobalContext>;
}
