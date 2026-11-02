import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { WebSocket } from 'ws';
import { createApplication } from '../src/app.js';
import type { ChatClientMessage, ChatServerMessage } from '@nearby/shared/chat';

test('HTTP deep routes and chat WebSocket support devices, private delivery, validation and reconnect', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'nearby-test-'));
  await writeFile(join(directory, 'index.html'), '<html><body>Local hub fixture</body></html>');
  const { server, wss } = createApplication(new Set(['http://localhost:5173']), directory);
  const clients: WebSocket[] = [];
  t.after(async () => {
    for (const ws of clients) ws.terminate();
    for (const ws of wss.clients) ws.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  for (const path of ['/', '/gambit', '/chat?room=general']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Local hub fixture/);
  }
  assert.ok(Array.isArray((await (await fetch(base + '/api/network')).json()).addresses));
  async function connect(name: string, sessionToken?: string) {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws/chat', {
      origin: 'http://localhost:5173',
    });
    clients.push(ws);
    const inbox: ChatServerMessage[] = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
    await once(ws, 'open');
    const wait = async <T extends ChatServerMessage['type']>(
      type: T,
      predicate?: (value: Extract<ChatServerMessage, { type: T }>) => boolean,
    ) => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const index = inbox.findIndex(
          (value) =>
            value.type === type &&
            (!predicate || predicate(value as Extract<ChatServerMessage, { type: T }>)),
        );
        if (index >= 0) return inbox.splice(index, 1)[0] as Extract<ChatServerMessage, { type: T }>;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`Timed out waiting for ${type}`);
    };
    const send = (command: ChatClientMessage) => ws.send(JSON.stringify(command));
    send({ type: 'hello', name, kind: 'computer', sessionToken });
    return { ws, send, wait, welcome: await wait('welcome') };
  }
  const first = await connect('Mac');
  const second = await connect('Phone');
  const third = await connect('Other');
  await first.wait('directory', (value) => value.devices.length === 3);
  first.send({ type: 'open_direct', deviceId: second.welcome.device.id });
  const id = (await first.wait('conversation')).conversation.id;
  const uploadUrl = new URL('/api/chat/files', base);
  uploadUrl.search = new URLSearchParams({
    conversationId: id,
    requestId: 'screenshot-1',
    name: 'Скриншот.png',
  }).toString();
  const screenshot = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2]);
  assert.equal((await fetch(uploadUrl, { method: 'POST', body: screenshot })).status, 401);
  const uploaded = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${first.welcome.sessionToken}` },
    body: screenshot,
  });
  assert.equal(uploaded.status, 201);
  const attachmentMessage = (await uploaded.json()).message;
  assert.equal(attachmentMessage.attachment.name, 'Скриншот.png');
  await second.wait('message', (value) => Boolean(value.message.attachment));
  const downloadUrl = base + '/api/chat/files/' + attachmentMessage.attachment.id;
  assert.equal((await fetch(downloadUrl)).status, 401);
  assert.equal(
    (
      await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${third.welcome.sessionToken}` },
      })
    ).status,
    403,
  );
  const download = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${second.welcome.sessionToken}` },
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition')!, /attachment/);
  assert.match(download.headers.get('content-type')!, /application\/octet-stream/);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), screenshot);
  first.send({
    type: 'send_message',
    conversationId: id,
    clientMessageId: 'one',
    text: 'https://example.com/',
  });
  assert.equal(
    (await second.wait('message', (value) => !value.message.attachment)).message.text,
    'https://example.com/',
  );
  third.send({ type: 'open_conversation', conversationId: id });
  assert.match((await third.wait('error')).message, /доступа/);
  first.ws.send(
    JSON.stringify({
      type: 'send_message',
      conversationId: id,
      clientMessageId: 'invalid',
      text: 'x'.repeat(4001),
    }),
  );
  assert.equal((await first.wait('error')).requestId, 'invalid');
  first.ws.close();
  await once(first.ws, 'close');
  const restored = await connect('Mac', first.welcome.sessionToken);
  assert.equal(restored.welcome.device.id, first.welcome.device.id);
  restored.send({ type: 'open_conversation', conversationId: id });
  assert.equal((await restored.wait('conversation')).conversation.messages.length, 2);
});
