import type { Profile } from '@nearby/shared/person';
import type { IdentityStorage } from '../types/person';

const storageKey = 'quiet-move.session';

export const identityStorage: IdentityStorage = {
  read() {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      return typeof value?.profile?.login === 'string' &&
        typeof value?.profile?.name === 'string' &&
        /^[a-f0-9]{64}$/.test(value?.sessionId)
        ? value
        : null;
    } catch {
      return null;
    }
  },
  write(identity) {
    sessionStorage.setItem(storageKey, JSON.stringify(identity));
  },
  clear() {
    sessionStorage.removeItem(storageKey);
  },
};

export function initialProfile(): Profile | null {
  return identityStorage.read()?.profile ?? null;
}
