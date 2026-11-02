import type { FileAttachment } from '@nearby/shared/files';

export interface FileStoreOptions {
  root?: string;
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

export interface StoredFile extends FileAttachment {
  path: string;
  conversationId: string;
}
