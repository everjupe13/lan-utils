import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameService } from '../src/services/game-service.js';
import type { Connection } from '../src/types/connection.js';
import type { ClientMessage, ServerMessage } from '@nearby/shared/protocol';

class Player implements Connection {
  messages: ServerMessage[] = [];
  closed = false;
  send(message: ServerMessage) {
    this.messages.push(message);
  }
  close() {
    this.closed = true;
  }
  room() {
    const message = this.messages.findLast((m) => m.type === 'room');
    assert.ok(message?.type === 'room');
    return message.room;
  }
}
function setup() {
  const service = new GameService();
  const white = new Player();
  const black = new Player();
  const third = new Player();
  const w = service.hello(white, { login: 'white', name: 'Белые' });
  const b = service.hello(black, { login: 'black', name: 'Чёрные' });
  const t = service.hello(third, { login: 'third', name: 'Третий' });
  const send = (id: string, player: Player, message: Exclude<ClientMessage, { type: 'hello' }>) =>
    service.handle(id, player, message);
  send(w, white, { type: 'create_room' });
  const roomId = white.room().id;
  const join = () => send(b, black, { type: 'join_room', roomId });
  const move = (id: string, player: Player, from: string, to: string) =>
    send(id, player, { type: 'move', from, to, revision: player.room().revision });
  return { service, white, black, third, w, b, t, send, roomId, join, move };
}

test('room starts with two players; third seat and moves before start are rejected', () => {
  const s = setup();
  assert.equal(s.white.room().status, 'waiting');
  assert.throws(() => s.move(s.w, s.white, 'e2', 'e4'), /не началась/);
  s.join();
  assert.equal(s.white.room().status, 'active');
  assert.equal(s.black.room().seats[1].color, 'b');
  assert.throws(
    () => s.send(s.t, s.third, { type: 'join_room', roomId: s.roomId }),
    /нет свободных/,
  );
  assert.throws(
    () => s.send(s.t, s.third, { type: 'move', from: 'e2', to: 'e4', revision: 1 }),
    /не началась/,
  );
});

test('server enforces turns, legal moves, revision and sends identical positions', () => {
  const s = setup();
  s.join();
  assert.throws(() => s.move(s.b, s.black, 'e7', 'e5'), /ход соперника/);
  assert.throws(() => s.move(s.w, s.white, 'e2', 'e5'), /Недопустимый/);
  s.move(s.w, s.white, 'e2', 'e4');
  assert.deepEqual(s.white.room(), s.black.room());
  assert.equal(s.white.room().history[0].san, 'e4');
  assert.throws(
    () => s.send(s.b, s.black, { type: 'move', from: 'e7', to: 'e5', revision: 1 }),
    /изменилась/,
  );
  s.move(s.b, s.black, 'e7', 'e5');
  assert.equal(s.white.room().turn, 'w');
});

test('checkmate finishes the game and prevents further moves', () => {
  const s = setup();
  s.join();
  s.move(s.w, s.white, 'f2', 'f3');
  s.move(s.b, s.black, 'e7', 'e5');
  s.move(s.w, s.white, 'g2', 'g4');
  s.move(s.b, s.black, 'd8', 'h4');
  assert.equal(s.white.room().status, 'finished');
  assert.deepEqual(s.white.room().result, { winner: 'b', reason: 'checkmate' });
  assert.throws(() => s.move(s.w, s.white, 'e2', 'e4'), /завершена/);
});

test('disconnect pauses moves; reconnect restores the seat and replaces an old connection safely', () => {
  const s = setup();
  s.join();
  s.move(s.w, s.white, 'e2', 'e4');
  s.service.disconnect(s.w, s.white);
  assert.equal(s.black.room().seats[0].connected, false);
  assert.throws(() => s.move(s.b, s.black, 'e7', 'e5'), /подключения/);
  const restored = new Player();
  assert.equal(s.service.hello(restored, { login: 'ignored', name: 'Ignored' }, s.w), s.w);
  assert.equal(restored.room().history[0].san, 'e4');
  const replacement = new Player();
  s.service.hello(replacement, { login: 'ignored', name: 'Ignored' }, s.w);
  assert.equal(restored.closed, true);
  s.service.disconnect(s.w, restored);
  assert.equal(s.black.room().seats[0].connected, true);
  s.move(s.b, s.black, 'e7', 'e5');
});

test('logins are unique; leaving an active game forfeits; expired sessions are released', () => {
  const s = setup();
  s.join();
  assert.throws(() => s.service.hello(new Player(), { login: 'WHITE', name: 'Другой' }), /занят/);
  s.send(s.w, s.white, { type: 'leave_room' });
  assert.deepEqual(s.black.room().result, { winner: 'b', reason: 'abandonment' });
  s.service.disconnect(s.w, s.white);
  s.service.cleanup(Date.now() + 31 * 60_000);
  assert.ok(s.service.hello(new Player(), { login: 'white', name: 'Новый' }));
});

test('resignation ends a game', () => {
  const s = setup();
  s.join();
  s.send(s.b, s.black, { type: 'resign' });
  assert.deepEqual(s.white.room().result, { winner: 'w', reason: 'resignation' });
});
