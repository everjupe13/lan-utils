import type { Promotion } from './chess.js';
import type { Profile } from './person.js';
import type { RoomState, RoomSummary } from './room.js';

export type ClientMessage =
  | { type: 'hello'; profile: Profile; sessionId?: string }
  | { type: 'create_room' }
  | { type: 'join_room'; roomId: string }
  | { type: 'leave_room' }
  | { type: 'move'; from: string; to: string; promotion?: Promotion; revision: number }
  | { type: 'resign' };
export type ServerMessage =
  | {
      type: 'welcome';
      sessionId: string;
      profile: Profile;
      room: RoomState | null;
      rooms: RoomSummary[];
    }
  | { type: 'lobby'; rooms: RoomSummary[] }
  | { type: 'room'; room: RoomState }
  | { type: 'left' }
  | { type: 'error'; message: string };
