import type { FileAttachment } from './files.js';

export type DeviceKind = 'phone' | 'tablet' | 'computer' | 'unknown';

export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
}

export interface ChatMessage {
  id: string;
  clientMessageId: string;
  conversationId: string;
  sender: Device;
  text: string;
  createdAt: string;
  attachment?: FileAttachment;
}

export interface ConversationSummary {
  id: string;
  kind: 'room' | 'direct';
  title: string;
  memberIds: string[];
  lastMessage: ChatMessage | null;
}

export interface ConversationState extends ConversationSummary {
  messages: ChatMessage[];
}

export type ChatClientMessage =
  | { type: 'hello'; name: string; kind: DeviceKind; sessionToken?: string }
  | { type: 'create_room'; title: string }
  | { type: 'open_conversation'; conversationId: string }
  | { type: 'open_direct'; deviceId: string }
  | { type: 'rename_device'; name: string }
  | { type: 'send_message'; conversationId: string; clientMessageId: string; text: string };

export type ChatServerMessage =
  | {
      type: 'welcome';
      sessionToken: string;
      serverId: string;
      device: Device;
      devices: Device[];
      conversations: ConversationSummary[];
      conversation: ConversationState;
    }
  | { type: 'directory'; devices: Device[]; conversations: ConversationSummary[] }
  | { type: 'conversation'; conversation: ConversationState }
  | { type: 'message'; message: ChatMessage }
  | { type: 'device'; device: Device }
  | { type: 'error'; message: string; requestId?: string };
