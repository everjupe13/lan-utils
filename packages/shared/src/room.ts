import type { ChessPosition } from './chess.js';
import type { Player } from './person.js';

export interface RoomSummary {
  id: string;
  host: string;
  status: 'waiting' | 'active' | 'finished';
  players: number;
}

export interface RoomState extends RoomSummary, ChessPosition {
  seats: Player[];
}
