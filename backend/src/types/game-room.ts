import type { Chess } from 'chess.js';
import type { Color } from '@nearby/shared/chess';
import type { Profile } from '@nearby/shared/person';
import type { RoomState } from '@nearby/shared/room';

export interface RoomSeat extends Profile {
  sessionId: string;
  color: Color;
}

export interface GameRoom {
  id: string;
  chess: Chess;
  seats: RoomSeat[];
  status: RoomState['status'];
  result: RoomState['result'];
  revision: number;
}
