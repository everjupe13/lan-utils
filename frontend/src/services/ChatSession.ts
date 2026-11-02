import type { ConnectionEvent, MessageConnection } from '../types/connection';
import type { ChatClientMessage, ChatServerMessage, ChatMessage } from '@nearby/shared/chat';
import type { ChatIdentity, ChatSnapshot, ChatStorage } from '../types/chat';

export class ChatSession {
  private state: ChatSnapshot = {
    status: 'connecting',
    device: null,
    devices: [],
    conversations: [],
    conversation: null,
    pending: null,
    lastSent: null,
    unread: {},
    error: '',
  };
  private listeners = new Set<() => void>();
  private welcomed = false;
  private serverId: string | null = null;
  private preferred: string | null;
  private seen = new Set<string>();

  constructor(
    private connection: MessageConnection<ChatClientMessage, ChatServerMessage>,
    private identity: ChatIdentity,
    private storage: ChatStorage,
    initialConversation?: string | null,
  ) {
    this.preferred = initialConversation ?? storage.readConversation();
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  start = () => {
    const unsubscribe = this.connection.subscribe(this.onEvent);
    this.connection.connect();
    return () => {
      unsubscribe();
      this.connection.disconnect();
    };
  };
  clearError = () => this.update({ error: '' });
  acceptFileMessage = (message: ChatMessage) => this.receive({ type: 'message', message });
  open = (conversationId: string) => {
    this.command({ type: 'open_conversation', conversationId });
  };
  direct = (deviceId: string) => {
    this.command({ type: 'open_direct', deviceId });
  };
  createRoom = (title: string) => {
    this.command({ type: 'create_room', title: title.trim() });
  };
  rename = (name: string) => {
    this.command({ type: 'rename_device', name: name.trim() });
  };
  sendText = (value: string): boolean => {
    const text = value.trim();
    if (
      !text ||
      text.length > 4000 ||
      !this.state.conversation ||
      this.state.pending ||
      this.state.status !== 'connected'
    )
      return false;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const clientMessageId = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const pending = { clientMessageId, text, conversationId: this.state.conversation.id };
    this.update({ pending, error: '' });
    if (!this.connection.send({ type: 'send_message', ...pending })) {
      this.update({
        pending: null,
        error: 'Сообщение не отправлено. Текст оставлен в поле ввода.',
      });
      return false;
    }
    return true;
  };

  private command(command: Exclude<ChatClientMessage, { type: 'hello' | 'send_message' }>) {
    if (this.state.status !== 'connected') return;
    this.update({ error: '' });
    if (!this.connection.send(command)) this.update({ error: 'Нет соединения с сервером.' });
  }

  private onEvent = (event: ConnectionEvent<ChatServerMessage>) => {
    switch (event.type) {
      case 'open':
        this.welcomed = false;
        this.connection.send({
          type: 'hello',
          name: this.identity.name,
          kind: this.identity.kind,
          sessionToken: this.storage.readIdentity()?.sessionToken,
        });
        break;
      case 'close':
        this.update({ status: 'reconnecting' });
        break;
      case 'error':
        this.update({ error: event.error.message });
        break;
      case 'message':
        this.receive(event.message);
        break;
    }
  };

  private receive(message: ChatServerMessage) {
    switch (message.type) {
      case 'welcome': {
        const restarted = this.serverId !== null && this.serverId !== message.serverId;
        this.serverId = message.serverId;
        this.welcomed = true;
        this.storage.writeIdentity({
          name: message.device.name,
          kind: message.device.kind,
          sessionToken: message.sessionToken,
        });
        const pending = this.state.pending;
        const missingPending =
          pending && !message.conversations.some((value) => value.id === pending.conversationId);
        this.update({
          status: 'connected',
          device: message.device,
          devices: message.devices,
          conversations: message.conversations,
          conversation: message.conversation,
          pending: restarted || missingPending ? null : pending,
          unread: restarted ? {} : this.state.unread,
          error: restarted
            ? 'Сервер перезапущен. История чатов очищена.'
            : missingPending
              ? 'Чат больше не существует. Текст оставлен в поле ввода.'
              : '',
        });
        if (restarted) this.seen.clear();
        const preferred = message.conversations.find(
          (value) => value.id === (this.state.pending?.conversationId ?? this.preferred),
        );
        if (preferred)
          this.connection.send({ type: 'open_conversation', conversationId: preferred.id });
        else if (this.preferred)
          this.update({
            error: `${restarted ? 'Сервер перезапущен. ' : ''}Комната больше не существует. Открыта общая.`,
          });
        const retry = this.state.pending;
        if (retry) this.connection.send({ type: 'send_message', ...retry });
        break;
      }
      case 'directory':
        this.update({ devices: message.devices, conversations: message.conversations });
        break;
      case 'conversation':
        this.preferred = message.conversation.id;
        this.storage.writeConversation(message.conversation.id);
        for (const item of message.conversation.messages) this.seen.add(item.id);
        this.update({
          conversation: message.conversation,
          unread: { ...this.state.unread, [message.conversation.id]: 0 },
        });
        break;
      case 'device':
        this.storage.writeIdentity({
          ...this.storage.readIdentity(),
          name: message.device.name,
          kind: message.device.kind,
        });
        this.update({ device: message.device });
        break;
      case 'message': {
        const item = message.message;
        const active = this.state.conversation?.id === item.conversationId;
        const duplicate =
          this.seen.has(item.id) ||
          (active && this.state.conversation!.messages.some((value) => value.id === item.id));
        this.seen.add(item.id);
        if (this.seen.size > 2000) this.seen.delete(this.seen.values().next().value!);
        const acknowledged =
          item.sender.id === this.state.device?.id &&
          item.clientMessageId === this.state.pending?.clientMessageId;
        this.update({
          ...(active && !duplicate
            ? {
                conversation: {
                  ...this.state.conversation!,
                  messages: [...this.state.conversation!.messages, item].slice(-500),
                  lastMessage: item,
                },
              }
            : {}),
          ...(!active && !duplicate && item.sender.id !== this.state.device?.id
            ? {
                unread: {
                  ...this.state.unread,
                  [item.conversationId]: (this.state.unread[item.conversationId] ?? 0) + 1,
                },
              }
            : {}),
          ...(acknowledged ? { lastSent: this.state.pending, pending: null } : {}),
        });
        break;
      }
      case 'error':
        this.update({
          error: message.message,
          ...(!this.welcomed ? { status: 'rejected' as const } : {}),
          ...(message.requestId === this.state.pending?.clientMessageId ? { pending: null } : {}),
        });
        if (!this.welcomed) this.connection.disconnect();
        break;
    }
  }

  private update(patch: Partial<ChatSnapshot>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
