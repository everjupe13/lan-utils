import type { ChatMessage } from '@nearby/shared/chat';
import type { PendingMessage } from '../types/chat';
import type { ClipboardEvent, DragEvent, FormEvent, KeyboardEvent } from 'react';
import { useFileTransfers } from './useFileTransfers';
import { useMessageComposer } from './useMessageComposer';

export function useChatComposer(
  conversationId: string,
  ready: boolean,
  pending: boolean,
  lastSent: PendingMessage | null,
  onSend: (text: string) => boolean,
  onFileMessage: (message: ChatMessage) => void,
) {
  const text = useMessageComposer(conversationId, lastSent, onSend);
  const files = useFileTransfers(conversationId, ready, onFileMessage);
  const canSend =
    ready &&
    !pending &&
    !files.busy &&
    (Boolean(text.text.trim()) || files.queue.some((item) => item.status === 'queued'));
  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    text.submit();
    void files.sendQueued();
  }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }
  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (event.clipboardData.files.length) {
      event.preventDefault();
      files.add(event.clipboardData.files);
    }
  }
  function dragOver(event: DragEvent) {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
  }
  function drop(event: DragEvent) {
    if (event.dataTransfer.files.length) {
      event.preventDefault();
      files.add(event.dataTransfer.files);
    }
  }
  return { text, files, canSend, submit, keyDown, paste, dragOver, drop };
}
