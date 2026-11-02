import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { GameService } from '../services/game-service.js';
import { ChatService } from '../services/chat-service.js';
import type { ServerMessage } from '@nearby/shared/protocol';
import type { ChatServerMessage } from '@nearby/shared/chat';
import { clientMessageSchema } from '../validation/protocol.js';
import { chatMessageSchema } from '../validation/chat.js';

export function createWebSocketServer(
  server: Server,
  games: GameService,
  allowedOrigins?: Set<string>,
  chats = new ChatService(),
) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32768 });

  server.on('upgrade', (request, socket, head) => {
    if (
      !['/ws', '/ws/chat'].includes(request.url ?? '') ||
      (allowedOrigins && (!request.headers.origin || !allowedOrigins.has(request.headers.origin)))
    ) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });

  wss.on('connection', (ws, request) => {
    const isChat = request.url === '/ws/chat';
    let sessionId: string | undefined;
    let registered = false;
    let alive = true;
    let messages = 0;
    let windowStart = Date.now();
    const connection = {
      send: (message: ServerMessage | ChatServerMessage) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
      },
      close: () => ws.close(4001, 'Session opened in another connection'),
    };
    const helloTimeout = setTimeout(() => {
      if (!registered) ws.close(1008, 'Send hello first');
    }, 10_000);
    const heartbeat = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, 30_000);
    ws.on('pong', () => {
      alive = true;
    });
    ws.on('error', () => ws.terminate());
    ws.on('message', (raw, isBinary) => {
      if (Date.now() - windowStart > 10_000) {
        messages = 0;
        windowStart = Date.now();
      }
      if (++messages > 100) {
        ws.close(1008, 'Too many messages');
        return;
      }
      let requestId: string | undefined;
      try {
        if (isBinary) throw new Error('Ожидается текстовое JSON-сообщение.');
        let data: unknown;
        try {
          data = JSON.parse(raw.toString());
        } catch {
          throw new Error('Некорректный JSON.');
        }
        if (isChat) {
          if (
            data &&
            typeof data === 'object' &&
            'clientMessageId' in data &&
            typeof data.clientMessageId === 'string'
          )
            requestId = data.clientMessageId.slice(0, 80);
          const parsed = chatMessageSchema.safeParse(data);
          if (!parsed.success)
            throw new Error('Некорректное сообщение. Имя — до 40 символов, текст — до 4000.');
          const message = parsed.data;
          if (message.type === 'hello') {
            if (registered) throw new Error('Соединение уже зарегистрировано.');
            chats.hello(connection, message.name, message.kind, message.sessionToken);
            registered = true;
            clearTimeout(helloTimeout);
          } else {
            if (!registered) throw new Error('Сначала подключите устройство.');
            chats.handle(connection, message);
          }
          return;
        }
        const parsed = clientMessageSchema.safeParse(data);
        if (!parsed.success) throw new Error('Некорректное сообщение. Проверьте логин и имя.');
        const message = parsed.data;
        if (message.type === 'hello') {
          if (sessionId) throw new Error('Соединение уже зарегистрировано.');
          sessionId = games.hello(connection, message.profile, message.sessionId);
          registered = true;
          clearTimeout(helloTimeout);
        } else {
          if (!sessionId) throw new Error('Сначала укажите логин и имя.');
          games.handle(sessionId, connection, message);
        }
      } catch (error) {
        connection.send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Ошибка сервера.',
          ...(isChat && requestId ? { requestId } : {}),
        });
      }
    });
    ws.on('close', () => {
      clearTimeout(helloTimeout);
      clearInterval(heartbeat);
      if (sessionId) games.disconnect(sessionId, connection);
      if (isChat) chats.disconnect(connection);
    });
  });
  return wss;
}
