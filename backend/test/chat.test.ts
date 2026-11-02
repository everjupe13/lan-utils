import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatService, GENERAL_ROOM_ID, MESSAGE_LIMIT } from '../src/services/chat-service.js';
import type { ChatConnection } from '../src/types/chat-service.js';
import type { ChatClientMessage, ChatServerMessage } from '@nearby/shared/chat';
import { chatMessageSchema } from '../src/validation/chat.js';

class Peer implements ChatConnection {
  messages: ChatServerMessage[] = [];
  send(message: ChatServerMessage) {
    this.messages.push(message);
  }
  close() {}
  last<T extends ChatServerMessage['type']>(type: T) {
    const value = this.messages.findLast((message) => message.type === type);
    assert.ok(value);
    return value as Extract<ChatServerMessage, { type: T }>;
  }
}
function setup() {
  const service = new ChatService();
  const first = new Peer();
  const second = new Peer();
  const third = new Peer();
  service.hello(first, 'Ноутбук', 'computer');
  service.hello(second, 'Телефон', 'phone');
  service.hello(third, 'Другой', 'tablet');
  const command = (peer: Peer, value: Exclude<ChatClientMessage, { type: 'hello' }>) =>
    service.handle(peer, value);
  return { service, first, second, third, command };
}

test('chat bootstraps a shared room, delivers Unicode links, and deduplicates retries', () => {
  const s = setup();
  assert.equal(s.first.last('welcome').conversation.id, GENERAL_ROOM_ID);
  assert.equal(s.first.last('directory').devices.length, 3);
  const message = {
    type: 'send_message' as const,
    conversationId: GENERAL_ROOM_ID,
    clientMessageId: 'request-1',
    text: 'Ссылка: http://192.168.1.5:5173/chat 👋',
  };
  s.command(s.first, message);
  assert.equal(s.second.last('message').message.text, message.text);
  s.command(s.first, message);
  assert.equal(s.second.messages.filter((value) => value.type === 'message').length, 1);
  s.command(s.first, { type: 'open_conversation', conversationId: GENERAL_ROOM_ID });
  assert.equal(s.first.last('conversation').conversation.messages.length, 1);
});

test('rooms can be joined by invitation; nonmembers cannot send before joining', () => {
  const s = setup();
  s.command(s.first, { type: 'create_room', title: 'Ссылки' });
  const id = s.first.last('conversation').conversation.id;
  assert.ok(s.second.last('directory').conversations.some((value) => value.id === id));
  assert.throws(
    () =>
      s.command(s.second, {
        type: 'send_message',
        conversationId: id,
        clientMessageId: 'bad',
        text: 'no',
      }),
    /доступа/,
  );
  s.command(s.first, {
    type: 'send_message',
    conversationId: id,
    clientMessageId: 'ok',
    text: 'hello',
  });
  assert.equal(s.second.messages.filter((value) => value.type === 'message').length, 0);
  s.command(s.second, { type: 'open_conversation', conversationId: id });
  assert.equal(s.second.last('conversation').conversation.messages[0].text, 'hello');
});

test('direct chats are visible only to participants and opening the reverse pair reuses the chat', () => {
  const s = setup();
  s.command(s.first, { type: 'open_direct', deviceId: s.second.last('welcome').device.id });
  const id = s.first.last('conversation').conversation.id;
  assert.equal(
    s.third.last('directory').conversations.some((value) => value.id === id),
    false,
  );
  assert.throws(
    () => s.command(s.third, { type: 'open_conversation', conversationId: id }),
    /доступа/,
  );
  assert.throws(
    () =>
      s.command(s.third, {
        type: 'send_message',
        conversationId: id,
        clientMessageId: 'bad',
        text: 'no',
      }),
    /доступа/,
  );
  s.command(s.first, {
    type: 'send_message',
    conversationId: id,
    clientMessageId: 'private',
    text: 'Личная ссылка',
  });
  assert.equal(s.second.last('message').message.text, 'Личная ссылка');
  assert.equal(
    s.third.messages.some((value) => value.type === 'message'),
    false,
  );
  s.command(s.second, { type: 'open_direct', deviceId: s.first.last('welcome').device.id });
  assert.equal(s.second.last('conversation').conversation.id, id);
  assert.throws(
    () => s.command(s.first, { type: 'open_direct', deviceId: s.first.last('welcome').device.id }),
    /другое/,
  );
});

