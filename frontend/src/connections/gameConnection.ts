import type { ClientMessage, ServerMessage } from '@nearby/shared/protocol';
import type { WebSocketOptions } from '../types/connection';

/** Game wire configuration belongs to composition, not to the domain client. */
export function gameWebSocketOptions(): WebSocketOptions<ClientMessage, ServerMessage> {
  return {
    url: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`,
    encode: (message) => JSON.stringify(message),
    decode: (data) => JSON.parse(data) as ServerMessage,
    classifyClose: (event) => ({
      retryable: event.code !== 4001,
      reason: event.code === 4001 ? 'session_replaced' : event.reason,
    }),
  };
}
