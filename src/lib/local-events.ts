export type LocalEventPayload = Record<
  string,
  string | number | boolean | null | string[]
>;

export type LocalEvent = {
  id: number;
  type: string;
  payload: LocalEventPayload;
  createdAt: string;
};

type Listener = (event: LocalEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __anorvisLocalEventHub: LocalEventHub | undefined;
}

class LocalEventHub {
  private nextId = 1;
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(type: string, payload: LocalEventPayload = {}): LocalEvent {
    const event: LocalEvent = {
      id: this.nextId,
      type,
      payload,
      createdAt: new Date().toISOString(),
    };
    this.nextId += 1;

    for (const listener of this.listeners) listener(event);
    return event;
  }
}

export function getLocalEventHub(): LocalEventHub {
  globalThis.__anorvisLocalEventHub ??= new LocalEventHub();
  return globalThis.__anorvisLocalEventHub;
}

export function encodeLocalSseEvent(event: LocalEvent): string {
  return [
    `id: local-${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    "",
    "",
  ].join("\n");
}