test('device identity survives reconnect; several tabs count as one connected device', () => {
  const s = setup();
  const token = s.first.last('welcome').sessionToken;
  const extraTab = new Peer();
  s.service.hello(extraTab, 'Ignored', 'unknown', token);
  assert.equal(extraTab.last('welcome').device.id, s.first.last('welcome').device.id);
  assert.equal(s.second.last('directory').devices.length, 3);
  s.service.disconnect(s.first);
  assert.equal(s.second.last('directory').devices.length, 3);
  s.service.disconnect(extraTab);
  assert.equal(s.second.last('directory').devices.length, 2);
  const restored = new Peer();
  s.service.hello(restored, 'Ignored', 'unknown', token);
  assert.equal(restored.last('welcome').device.name, 'Ноутбук');
  assert.equal(s.second.last('directory').devices.length, 3);
});

test('rename propagates to other tabs and direct-chat titles', () => {
  const s = setup();
  s.command(s.second, { type: 'open_direct', deviceId: s.first.last('welcome').device.id });
  const extraTab = new Peer();
  s.service.hello(extraTab, 'Ignored', 'unknown', s.first.last('welcome').sessionToken);
  s.command(s.first, { type: 'rename_device', name: 'Рабочий Mac' });
  assert.equal(extraTab.last('device').device.name, 'Рабочий Mac');
  assert.equal(
    s.second.last('directory').conversations.find((value) => value.kind === 'direct')?.title,
    'Рабочий Mac',
  );
});

test('history is bounded and a fresh server keeps no previous messages or devices', () => {
  const s = setup();
  for (let index = 0; index < MESSAGE_LIMIT + 3; index++)
    s.command(s.first, {
      type: 'send_message',
      conversationId: GENERAL_ROOM_ID,
      clientMessageId: String(index),
      text: String(index),
    });
  s.command(s.second, { type: 'open_conversation', conversationId: GENERAL_ROOM_ID });
  const history = s.second.last('conversation').conversation.messages;
  assert.equal(history.length, MESSAGE_LIMIT);
  assert.equal(history[0].text, '3');
  const fresh = new ChatService();
  const peer = new Peer();
  fresh.hello(peer, 'Ноутбук', 'computer', s.first.last('welcome').sessionToken);
  assert.equal(peer.last('welcome').conversation.messages.length, 0);
  assert.equal(peer.last('welcome').devices.length, 1);
  assert.notEqual(peer.last('welcome').serverId, s.first.last('welcome').serverId);
});

test('chat validation rejects blank and oversized content and trims valid text', () => {
  assert.equal(
    chatMessageSchema.safeParse({ type: 'hello', name: ' ', kind: 'computer' }).success,
    false,
  );
  assert.equal(
    chatMessageSchema.safeParse({ type: 'create_room', title: 'x'.repeat(41) }).success,
    false,
  );
  assert.equal(
    chatMessageSchema.safeParse({
      type: 'send_message',
      conversationId: 'general',
      clientMessageId: 'a',
      text: 'x'.repeat(4001),
    }).success,
    false,
  );
  assert.deepEqual(
    chatMessageSchema.parse({
      type: 'send_message',
      conversationId: 'general',
      clientMessageId: 'a',
      text: ' ссылка ',
    }),
    { type: 'send_message', conversationId: 'general', clientMessageId: 'a', text: 'ссылка' },
  );
});
