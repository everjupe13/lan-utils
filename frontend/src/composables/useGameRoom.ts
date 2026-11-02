import { gameStatus } from '../chess/gameStatus';
import type { GameActions, GameRoomView } from '../types/game';
import type { Profile } from '@nearby/shared/person';
import type { RoomState } from '@nearby/shared/room';

export function useGameRoom(
  room: RoomState,
  profile: Profile,
  ready: boolean,
  actions: GameActions,
) {
  const color = room.seats.find((player) => player.login === profile.login)?.color ?? 'w';
  const view: GameRoomView = {
    color,
    status: gameStatus(room, color),
    canMove:
      ready &&
      room.status === 'active' &&
      room.turn === color &&
      room.seats.every((player) => player.connected),
  };
  function resign() {
    if (confirm('Сдаться и завершить партию?')) actions.resign();
  }
  function leave() {
    if (
      room.status !== 'active' ||
      confirm('Выйти? В текущей партии вам будет засчитано поражение.')
    )
      actions.leaveRoom();
  }
  return { ...view, resign, leave };
}
