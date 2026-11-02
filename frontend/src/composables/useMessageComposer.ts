import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { PendingMessage } from '../types/chat';

export function useMessageComposer(
  conversationId: string,
  lastSent: PendingMessage | null,
  onSend: (text: string) => boolean,
) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const text = drafts[conversationId] ?? '';
  useEffect(() => {
    if (lastSent)
      setDrafts((current) =>
        current[lastSent.conversationId]?.trim() === lastSent.text
          ? { ...current, [lastSent.conversationId]: '' }
          : current,
      );
  }, [lastSent]);
  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (text.trim()) onSend(text);
  }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }
  return {
    text,
    setText: (value: string) => setDrafts((current) => ({ ...current, [conversationId]: value })),
    submit,
    keyDown,
  };
}
