import type { DecisionEvent } from './decision-events';
import type { EventHandler, IEventBus } from './i-event-bus';

export class InProcessEventBus implements IEventBus {
  private handlers = new Map<DecisionEvent['type'], Set<EventHandler>>();

  async publish<TEvent extends DecisionEvent>(event: TEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    await Promise.all(Array.from(handlers).map((handler) => handler(event)));
  }

  subscribe<TEvent extends DecisionEvent>(eventType: TEvent['type'], handler: EventHandler<TEvent>): () => void {
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler as EventHandler);
    this.handlers.set(eventType, handlers);

    return () => {
      const currentHandlers = this.handlers.get(eventType);
      if (!currentHandlers) {
        return;
      }
      currentHandlers.delete(handler as EventHandler);
      if (currentHandlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }
}
