import type { ConnectionEvent, MessageConnection } from '../types/connection';
import type { GameSnapshot } from '../types/game';
import type { Profile } from '@nearby/shared/person';
import type { IdentityStorage } from '../types/person';
import type { ClientMessage, ServerMessage } from '@nearby/shared/protocol';
import type { GameCommand } from '../types/protocol';

/** Application protocol and game state, independent of React and the transport implementation. */
export class GameSession {
  private snapshot: GameSnapshot = {
    status: 'connecting',
    room: null,
    rooms: [],
    error: '',
    pending: false,
  };
  private listeners = new Set<() => void>();
  private welcomed = false;

  constructor(
    private connection: MessageConnection<ClientMessage, ServerMessage>,
    private profile: Profile,
    private storage: IdentityStorage,
  ) {}

  getSnapshot = () => this.snapshot;
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

  send = (command: GameCommand) => {
    if (this.snapshot.status !== 'connected' || this.snapshot.pending) return;
    this.update({ pending: true, error: '' });
    if (!this.connection.send(command))
      this.update({
        pending: false,
        error: 'Сообщение не отправлено. Повторите действие после подключения.',
      });
  };

  clearError = () => this.update({ error: '' });

  private onEvent = (event: ConnectionEvent<ServerMessage>) => {
    switch (event.type) {
      case 'open': {
        this.welcomed = false;
        const saved = this.storage.read();
        this.connection.send({
          type: 'hello',
          profile: this.profile,
          sessionId: saved?.profile.login === this.profile.login ? saved.sessionId : undefined,
        });
        break;
      }
      case 'message':
        this.onMessage(event.message);
        break;
      case 'close':
        this.update({
          pending: false,
          status: event.event.reason === 'session_replaced' ? 'displaced' : 'reconnecting',
          error:
            event.event.reason === 'session_replaced'
              ? 'Этот профиль открыт в другом подключении.'
              : '',
        });
        break;
      case 'error':
        this.update({ error: event.error.message });
        break;
    }
  };

  private onMessage(message: ServerMessage) {
    switch (message.type) {
      case 'welcome':
        this.welcomed = true;
        this.storage.write({ profile: message.profile, sessionId: message.sessionId });
        this.update({
          status: 'connected',
          error: '',
          pending: false,
          room: message.room,
          rooms: message.rooms,
        });
        break;
      case 'lobby':
        this.update({ rooms: message.rooms });
        break;
      case 'room':
        this.update({ room: message.room, pending: false });
        break;
      case 'left':
        this.update({ room: null, pending: false });
        break;
      case 'error':
        this.update({
          error: message.message,
          pending: false,
          ...(!this.welcomed ? { status: 'rejected' as const } : {}),
        });
        if (!this.welcomed) this.connection.disconnect();
        break;
    }
  }

  private update(patch: Partial<GameSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}
