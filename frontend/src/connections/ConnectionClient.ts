import type {
  ConnectionEvent,
  ConnectionOptions,
  MessageConnection,
  ConnectionSnapshot,
  MessageTransport,
  TransportFactory,
} from '../types/connection';

/** Owns reconnection and subscriptions; has no knowledge of WebSocket or chess. */
export class ConnectionClient<TOutgoing, TIncoming> implements MessageConnection<
  TOutgoing,
  TIncoming
> {
  private transport: MessageTransport<TOutgoing, TIncoming> | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private generation = 0;
  private attempts = 0;
  private snapshot: ConnectionSnapshot = { status: 'idle', error: null };
  private stateListeners = new Set<() => void>();
  private eventListeners = new Set<(event: ConnectionEvent<TIncoming>) => void>();

  constructor(
    private factory: TransportFactory<TOutgoing, TIncoming>,
    private options: ConnectionOptions = {},
  ) {}

  getSnapshot = (): ConnectionSnapshot => this.snapshot;

  subscribeState = (listener: () => void) => {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  };

  subscribe = (listener: (event: ConnectionEvent<TIncoming>) => void) => {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  };

  connect = () => {
    if (this.running) return;
    this.running = true;
    this.attempts = 0;
    this.open();
  };

  disconnect = () => {
    this.running = false;
    this.generation++;
    clearTimeout(this.retry);
    const transport = this.transport;
    this.transport = null;
    transport?.close();
    this.update({ status: 'closed', error: null });
  };

  send = (message: TOutgoing): boolean => {
    if (this.snapshot.status !== 'open' || !this.transport) return false;
    try {
      return this.transport.send(message);
    } catch (error) {
      this.reportError(error);
      return false;
    }
  };

  private open() {
    const generation = ++this.generation;
    const current = () => this.running && generation === this.generation;
    this.update({ status: this.attempts ? 'reconnecting' : 'connecting', error: null });
    try {
      const transport = this.factory();
      this.transport = transport;
      transport.open({
        onOpen: () => {
          if (!current()) return;
          this.attempts = 0;
          this.update({ status: 'open', error: null });
          this.emit({ type: 'open' });
        },
        onMessage: (message) => {
          if (current()) this.emit({ type: 'message', message });
        },
        onError: (error) => {
          if (current()) this.reportError(error);
        },
        onClose: (event) => {
          if (!current()) return;
          // Invalidate late callbacks from a transport that is already closed.
          this.generation++;
          this.transport = null;
          this.update({
            status: event.retryable ? 'reconnecting' : 'closed',
            error: this.snapshot.error,
          });
          this.emit({ type: 'close', event });
          if (event.retryable && this.running) this.scheduleRetry();
          else this.running = false;
        },
      });
    } catch (error) {
      if (!current()) return;
      this.reportError(error);
      this.generation++;
      const transport = this.transport;
      this.transport = null;
      transport?.close();
      this.update({ status: 'reconnecting', error: this.snapshot.error });
      this.scheduleRetry();
    }
  }

  private scheduleRetry() {
    const attempt = ++this.attempts;
    const delay = this.options.retryDelay?.(attempt) ?? Math.min(1000 * 2 ** (attempt - 1), 10_000);
    this.retry = setTimeout(() => {
      if (this.running) this.open();
    }, delay);
  }

  private reportError(value: unknown) {
    const error = value instanceof Error ? value : new Error('Ошибка соединения.');
    this.update({ ...this.snapshot, error: error.message });
    this.emit({ type: 'error', error });
  }

  private update(snapshot: ConnectionSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.stateListeners) listener();
  }

  private emit(event: ConnectionEvent<TIncoming>) {
    for (const listener of this.eventListeners) listener(event);
  }
}
