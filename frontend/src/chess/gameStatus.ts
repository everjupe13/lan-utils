import type { Color, GameResult } from '@nearby/shared/chess';
import type { RoomState } from '@nearby/shared/room';

export const resultReasons: Record<GameResult['reason'], string> = {
  checkmate: 'Мат',
  stalemate: 'Пат',
  draw: 'Ничья',
  resignation: 'Партия завершена сдачей',
  abandonment: 'Игрок покинул комнату',
};

export function gameStatus(room: RoomState, color: Color): string {
  if (room.result) {
    const winner = room.seats.find((player) => player.color === room.result?.winner);
    return winner ? `Победа ${winner.name}` : 'Ничья';
  }
  if (room.status === 'waiting') return 'Ждём второго игрока';
  if (room.seats.some((player) => !player.connected)) return 'Ждём подключения соперника';
  return `${room.check ? 'Шах · ' : ''}${color === room.turn ? 'Ваш ход' : 'Ход соперника'}`;
}
