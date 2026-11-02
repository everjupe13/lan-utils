import type { Color, Promotion } from '@nearby/shared/chess';
import type { RoomState, RoomSummary } from '@nearby/shared/room';

export type GameStatus = 'connecting' | 'connected' | 'reconnecting' | 'rejected' | 'displaced';

export interface GameSnapshot {
  status: GameStatus;
  room: RoomState | null;
  rooms: RoomSummary[];
  error: string;
  pending: boolean;
}

export interface GameActions {
  createRoom(): void;
  joinRoom(roomId: string): void;
  leaveRoom(): void;
  resign(): void;
  move(from: string, to: string, promotion?: Promotion): void;
  clearError(): void;
}

export interface BoardSquare {
  id: string;
  piece?: string;
  whitePiece: boolean;
  light: boolean;
  rankLabel?: string;
  fileLabel?: string;
  selected: boolean;
  target: boolean;
  lastMove: boolean;
  check: boolean;
}

export interface GameRoomView {
  color: Color;
  status: string;
  canMove: boolean;
}
