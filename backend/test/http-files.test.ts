import assert from 'node:assert/strict';
import { request as httpRequest, type Server } from 'node:http';
import { Duplex, PassThrough } from 'node:stream';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { createApplication } from '../src/app.js';
import type { ChatServerMessage } from '@nearby/shared/chat';

// Real Node HTTP parsing and Express routes, connected by streams instead of an OS port.
function request(
  server: Server,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body = Buffer.alloc(0),
) {
  const incoming = new PassThrough();
  const outgoing = new PassThrough();
  const clientSocket = Duplex.from({ readable: outgoing, writable: incoming });
  const serverSocket = Duplex.from({ readable: incoming, writable: outgoing });
  for (const socket of [clientSocket, serverSocket])
    Object.assign(socket, {
      setTimeout() {
        return socket;
      },
      setNoDelay() {
        return socket;
      },
      setKeepAlive() {
        return socket;
      },
    });
  server.emit('connection', serverSocket);
  return new Promise<{
    status: number;
    headers: import('node:http').IncomingHttpHeaders;
    body: Buffer;
  }>((resolve, reject) => {
    const req = httpRequest(
      {
        host: 'localhost',
        path,
        method,
        createConnection: () => clientSocket as import('node:net').Socket,
        headers: { ...headers, 'Content-Length': String(body.length), Connection: 'close' },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('error', reject);
        res.on('end', () =>
          resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }),
        );
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

test(
  'real HTTP upload and private download work from a hidden temp directory without opening a port',
  { timeout: 5000 },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'nearby-http-files-'));
    await mkdir(join(root, 'public'));
    const { server, chats, files } = createApplication(undefined, join(root, 'public'), {
      root: join(root, '.runtime'),
      maxFileBytes: 16,
      maxTotalBytes: 32,
    });
    t.after(async () => {
      server.close(() => {});
      await files.dispose();
      await rm(root, { recursive: true, force: true });
    });
    function device(name: string) {
      const events: ChatServerMessage[] = [];
      const peer = { send: (value: ChatServerMessage) => events.push(value), close() {} };
      chats.hello(peer, name, 'computer');
      const welcome = events.find((value) => value.type === 'welcome');
      assert.ok(welcome?.type === 'welcome');
      return {
        peer,
        events,
        welcome,
        authorization: { Authorization: `Bearer ${welcome.sessionToken}` },
      };
    }
    const first = device('Mac');
    const second = device('Phone');
    const third = device('Other');
    const policyResponse = await request(server, 'GET', '/api/chat/files/policy');
    const policy = JSON.parse(policyResponse.body.toString());
    assert.ok(policy.allowedExtensions.includes('.png'));
    assert.ok(policy.allowedExtensions.includes('.zip'));
    assert.equal(policy.allowedExtensions.includes('.exe'), false);
    chats.handle(first.peer, { type: 'open_direct', deviceId: second.welcome.device.id });
    const opened = first.events.findLast((value) => value.type === 'conversation');
    assert.ok(opened?.type === 'conversation');
    const query = new URLSearchParams({
      conversationId: opened.conversation.id,
      requestId: 'upload',
      name: 'Тест.png',
    });
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    assert.equal(
      (await request(server, 'POST', `/api/chat/files?${query}`, {}, bytes)).status,
      401,
    );
    const uploaded = await request(
      server,
      'POST',
      `/api/chat/files?${query}`,
      first.authorization,
      bytes,
    );
    assert.equal(uploaded.status, 201, uploaded.body.toString());
    const message = JSON.parse(uploaded.body.toString()).message;
    assert.equal(message.attachment.name, 'Тест.png');
    assert.equal(message.attachment.mediaType, 'image/png');
    const path = '/api/chat/files/' + message.attachment.id;
    assert.equal((await request(server, 'GET', path)).status, 401);
    assert.equal((await request(server, 'GET', path, third.authorization)).status, 403);
    const downloaded = await request(server, 'GET', path, second.authorization);
    assert.equal(downloaded.status, 200, downloaded.body.toString());
    assert.deepEqual(downloaded.body, bytes);
    assert.match(String(downloaded.headers['content-disposition']), /attachment/);
    assert.equal(downloaded.headers['content-type'], 'application/octet-stream');
    assert.equal(downloaded.headers['x-content-type-options'], 'nosniff');
    const repeated = await request(
      server,
      'POST',
      `/api/chat/files?${query}`,
      first.authorization,
      bytes,
    );
    assert.equal(JSON.parse(repeated.body.toString()).message.id, message.id);
    const changedName = new URLSearchParams({
      conversationId: opened.conversation.id,
      requestId: 'upload',
      name: 'program.exe',
    });
    assert.equal(
      (
        await request(
          server,
          'POST',
          `/api/chat/files?${changedName}`,
          first.authorization,
          Buffer.from('abc'),
        )
      ).status,
      415,
    );
    for (const name of ['program.exe', 'installer.pkg', 'program.exe.txt']) {
      const rejected = await request(
        server,
        'POST',
        `/api/chat/files?${new URLSearchParams({ conversationId: opened.conversation.id, requestId: name, name })}`,
        first.authorization,
        Buffer.from('abc'),
      );
      assert.equal(rejected.status, 415, name);
    }
    const disguised = await request(
      server,
      'POST',
      `/api/chat/files?${new URLSearchParams({ conversationId: opened.conversation.id, requestId: 'disguised', name: 'notes.txt' })}`,
      first.authorization,
      Buffer.from('MZ binary'),
    );
    assert.equal(disguised.status, 415);
    const oversized = await request(
      server,
      'POST',
      `/api/chat/files?${new URLSearchParams({ conversationId: opened.conversation.id, requestId: 'large', name: 'large.txt' })}`,
      first.authorization,
      Buffer.alloc(17),
    );
    assert.equal(oversized.status, 413);
  },
);
