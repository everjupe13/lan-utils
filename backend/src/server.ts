import { networkInterfaces } from 'node:os';
import { createApplication } from './app.js';
import { uploadOptions } from './services/file-store.js';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';
const frontendHosts = new Set([
  'localhost',
  '127.0.0.1',
  ...Object.values(networkInterfaces()).flatMap((addresses) =>
    (addresses ?? [])
      .filter((address) => address.family === 'IPv4')
      .map((address) => address.address),
  ),
]);
const defaultOrigins = [...frontendHosts].flatMap((address) => [
  `http://${address}:5173`,
  `http://${address}:${port}`,
]);
const origins = new Set(
  (process.env.FRONTEND_ORIGINS?.split(',') ?? defaultOrigins).map((v) => v.trim()),
);
export const { server, wss, files } = createApplication(
  origins,
  undefined,
  uploadOptions(process.env),
);
process.once('exit', files.disposeSync);
server.listen(port, host, () => {
  console.log(`Local hub: http://localhost:${port}`);
  if (host === '0.0.0.0')
    for (const address of frontendHosts) {
      if (address !== 'localhost' && address !== '127.0.0.1')
        console.log(`LAN: http://${address}:${port}`);
    }
});
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    for (const client of wss.clients) client.terminate();
    server.close();
    server.closeAllConnections();
  });
}
