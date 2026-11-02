import type { WebSocketOptions, MessageTransport, TransportHandlers } from '../types/connection';

/** Only this adapter knows the browser's WebSocket API and its ready states. */
export class WebSocketTransport<TOutgoing, TIncoming> implements MessageTransport<
  TOutgoing,
  TIncoming
> {
  private socket: WebSocket | null = null;

  constructor(private options: WebSocketOptions<TOutgoing, TIncoming>) {}

  open(handlers: TransportHandlers<TIncoming>) {
    const socket = new WebSocket(this.options.url);
    this.socket = socket;
    socket.onopen = () => handlers.onOpen();
    socket.onmessage = (event) => {
      let message: TIncoming;
      try {
        if (typeof event.data !== 'string') throw new Error('Ожидается текстовое сообщение.');
        message = this.options.decode(event.data);
      } catch {
        handlers.onError(new Error('Не удалось прочитать сообщение сервера.'));
        return;
      }
      handlers.onMessage(message);
    };
    socket.onclose = (event) =>
      handlers.onClose(
        this.options.classifyClose?.(event) ?? { retryable: true, reason: event.reason },
      );
    socket.onerror = () => handlers.onError(new Error('Не удалось установить связь с сервером.'));
  }

  send(message: TOutgoing): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(this.options.encode(message));
    return true;
  }

  close() {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
  }
}
