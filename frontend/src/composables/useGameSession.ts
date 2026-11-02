import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { MessageConnection } from '../types/connection';
import { GameSession } from '../services/GameSession';
import { identityStorage } from '../services/identityStorage';
import type { GameActions, GameSnapshot } from '../types/game';
import type { Profile } from '@nearby/shared/person';
import type { ClientMessage, ServerMessage } from '@nearby/shared/protocol';

const emptySnapshot: GameSnapshot = {
  status: 'connecting',
  room: null,
  rooms: [],
  error: '',
  pending: false,
};
const noopSubscribe = () => () => {};
const getEmpty = () => emptySnapshot;

export function useGameSession(
  profile: Profile | null,
  connection: MessageConnection<ClientMessage, ServerMessage>,
) {
  const session = useMemo(
    () => (profile ? new GameSession(connection, profile, identityStorage) : null),
    [connection, profile],
  );
  const state = useSyncExternalStore(
    session?.subscribe ?? noopSubscribe,
    session?.getSnapshot ?? getEmpty,
    getEmpty,
  );
  useEffect(() => session?.start(), [session]);
  const actions = useMemo<GameActions>(
    () => ({
      createRoom: () => session?.send({ type: 'create_room' }),
      joinRoom: (roomId) =>
        session?.send({ type: 'join_room', roomId: roomId.trim().toUpperCase() }),
      leaveRoom: () => session?.send({ type: 'leave_room' }),
      resign: () => session?.send({ type: 'resign' }),
      move: (from, to, promotion) => {
        const room = session?.getSnapshot().room;
        if (room) session?.send({ type: 'move', from, to, promotion, revision: room.revision });
      },
      clearError: () => session?.clearError(),
    }),
    [session],
  );
  return { ...state, actions, ready: state.status === 'connected' && !state.pending };
}
