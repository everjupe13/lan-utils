import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatService } from '../../backend/src/services/chat-service';
import type { ChatConnection } from '../../backend/src/types/chat-service';
import { ConnectionClient } from '../../frontend/src/connections/ConnectionClient';
import { ChatSession } from '../../frontend/src/services/ChatSession';
import type { ChatClientMessage, ChatServerMessage } from '@nearby/shared/chat';
import type { ChatStorage, ChatIdentity } from '../../frontend/src/types/chat';
import type { MessageTransport, TransportHandlers } from '../../frontend/src/types/connection';

class MemoryChatTransport implements MessageTransport<ChatClientMessage, ChatServerMessage> {
  private handlers!: TransportHandlers<ChatServerMessage>;
  holdMessages = false;
  private connection: ChatConnection = {
    send: (message) => {
      if (!(this.holdMessages && message.type === 'message')) this.handlers.onMessage(message);
    },
    close: () => {},
  };
  constructor(private server: ChatService) {}
  open(handlers: TransportHandlers<ChatServerMessage>) {
    this.handlers = handlers;
    handlers.onOpen();
  }
  send(message: ChatClientMessage) {
    try {
      if (message.type === 'hello')
        this.server.hello(this.connection, message.name, message.kind, message.sessionToken);
      else this.server.handle(this.connection, message);
    } catch (error) {
      this.handlers.onMessage({
        type: 'error',
        message: (error as Error).message,
        ...(message.type === 'send_message' ? { requestId: message.clientMessageId } : {}),
      });
    }
    return true;
  }
  close() {
    this.server.disconnect(this.connection);
  }
  drop() {
    this.close();
    this.handlers.onClose({ retryable: true });
  }
}

function client(server: () => ChatService, name: string, initial?: string) {
  let identity: ChatIdentity | null = null;
  let conversation: string | null = null;
  const storage: ChatStorage = {
    readIdentity: () => identity,
    writeIdentity: (value) => {
      identity = value;
    },
    readConversation: () => conversation,
    writeConversation: (id) => {
      conversation = id;
    },
  };
  const transports: MemoryChatTransport[] = [];
  const connection = new ConnectionClient(() => {
    const transport = new MemoryChatTransport(server());
    transports.push(transport);
    return transport;
  });
  const session = new ChatSession(connection, { name, kind: 'computer' }, storage, initial);
  return { session, transports, storage };
}

test('chat sessions share links, retain identity and follow a room invitation without depending on WebSocket', (t) => {
  const server = new ChatService();
  const first = client(() => server, 'Mac');
  t.after(first.session.start());
  first.session.createRoom('Links');
  const roomId = first.session.getSnapshot().conversation!.id;
  const second = client(() => server, 'Phone', roomId);
  t.after(second.session.start());
  assert.equal(second.session.getSnapshot().conversation!.id, roomId);
  assert.equal(first.session.sendText('https://example.com/hello'), true);
  assert.equal(first.session.getSnapshot().pending, null);
  assert.equal(first.session.getSnapshot().lastSent!.text, 'https://example.com/hello');
  assert.equal(
    second.session.getSnapshot().conversation!.messages[0].text,
    'https://example.com/hello',
  );
  first.session.rename('Рабочий Mac');
  assert.equal(first.storage.readIdentity()!.name, 'Рабочий Mac');
  assert.equal(
    second.session.getSnapshot().devices.find((value) => value.name === 'Рабочий Mac')?.id,
    first.session.getSnapshot().device!.id,
  );
});

test('an unacknowledged message is replayed after reconnect with the same ID and does not duplicate', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const server = new ChatService();
  const first = client(() => server, 'Mac');
  t.after(first.session.start());
  first.transports[0].holdMessages = true;
  first.session.sendText('http://192.168.1.20:5173/');
  assert.ok(first.session.getSnapshot().pending);
  const deviceId = first.session.getSnapshot().device!.id;
  first.transports[0].drop();
  assert.equal(first.session.getSnapshot().status, 'reconnecting');
  t.mock.timers.tick(1000);
  assert.equal(first.session.getSnapshot().status, 'connected');
  assert.equal(first.session.getSnapshot().device!.id, deviceId);
  assert.equal(first.session.getSnapshot().conversation!.messages.length, 1);
  assert.equal(first.session.getSnapshot().pending, null);
  assert.equal(first.session.getSnapshot().lastSent!.text, 'http://192.168.1.20:5173/');
});

test('restart clears old room state and pending delivery while preserving the name and reporting reset', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let server = new ChatService();
  const first = client(() => server, 'Mac');
  t.after(first.session.start());
  first.session.createRoom('Old');
  first.transports[0].holdMessages = true;
  first.session.sendText('pending');
  first.transports[0].drop();
  server = new ChatService();
  t.mock.timers.tick(1000);
  const state = first.session.getSnapshot();
  assert.equal(state.status, 'connected');
  assert.equal(state.device!.name, 'Mac');
  assert.equal(state.conversation!.id, 'general');
  assert.equal(state.conversation!.messages.length, 0);
  assert.equal(state.pending, null);
  assert.match(state.error, /перезапущен/);
});

test('direct chat events create unread counts, which clear when the conversation opens', (t) => {
  const server = new ChatService();
  const first = client(() => server, 'Mac');
  const second = client(() => server, 'Phone');
  t.after(first.session.start());
  t.after(second.session.start());
  first.session.direct(second.session.getSnapshot().device!.id);
  const id = first.session.getSnapshot().conversation!.id;
  first.session.sendText('Личное сообщение');
  assert.equal(second.session.getSnapshot().unread[id], 1);
  second.session.open(id);
  assert.equal(second.session.getSnapshot().unread[id], 0);
  assert.equal(second.session.getSnapshot().conversation!.messages.length, 1);
});

test('HTTP and WebSocket delivery of the same file message is deduplicated', (t) => {
  const server = new ChatService();
  const first = client(() => server, 'Mac');
  const second = client(() => server, 'Phone');
  t.after(first.session.start());
  t.after(second.session.start());
  const device = first.session.getSnapshot().device!;
  const message = server.publishFile('general', device, 'file-1', {
    id: 'file-id',
    name: 'Скриншот.png',
    size: 1234,
    mediaType: 'image/png',
  });
  first.session.acceptFileMessage(message);
  assert.equal(first.session.getSnapshot().conversation!.messages.length, 1);
  assert.equal(
    second.session.getSnapshot().conversation!.messages[0].attachment!.name,
    'Скриншот.png',
  );
  assert.equal(first.session.getSnapshot().pending, null);
});
