import type { ChatMessage } from '@nearby/shared/chat';
import type { FileAttachment, UploadPolicy } from '@nearby/shared/files';
import type { FileTransfer } from '../types/files';
import { chatStorage } from './chatStorage';

function authorization() {
  const token = chatStorage.readIdentity()?.sessionToken;
  if (!token) throw new Error('Переподключите устройство к чату.');
  return `Bearer ${token}`;
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? 'Файл недоступен. Возможно, сервер был перезапущен.');
}

export const chatFiles: FileTransfer = {
  upload(file, conversationId, requestId, progress, signal) {
    return new Promise<ChatMessage>((resolve, reject) => {
      const query = new URLSearchParams({ conversationId, requestId, name: file.name });
      const request = new XMLHttpRequest();
      const abort = () => request.abort();
      const finish = (error?: Error, message?: ChatMessage) => {
        signal.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve(message!);
      };
      request.open('POST', `/api/chat/files?${query}`);
      try {
        request.setRequestHeader('Authorization', authorization());
      } catch (error) {
        reject(error);
        return;
      }
      request.setRequestHeader('Content-Type', 'application/octet-stream');
      request.timeout = 600_000;
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100));
      };
      request.onload = () => {
        try {
          const body = JSON.parse(request.responseText);
          if (request.status < 200 || request.status >= 300 || !body.message)
            finish(new Error(body.error ?? 'Не удалось отправить файл.'));
          else finish(undefined, body.message);
        } catch {
          finish(new Error('Сервер не подтвердил передачу. Можно повторить отправку.'));
        }
      };
      request.onerror = () =>
        finish(new Error('Передача прервана. Проверьте соединение и повторите отправку.'));
      request.ontimeout = () =>
        finish(new Error('Время передачи истекло. Можно повторить отправку.'));
      request.onabort = () => finish(new DOMException('Передача отменена.', 'AbortError'));
      if (signal.aborted) {
        finish(new DOMException('Передача отменена.', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', abort, { once: true });
      request.send(file);
    });
  },
};

export async function uploadPolicy(signal: AbortSignal): Promise<UploadPolicy> {
  const response = await fetch('/api/chat/files/policy', { signal });
  if (!response.ok) throw new Error('Не удалось получить ограничения загрузки файлов.');
  return response.json();
}

export async function fileBlob(file: FileAttachment, signal?: AbortSignal) {
  const response = await fetch(`/api/chat/files/${encodeURIComponent(file.id)}`, {
    headers: { Authorization: authorization() },
    signal,
  });
  if (!response.ok) throw await responseError(response);
  return new Blob([await response.blob()], { type: file.mediaType });
}
