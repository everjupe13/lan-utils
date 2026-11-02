import { randomBytes, randomUUID } from 'node:crypto';
import type {
  ChatClientMessage,
  ConversationState,
  ConversationSummary,
  DeviceKind,
  ChatMessage,
  Device,
} from '@nearby/shared/chat';
import type { FileAttachment } from '@nearby/shared/files';
import type { ChatConnection, ChatConversation, ChatDeviceSession } from '../types/chat-service.js';

export const MESSAGE_LIMIT = 500;
export const GENERAL_ROOM_ID = 'general';

export class ChatService {
  private serverId = randomUUID();
  private sessions = new Map<string, ChatDeviceSession>();
  private peers = new Map<ChatConnection, ChatDeviceSession>();
  private conversations = new Map<string, ChatConversation>([
    [
      GENERAL_ROOM_ID,
      {
        id: GENERAL_ROOM_ID,
        kind: 'room',
        title: 'Общая',
        memberIds: new Set(),
        messages: [],
      },
    ],
  ]);

  constructor(private onMessageRemoved: (message: ChatMessage) => void = () => {}) {}

  deviceForToken(token: string): Device | null {
    return this.sessions.get(token)?.device ?? null;
  }

  assertMember(conversationId: string, deviceId: string) {
    this.access(conversationId, deviceId);
  }

  findMessage(conversationId: string, deviceId: string, requestId: string) {
    return this.access(conversationId, deviceId).messages.find(
      (message) => message.sender.id === deviceId && message.clientMessageId === requestId,
    );
  }

  publishFile(
    conversationId: string,
    device: Device,
    requestId: string,
    attachment: FileAttachment,
  ) {
    const conversation = this.access(conversationId, device.id);
    const message: ChatMessage = {
      id: randomUUID(),
      clientMessageId: requestId,
      conversationId,
      sender: { ...device },
      text: '',
      attachment,
      createdAt: new Date().toISOString(),
    };
    this.appendMessage(conversation, message);
    return message;
  }

  hello(connection: ChatConnection, name: string, kind: DeviceKind, sessionToken?: string) {
    if (this.peers.has(connection)) throw new Error('Устройство уже подключено.');
    let session = sessionToken ? this.sessions.get(sessionToken) : undefined;
    if (!session) {
      if (this.sessions.size >= 256) throw new Error('Слишком много устройств на сервере.');
      session = {
        token: randomBytes(32).toString('hex'),
        device: { id: randomUUID(), name, kind },
        connections: new Set(),
      };
      this.sessions.set(session.token, session);
    }
    session.connections.add(connection);
    this.peers.set(connection, session);
    const general = this.conversations.get(GENERAL_ROOM_ID)!;
    general.memberIds.add(session.device.id);
    connection.send({
      type: 'welcome',
      sessionToken: session.token,
      serverId: this.serverId,
      device: { ...session.device },
      devices: this.devices(),
      conversations: this.list(session),
      conversation: this.snapshot(general),
    });
    this.broadcastDirectory();
  }

  disconnect(connection: ChatConnection) {
    const session = this.peers.get(connection);
    if (!session) return;
    session.connections.delete(connection);
    this.peers.delete(connection);
    this.broadcastDirectory();
  }

