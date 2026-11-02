import type { Profile } from '@nearby/shared/person';

export interface Identity {
  profile: Profile;
  sessionId: string;
}

export interface IdentityStorage {
  read(): Identity | null;
  write(identity: Identity): void;
  clear(): void;
}
