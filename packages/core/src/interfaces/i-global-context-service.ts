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
  setActiveMeeting(meetingId: string): Promise<void>;
  clearMeeting(): Promise<void>;
  setActiveDecision(flaggedDecisionId: string, templateId?: string, contextId?: string): Promise<DecisionContext>;
  clearDecision(): Promise<void>;
  setActiveField(fieldId: string): Promise<void>;
  clearField(): Promise<void>;
  getContext(): Promise<GlobalContext>;
}