  handle(connection: ChatConnection, command: Exclude<ChatClientMessage, { type: 'hello' }>) {
    const session = this.peers.get(connection);
    if (!session) throw new Error('Сначала подключите устройство.');
    const deviceId = session.device.id;
    switch (command.type) {
      case 'create_room': {
        if (this.conversations.size >= 100)
          throw new Error('Достигнут лимит комнат и диалогов (100).');
        const conversation: ChatConversation = {
          id: randomUUID(),
          title: command.title,
          kind: 'room',
          memberIds: new Set([deviceId]),
          messages: [],
        };
        this.conversations.set(conversation.id, conversation);
        connection.send({ type: 'conversation', conversation: this.snapshot(conversation) });
        this.broadcastDirectory();
        break;
      }
      case 'open_conversation': {
        const conversation = this.access(command.conversationId, deviceId, true);
        conversation.memberIds.add(deviceId);
        connection.send({ type: 'conversation', conversation: this.snapshot(conversation) });
        this.broadcastDirectory();
        break;
      }
      case 'open_direct': {
        if (command.deviceId === deviceId) throw new Error('Выберите другое устройство.');
        const target = [...this.sessions.values()].find(
          (value) => value.device.id === command.deviceId,
        );
        if (!target) throw new Error('Устройство не найдено.');
        let conversation = [...this.conversations.values()].find(
          (value) =>
            value.kind === 'direct' &&
            value.memberIds.has(deviceId) &&
            value.memberIds.has(command.deviceId),
        );
        if (!conversation) {
          if (this.conversations.size >= 100)
            throw new Error('Достигнут лимит комнат и диалогов (100).');
          conversation = {
            id: randomUUID(),
            title: `${session.device.name} ↔ ${target.device.name}`,
            kind: 'direct',
            memberIds: new Set([deviceId, target.device.id]),
            messages: [],
          };
          this.conversations.set(conversation.id, conversation);
        }
        connection.send({ type: 'conversation', conversation: this.snapshot(conversation) });
        this.broadcastDirectory();
        break;
      }
      case 'rename_device':
        session.device.name = command.name;
        for (const peer of session.connections)
          peer.send({ type: 'device', device: { ...session.device } });
        this.broadcastDirectory();
        break;
      case 'send_message': {
        const conversation = this.access(command.conversationId, deviceId);
        const existing = conversation.messages.find(
          (message) =>
            message.sender.id === deviceId && message.clientMessageId === command.clientMessageId,
        );
        if (existing) {
          connection.send({ type: 'message', message: existing });
          break;
        }
        const message = {
          id: randomUUID(),
          clientMessageId: command.clientMessageId,
          conversationId: conversation.id,
          sender: { ...session.device },
          text: command.text,
          createdAt: new Date().toISOString(),
        };
        this.appendMessage(conversation, message);
        break;
      }
    }
  }

  private appendMessage(conversation: ChatConversation, message: ChatMessage) {
    conversation.messages.push(message);
    if (conversation.messages.length > MESSAGE_LIMIT) {
      for (const removed of conversation.messages.splice(
        0,
        conversation.messages.length - MESSAGE_LIMIT,
      ))
        this.onMessageRemoved(removed);
    }
    for (const [peer, member] of this.peers) {
      if (conversation.memberIds.has(member.device.id)) peer.send({ type: 'message', message });
    }
    this.broadcastDirectory();
  }

  private access(id: string, deviceId: string, joining = false) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new Error('Чат не найден. Возможно, сервер был перезапущен.');
    if (!conversation.memberIds.has(deviceId) && !(joining && conversation.kind === 'room'))
      throw new Error('Нет доступа к этому чату.');
    return conversation;
  }

  private devices() {
    return [...this.sessions.values()]
      .filter((value) => value.connections.size > 0)
      .map((value) => ({ ...value.device }));
  }

  private summary(
    conversation: ChatConversation,
    session?: ChatDeviceSession,
  ): ConversationSummary {
    const other =
      conversation.kind === 'direct' && session
        ? [...this.sessions.values()].find(
            (value) =>
              value.device.id !== session.device.id && conversation.memberIds.has(value.device.id),
          )
        : undefined;
    return {
      id: conversation.id,
      kind: conversation.kind,
      title: other?.device.name ?? conversation.title,
      memberIds: [...conversation.memberIds],
      lastMessage: conversation.messages.at(-1) ?? null,
    };
  }

  private snapshot(conversation: ChatConversation): ConversationState {
    return { ...this.summary(conversation), messages: [...conversation.messages] };
  }

  private list(session: ChatDeviceSession) {
    return [...this.conversations.values()]
      .filter((value) => value.kind === 'room' || value.memberIds.has(session.device.id))
      .map((value) => this.summary(value, session));
  }

  private broadcastDirectory() {
    const devices = this.devices();
    for (const [peer, session] of this.peers)
      peer.send({ type: 'directory', devices, conversations: this.list(session) });
  }
}
