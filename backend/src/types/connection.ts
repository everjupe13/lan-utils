import type { ServerMessage } from '@nearby/shared/protocol';

export interface Connection<TMessage = ServerMessage> {
  send(message: TMessage): void;
  close(): void;
}
