import type { ChatMessage } from '@nearby/shared/chat';

export interface QueuedFile {
  id: string;
  file: File;
  conversationId: string;
  status: 'queued' | 'uploading' | 'failed';
  progress: number;
  error: string;
}

export interface FileTransfer {
  upload(
    file: File,
    conversationId: string,
    requestId: string,
    progress: (value: number) => void,
    signal: AbortSignal,
  ): Promise<ChatMessage>;
}
