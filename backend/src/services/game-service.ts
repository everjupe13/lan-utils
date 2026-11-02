import type { Connection } from '../types/connection.js';
import type { Session } from '../types/session.js';
import type { GameRoom } from '../types/game-room.js';
import { randomBytes, randomInt } from 'node:crypto';
import { Chess, type Square } from 'chess.js';
import type { ClientMessage } from '@nearby/shared/protocol';
import type { Profile } from '@nearby/shared/person';
import type { RoomState, RoomSummary } from '@nearby/shared/room';

export class GameService {
  private sessions = new Map<string, Session>();
  private rooms = new Map<string, GameRoom>();

  hello(connection: Connection, profile: Profile, sessionId?: string): string {
    let session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (session) {
      const previous = session.connection;
      session.connection = connection;
      if (previous && previous !== connection) previous.close();
    } else {
      if (
        [...this.sessions.values()].some(
          (s) => s.profile.login.toLowerCase() === profile.login.toLowerCase(),
        )
      ) {
        throw new Error('Этот логин уже занят. Выберите другой.');
      }
      session = {
        id: randomBytes(32).toString('hex'),
        profile,
        roomId: null,
        connection,
        disconnectedAt: null,
      };
      this.sessions.set(session.id, session);
    }
    session.disconnectedAt = null;
    connection.send({
      type: 'welcome',
      sessionId: session.id,
      profile: session.profile,
      room: session.roomId ? this.snapshot(this.rooms.get(session.roomId)!) : null,
      rooms: this.listRooms(),
    });
    if (session.roomId) this.broadcastRoom(this.rooms.get(session.roomId)!);
    return session.id;
  }

  disconnect(sessionId: string, connection: Connection): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.connection !== connection) return;
    session.connection = null;
    session.disconnectedAt = Date.now();
    if (session.roomId) this.broadcastRoom(this.rooms.get(session.roomId)!);
    this.broadcastLobby();
  }

  handle(
    sessionId: string,
    connection: Connection,
    message: Exclude<ClientMessage, { type: 'hello' }>,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.connection !== connection) throw new Error('Подключитесь заново.');
    switch (message.type) {
      case 'create_room': {
        if (session.roomId) throw new Error('Сначала выйдите из текущей комнаты.');
        let id: string;
        do {
          id = Array.from(
            { length: 6 },
            () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)],
          ).join('');
        } while (this.rooms.has(id));
        const room: GameRoom = {
          id,
          chess: new Chess(),
          seats: [{ ...session.profile, sessionId, color: 'w' }],
          status: 'waiting',
          result: null,
          revision: 0,
        };
        this.rooms.set(id, room);
        session.roomId = id;
        this.broadcastRoom(room);
        break;
      }
      case 'join_room': {
        if (session.roomId) throw new Error('Сначала выйдите из текущей комнаты.');
        const room = this.rooms.get(message.roomId);
        if (!room) throw new Error('Комната не найдена.');
        if (room.status !== 'waiting' || room.seats.length !== 1)
          throw new Error('В этой комнате нет свободных мест.');
        room.seats.push({ ...session.profile, sessionId, color: 'b' });
        room.status = 'active';
        room.revision++;
        session.roomId = room.id;
        this.broadcastRoom(room);
        break;
      }
      case 'leave_room':
        this.leave(session);
        connection.send({ type: 'left' });
        break;
      case 'resign': {
        const room = this.activeRoom(session);
        const color = room.seats.find((p) => p.sessionId === session.id)!.color;
        room.status = 'finished';
        room.result = { winner: color === 'w' ? 'b' : 'w', reason: 'resignation' };
        room.revision++;
        this.broadcastRoom(room);
        break;
      }
      case 'move': {
        const room = this.activeRoom(session);
        if (message.revision !== room.revision)
          throw new Error('Позиция уже изменилась. Повторите ход.');
        const color = room.seats.find((p) => p.sessionId === session.id)!.color;
        if (room.chess.turn() !== color) throw new Error('Сейчас ход соперника.');
        if (room.seats.some((p) => !this.sessions.get(p.sessionId)?.connection))
          throw new Error('Дождитесь подключения соперника.');
        try {
          room.chess.move({
            from: message.from as Square,
            to: message.to as Square,
            promotion: message.promotion,
          });
        } catch {
          throw new Error('Недопустимый ход.');
        }
        room.revision++;
        if (room.chess.isGameOver()) {
          room.status = 'finished';
          room.result = {
            winner: room.chess.isCheckmate() ? color : null,
            reason: room.chess.isCheckmate()
              ? 'checkmate'
              : room.chess.isStalemate()
                ? 'stalemate'
                : 'draw',
          };
        }
        this.broadcastRoom(room);
        break;
      }
    }
    this.broadcastLobby();
  }

  // Keep a disconnected seat for 30 minutes, then release its login and finish its game.
  cleanup(now = Date.now()): void {
    for (const session of this.sessions.values()) {
      if (session.disconnectedAt !== null && now - session.disconnectedAt > 30 * 60_000) {
        this.leave(session);
        this.sessions.delete(session.id);
      }
    }
    this.broadcastLobby();
  }

  private activeRoom(session: Session): GameRoom {
    const room = session.roomId ? this.rooms.get(session.roomId) : undefined;
    if (!room || room.status !== 'active')
      throw new Error('Партия ещё не началась или уже завершена.');
    return room;
  }

  private leave(session: Session): void {
    const room = session.roomId ? this.rooms.get(session.roomId) : undefined;
    session.roomId = null;
    if (!room) return;
    if (room.status === 'active') {
      room.status = 'finished';
      room.result = {
        winner: room.seats.find((p) => p.sessionId !== session.id)!.color,
        reason: 'abandonment',
      };
      room.revision++;
    }
    if (!room.seats.some((p) => this.sessions.get(p.sessionId)?.roomId === room.id))
      this.rooms.delete(room.id);
    else this.broadcastRoom(room);
  }

  private listRooms(): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((r) => r.status !== 'finished')
      .map((r) => ({
        id: r.id,
        host: r.seats[0].name,
        status: r.status,
        players: r.seats.length,
      }));
  }

  private snapshot(room: GameRoom): RoomState {
    return {
      id: room.id,
      host: room.seats[0].name,
      status: room.status,
      players: room.seats.length,
      seats: room.seats.map(({ sessionId, ...player }) => ({
        ...player,
        connected: Boolean(
          this.sessions.get(sessionId)?.connection &&
          this.sessions.get(sessionId)?.roomId === room.id,
        ),
      })),
      fen: room.chess.fen(),
      turn: room.chess.turn(),
      revision: room.revision,
      check: room.chess.isCheck(),
      history: room.chess
        .history({ verbose: true })
        .map(({ san, from, to, color }) => ({ san, from, to, color })),
      legalMoves:
        room.status === 'active'
          ? room.chess.moves({ verbose: true }).map(({ from, to, promotion }) => ({
              from,
              to,
              promotion:
                promotion === 'q' || promotion === 'r' || promotion === 'b' || promotion === 'n'
                  ? promotion
                  : undefined,
            }))
          : [],
      result: room.result,
    };
  }

  private broadcastRoom(room: GameRoom): void {
    const state = this.snapshot(room);
    for (const seat of room.seats) {
      const session = this.sessions.get(seat.sessionId);
      if (session?.roomId === room.id) session.connection?.send({ type: 'room', room: state });
    }
  }

  private broadcastLobby(): void {
    const rooms = this.listRooms();
    for (const session of this.sessions.values())
      session.connection?.send({ type: 'lobby', rooms });
  }
}
