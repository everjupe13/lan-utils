import type { Connection } from './connection.js';
import type { Profile } from '@nearby/shared/person';

export interface Session {
  id: string;
  profile: Profile;
  roomId: string | null;
  connection: Connection | null;
  disconnectedAt: number | null;
}
