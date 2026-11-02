import type { ChatClientMessage, ChatServerMessage } from '@nearby/shared/chat';
import type { WebSocketOptions } from '../types/connection';

export function chatWebSocketOptions(): WebSocketOptions<ChatClientMessage, ChatServerMessage> {
  return {
    url: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/chat`,
    encode: (message) => JSON.stringify(message),
    decode: (data) => JSON.parse(data) as ChatServerMessage,
  };
}
