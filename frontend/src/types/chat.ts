import type {
  Device,
  DeviceKind,
  ConversationState,
  ConversationSummary,
} from '@nearby/shared/chat';

export interface ChatIdentity {
  name: string;
  kind: DeviceKind;
  sessionToken?: string;
}
export interface ChatStorage {
  readIdentity(): ChatIdentity | null;
  writeIdentity(identity: ChatIdentity): void;
  readConversation(): string | null;
  writeConversation(id: string): void;
}
export interface PendingMessage {
  conversationId: string;
  clientMessageId: string;
  text: string;
}
export interface ChatSnapshot {
  status: 'connecting' | 'connected' | 'reconnecting' | 'rejected';
  device: Device | null;
  devices: Device[];
  conversations: ConversationSummary[];
  conversation: ConversationState | null;
  pending: PendingMessage | null;
  lastSent: PendingMessage | null;
  unread: Record<string, number>;
  error: string;
}
