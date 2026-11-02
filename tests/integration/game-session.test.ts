import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameService } from '../../backend/src/services/game-service';
import type { Connection } from '../../backend/src/types/connection';
import { ConnectionClient } from '../../frontend/src/connections/ConnectionClient';
import { GameSession } from '../../frontend/src/services/GameSession';
import type { Profile } from '@nearby/shared/person';
import type { Identity, IdentityStorage } from '../../frontend/src/types/person';
import type { ClientMessage, ServerMessage } from '@nearby/shared/protocol';
import type { MessageTransport, TransportHandlers } from '../../frontend/src/types/connection';

/** A second transport implementation runs the complete application protocol without sockets. */
class InMemoryTransport implements MessageTransport<ClientMessage, ServerMessage> {
  private handlers!: TransportHandlers<ServerMessage>;
  private sessionId: string | undefined;
  private connection: Connection = {
    send: (message) => this.handlers.onMessage(message),
    close: () => this.handlers.onClose({ retryable: false, reason: 'session_replaced' }),
  };
  constructor(private server: GameService) {}
  open(handlers: TransportHandlers<ServerMessage>) {
    this.handlers = handlers;
    handlers.onOpen();
  }
  send(message: ClientMessage) {
    try {
      if (message.type === 'hello')
        this.sessionId = this.server.hello(this.connection, message.profile, message.sessionId);
      else if (this.sessionId) this.server.handle(this.sessionId, this.connection, message);
    } catch (error) {
      this.handlers.onMessage({ type: 'error', message: (error as Error).message });
    }
    return true;
  }
  close() {
    if (this.sessionId) this.server.disconnect(this.sessionId, this.connection);
  }
  drop() {
    this.close();
    this.handlers.onClose({ retryable: true });
  }
}

function player(server: GameService, profile: Profile) {
  let identity: Identity | null = null;
  const storage: IdentityStorage = {
    read: () => identity,
    write: (value) => {
      identity = value;
    },
    clear: () => {
      identity = null;
    },
  };
  const transports: InMemoryTransport[] = [];
  const connection = new ConnectionClient(() => {
    const transport = new InMemoryTransport(server);
    transports.push(transport);
    return transport;
  });
  const session = new GameSession(connection, profile, storage);
  return { connection, session, storage, transports };
}

test('two game sessions create a room and synchronize moves through a replacement transport', (t) => {
  const server = new GameService();
  const white = player(server, { login: 'white', name: 'Белые' });
  const black = player(server, { login: 'black', name: 'Чёрные' });
  t.after(white.session.start());
  t.after(black.session.start());
  assert.equal(white.session.getSnapshot().status, 'connected');
  white.session.send({ type: 'create_room' });
  const roomId = white.session.getSnapshot().room!.id;
  black.session.send({ type: 'join_room', roomId });
  const room = white.session.getSnapshot().room!;
  white.session.send({ type: 'move', from: 'e2', to: 'e4', revision: room.revision });
  assert.equal(white.session.getSnapshot().room!.history[0].san, 'e4');
  assert.deepEqual(white.session.getSnapshot().room, black.session.getSnapshot().room);
  assert.equal(white.session.getSnapshot().pending, false);
  black.session.send({ type: 'leave_room' });
  assert.equal(black.session.getSnapshot().room, null);
  assert.equal(white.session.getSnapshot().room!.result?.reason, 'abandonment');
});

test('reconnect restores the saved identity, room and position without transport-specific code', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const server = new GameService();
  const white = player(server, { login: 'white', name: 'Белые' });
  const black = player(server, { login: 'black', name: 'Чёрные' });
  t.after(white.session.start());
  t.after(black.session.start());
  white.session.send({ type: 'create_room' });
  const roomId = white.session.getSnapshot().room!.id;
  black.session.send({ type: 'join_room', roomId });
  const token = white.storage.read()!.sessionId;
  white.transports[0].drop();
  assert.equal(white.session.getSnapshot().status, 'reconnecting');
  assert.equal(black.session.getSnapshot().room!.seats[0].connected, false);
  t.mock.timers.tick(1000);
  assert.equal(white.session.getSnapshot().status, 'connected');
  assert.equal(white.session.getSnapshot().room!.id, roomId);
  assert.equal(white.storage.read()!.sessionId, token);
  assert.equal(black.session.getSnapshot().room!.seats[0].connected, true);
});

test('a rejected profile stops reconnecting and allows the form to display the error', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const server = new GameService();
  const first = player(server, { login: 'same', name: 'Первый' });
  const second = player(server, { login: 'same', name: 'Второй' });
  t.after(first.session.start());
  t.after(second.session.start());
  assert.equal(second.session.getSnapshot().status, 'rejected');
  assert.match(second.session.getSnapshot().error, /занят/);
  t.mock.timers.tick(60_000);
  assert.equal(second.transports.length, 1);
});

test('moving the same identity to another connection displaces the old session without a reconnect loop', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const server = new GameService();
  const first = player(server, { login: 'white', name: 'Белые' });
  t.after(first.session.start());
  const second = player(server, { login: 'white', name: 'Белые' });
  second.storage.write(first.storage.read()!);
  t.after(second.session.start());
  assert.equal(first.session.getSnapshot().status, 'displaced');
  assert.match(first.session.getSnapshot().error, /другом подключении/);
  t.mock.timers.tick(60_000);
  assert.equal(first.transports.length, 1);
});
