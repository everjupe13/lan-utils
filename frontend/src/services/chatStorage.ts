import type { ChatStorage } from '../types/chat';

export const chatStorage: ChatStorage = {
  readIdentity() {
    try {
      const value = JSON.parse(localStorage.getItem('nearby.device') ?? 'null');
      return typeof value?.name === 'string' &&
        ['phone', 'tablet', 'computer', 'unknown'].includes(value.kind) &&
        (value.sessionToken === undefined || /^[a-f0-9]{64}$/.test(value.sessionToken))
        ? value
        : null;
    } catch {
      return null;
    }
  },
  writeIdentity(value) {
    try {
      localStorage.setItem('nearby.device', JSON.stringify(value));
    } catch {
      /* The active connection still works without persistence. */
    }
  },
  readConversation() {
    try {
      return sessionStorage.getItem('nearby.conversation');
    } catch {
      return null;
    }
  },
  writeConversation(id) {
    try {
      sessionStorage.setItem('nearby.conversation', id);
    } catch {
      /* Optional tab preference. */
    }
  },
};
