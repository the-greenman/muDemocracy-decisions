export interface DecisionContextCreatedEvent {
  type: 'decision-context.created';
  payload: {
    decisionContextId: string;
    meetingId: string;
    flaggedDecisionId: string;
  };
}

export interface DraftGeneratedEvent {
  type: 'draft.generated';
  payload: {
    decisionContextId: string;
    meetingId: string;
  };
}

export interface DecisionLoggedEvent {
  type: 'decision.logged';
  payload: {
    decisionLogId: string;
    decisionContextId: string;
    meetingId: string;
  };
}

export type DecisionEvent =
  | DecisionContextCreatedEvent
  | DraftGeneratedEvent
  | DecisionLoggedEvent;
