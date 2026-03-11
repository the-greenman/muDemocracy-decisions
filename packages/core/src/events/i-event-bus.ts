import type { DecisionEvent } from "./decision-events";

export type EventHandler<TEvent extends DecisionEvent = DecisionEvent> = (
  event: TEvent,
) => void | Promise<void>;

export interface IEventBus {
  publish<TEvent extends DecisionEvent>(event: TEvent): Promise<void>;
  subscribe<TEvent extends DecisionEvent>(
    eventType: TEvent["type"],
    handler: EventHandler<TEvent>,
  ): () => void;
}
