import type { RoomState } from '@nearby/shared/room';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { WebSocket } from 'ws';
import { createApplication } from '../src/app.js';
import type { ClientMessage, ServerMessage } from '@nearby/shared/protocol';

test('HTTP + real WebSocket: create, join, synchronize, reject malformed messages and reconnect', async (t) => {
  const { server, wss } = createApplication(new Set(['http://localhost:5173']));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const clients: WebSocket[] = [];
  t.after(async () => {
    for (const ws of clients) ws.terminate();
    for (const ws of wss.clients) ws.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { status: 'ok' });
  async function connect(login: string, sessionId?: string) {
    const ws = new WebSocket(url.replace('http:', 'ws:') + '/ws', {
      origin: 'http://localhost:5173',
    });
    clients.push(ws);
    const inbox: ServerMessage[] = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
    await once(ws, 'open');
    const wait = async <T extends ServerMessage['type']>(
      type: T,
      predicate?: (m: Extract<ServerMessage, { type: T }>) => boolean,
    ) => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const index = inbox.findIndex(
          (m) =>
            m.type === type && (!predicate || predicate(m as Extract<ServerMessage, { type: T }>)),
        );
        if (index >= 0) return inbox.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`Timed out waiting for ${type}`);
    };
    const send = (message: ClientMessage) => ws.send(JSON.stringify(message));
    send({ type: 'hello', profile: { login, name: login }, sessionId });
    return { ws, send, wait, welcome: await wait('welcome') };
  }
  const white = await connect('player1');
  const black = await connect('player2');
  white.send({ type: 'create_room' });
  const waiting = (await white.wait('room')).room;
  black.send({ type: 'join_room', roomId: waiting.id });
  const active = (await white.wait('room', (m) => m.room.status === 'active')).room;
  await black.wait('room');
  white.send({ type: 'move', from: 'e2', to: 'e4', revision: active.revision });
  const first = (await white.wait('room', (m) => m.room.history.length === 1)).room;
  assert.equal((await black.wait('room', (m) => m.room.history.length === 1)).room.fen, first.fen);
  black.ws.send('{broken');
  assert.match((await black.wait('error')).message, /JSON/);
  black.ws.send(JSON.stringify({ type: 'move', from: 'x9', to: 'e5', revision: 2 }));
  assert.match((await black.wait('error')).message, /Некорректное сообщение/);
  white.ws.close();
  await once(white.ws, 'close');
  await black.wait('room', (m) => !m.room.seats[0].connected);
  const reconnected = await connect('player1', white.welcome.sessionId);
  assert.equal((reconnected.welcome.room as RoomState).fen, first.fen);
});
