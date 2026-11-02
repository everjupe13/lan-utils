export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'application/octet-stream';
}

export interface UploadPolicy {
  maxFileBytes: number;
  maxTotalBytes: number;
  allowedExtensions: readonly string[];
}
