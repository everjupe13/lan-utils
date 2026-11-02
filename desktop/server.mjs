// A pipe owned by the Swift app is our lifetime lease. EOF also arrives if
// the app crashes or is force-quit, so its server never stays behind.
process.stdin.resume();
process.stdin.once('end', () => {
  if (process.listenerCount('SIGTERM')) process.kill(process.pid, 'SIGTERM');
  else process.exit(0);
});

const { server } = await import('./backend/dist/server.js');
const ready = () => console.log('NEARBY_DESKTOP_READY');
if (server.listening) ready();
else server.once('listening', ready);
// stdin must not keep an otherwise stopped server alive.
server.once('close', () => process.stdin.destroy());
server.once('error', () => process.stdin.destroy());
