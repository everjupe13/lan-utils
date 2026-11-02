import { Router, type Request } from 'express';
import { FileError, type FileStore } from '../services/file-store.js';
import type { ChatService } from '../services/chat-service.js';
import { fileNameProblem } from '@nearby/shared/file-policy';

function token(request: Request) {
  return /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
}
function parameter(request: Request, name: string, max = 80) {
  const value = request.query[name];
  if (typeof value !== 'string' || !value || value.length > max)
    throw new FileError(400, `Некорректный параметр: ${name}.`);
  return value;
}

export function fileRoutes(files: FileStore, chats: ChatService, allowedOrigins?: Set<string>) {
  const router = Router();
  const device = (request: Request) => {
    const value = chats.deviceForToken(token(request));
    if (!value) throw new FileError(401, 'Переподключите устройство к чату.');
    return value;
  };
  const access = (conversationId: string, deviceId: string) => {
    try {
      chats.assertMember(conversationId, deviceId);
    } catch {
      throw new FileError(403, 'Нет доступа к файлам этого чата.');
    }
  };

  router.get('/policy', (_req, res) => res.json(files.policy));
  router.post('/', async (req, res) => {
    let storedId: string | undefined;
    try {
      if (allowedOrigins && req.headers.origin && !allowedOrigins.has(req.headers.origin))
        throw new FileError(403, 'Origin не разрешён.');
      const sender = device(req);
      const conversationId = parameter(req, 'conversationId');
      const requestId = parameter(req, 'requestId');
      const name = parameter(req, 'name', 255);
      access(conversationId, sender.id);
      const nameProblem = fileNameProblem(name);
      if (nameProblem) throw new FileError(415, nameProblem);
      const existing = chats.findMessage(conversationId, sender.id, requestId);
      if (existing) {
        req.resume();
        res.json({ message: existing });
        return;
      }
      const length = req.headers['content-length'];
      const file = await files.save(req, {
        ownerId: sender.id,
        conversationId,
        name,
        size: length === undefined ? undefined : Number(length),
      });
      storedId = file.id;
      const { id, size, mediaType, name: fileName } = file;
      const message = chats.publishFile(conversationId, sender, requestId, {
        id,
        size,
        mediaType,
        name: fileName,
      });
      storedId = undefined;
      res.status(201).json({ message });
    } catch (error) {
      if (storedId) files.remove(storedId);
      req.resume();
      if (res.destroyed) return;
      const status = error instanceof FileError ? error.status : 500;
      res
        .set('Connection', 'close')
        .status(status)
        .json({
          error:
            error instanceof FileError
              ? error.message
              : 'Не удалось сохранить файл. Проверьте свободное место на диске.',
        });
    }
  });
  router.get('/:id', (req, res) => {
    try {
      const sender = device(req);
      const file = files.get(String(req.params.id));
      access(file.conversationId, sender.id);
      res.set({
        'Content-Type': 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      });
      res.download(file.id, file.name, { root: files.directory, dotfiles: 'deny' }, (error) => {
        if (error && !res.headersSent && !res.destroyed)
          res.status(404).json({ error: 'Файл больше недоступен.' });
      });
    } catch (error) {
      res
        .status(error instanceof FileError ? error.status : 500)
        .json({ error: error instanceof Error ? error.message : 'Ошибка загрузки файла.' });
    }
  });
  return router;
}
