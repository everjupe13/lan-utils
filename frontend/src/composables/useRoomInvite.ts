import { useClipboard } from './useClipboard';

export function useRoomInvite(roomId: string) {
  const clipboard = useClipboard();
  const url = new URL('/gambit', location.origin);
  url.searchParams.set('room', roomId);
  const link = url.toString();
  async function copy() {
    await clipboard.copy(link);
  }
  return { copied: clipboard.copied === link, error: clipboard.error, copy };
}
