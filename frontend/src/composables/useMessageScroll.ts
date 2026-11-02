import { useLayoutEffect, useRef } from 'react';

export function useMessageScroll(conversationId: string, lastId?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const previous = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (ref.current && (previous.current !== conversationId || pinned.current))
      ref.current.scrollTop = ref.current.scrollHeight;
    previous.current = conversationId;
  }, [conversationId, lastId]);
  function onScroll() {
    const element = ref.current;
    if (element)
      pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
  }
  return { ref, onScroll };
}
