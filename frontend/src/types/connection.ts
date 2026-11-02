export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ConnectionClose {
  retryable: boolean;
  reason?: string;
}

export interface TransportHandlers<TIncoming> {
  onOpen(): void;
  onMessage(message: TIncoming): void;
  onClose(event: ConnectionClose): void;
  onError(error: Error): void;
}

/** A transport delivers application messages, without exposing sockets or HTTP requests. */
export interface MessageTransport<TOutgoing, TIncoming> {
  open(handlers: TransportHandlers<TIncoming>): void;
  send(message: TOutgoing): boolean;
  close(): void;
}

export type TransportFactory<TOutgoing, TIncoming> = () => MessageTransport<TOutgoing, TIncoming>;

export type ConnectionEvent<TIncoming> =
  | { type: 'open' }
  | { type: 'message'; message: TIncoming }
  | { type: 'close'; event: ConnectionClose }
  | { type: 'error'; error: Error };

export interface ConnectionSnapshot {
  status: ConnectionStatus;
  error: string | null;
}

export interface MessageConnection<TOutgoing, TIncoming> {
  connect(): void;
  disconnect(): void;
  send(message: TOutgoing): boolean;
  subscribe(listener: (event: ConnectionEvent<TIncoming>) => void): () => void;
}

export interface ConnectionOptions {
  retryDelay?: (attempt: number) => number;
}

export interface WebSocketOptions<TOutgoing, TIncoming> {
  url: string;
  encode(message: TOutgoing): string;
  decode(data: string): TIncoming;
  classifyClose?: (event: { code: number; reason: string }) => ConnectionClose;
}
