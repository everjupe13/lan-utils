import type { ChatMessage, ChatServerMessage, Device } from '@nearby/shared/chat';
import type { Connection } from './connection.js';

export type ChatConnection = Connection<ChatServerMessage>;

export interface ChatDeviceSession {
  token: string;
  device: Device;
  connections: Set<ChatConnection>;
}

export interface ChatConversation {
  id: string;
  kind: 'room' | 'direct';
  title: string;
  memberIds: Set<string>;
  messages: ChatMessage[];
}
