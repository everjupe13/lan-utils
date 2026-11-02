import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { GameService } from './services/game-service.js';
import { createWebSocketServer } from './transports/websocket-server.js';
import { localAddresses } from './network.js';
import { FileStore } from './services/file-store.js';
import { ChatService } from './services/chat-service.js';
import { fileRoutes } from './routes/files.js';
import type { FileStoreOptions } from './types/files.js';

export function createApplication(
  allowedOrigins?: Set<string>,
  frontendDirectory = fileURLToPath(new URL('../../frontend/dist/', import.meta.url)),
  uploadOptions: FileStoreOptions = {},
) {
  const app = express();
  const files = new FileStore(uploadOptions);
  const chats = new ChatService((message) => {
    if (!message.attachment) return;
    try {
      files.remove(message.attachment.id);
    } catch (error) {
      console.error('Не удалось удалить старое вложение:', (error as Error).message);
    }
  });
  app.disable('x-powered-by');
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/network', (_req, res) => res.json({ addresses: localAddresses() }));
  app.use('/api/chat/files', fileRoutes(files, chats, allowedOrigins));
  app.use(express.static(frontendDirectory));
  app.get(['/gambit', '/chat'], (_req, res) =>
    res.sendFile(resolve(frontendDirectory, 'index.html')),
  );
  const server = createServer(app);
  const games = new GameService();
  const wss = createWebSocketServer(server, games, allowedOrigins, chats);
  const cleanup = setInterval(() => games.cleanup(), 60_000);
  cleanup.unref();
  server.on('close', () => {
    clearInterval(cleanup);
    wss.close();
    void files.dispose();
  });
  return { app, server, wss, files, chats };
}
