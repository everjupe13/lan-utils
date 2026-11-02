import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const resources = process.env.NEARBY_DESKTOP_RESOURCES;

async function launch(t, port = 0) {
  const stage = await mkdtemp(join(tmpdir(), 'nearby-desktop-test-'));
  const directory = join(stage, 'uploads');
  if (!resources) {
    await cp(join(root, 'desktop/server.mjs'), join(stage, 'server.mjs'));
    await symlink(join(root, 'backend'), join(stage, 'backend'));
  }
  const child = spawn(
    resources ? join(resources, 'node') : process.execPath,
    [resources ? join(resources, 'runtime/server.mjs') : join(stage, 'server.mjs')],
    {
      env: {
        PATH: process.env.PATH,
        HOST: '127.0.0.1',
        PORT: String(port),
        UPLOAD_DIRECTORY: directory,
        UPLOAD_MAX_MB: '3',
        UPLOAD_TOTAL_MB: '7',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (data) => {
    output += data;
  });
  child.stderr.on('data', (data) => {
    output += data;
  });
  const exited = new Promise((resolve) =>
    child.once('exit', (code, signal) => resolve({ code, signal })),
  );
  const deadline = setTimeout(() => child.kill('SIGKILL'), 8000);
  t.after(async () => {
    child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await exited;
    clearTimeout(deadline);
    await rm(stage, { recursive: true, force: true });
  });
  return { child, exited, directory, output: () => output };
}

async function waitForReady(app) {
  const deadline = Date.now() + 5000;
  while (!app.output().includes('NEARBY_DESKTOP_READY')) {
    if (Date.now() > deadline) throw new Error(`Сервер не запустился: ${app.output()}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function reservePort(t) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { port: server.address().port, server };
}

test(
  'desktop serves the built UI, applies limits, and cleans external files on Off',
  { timeout: 10000 },
  async (t) => {
    const { port, server } = await reservePort(t);
    await new Promise((resolve) => server.close(resolve));
    const app = await launch(t, port);
    await waitForReady(app);
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    const ui = await (await fetch(`${base}/chat`)).text();
    assert.match(ui, /<div id="root">/);
    const policy = await (await fetch(`${base}/api/chat/files/policy`)).json();
    assert.equal(policy.maxFileBytes, 3 * 1024 * 1024);
    assert.equal(policy.maxTotalBytes, 7 * 1024 * 1024);
    assert.equal((await readdir(app.directory)).length, 1);
    app.child.kill('SIGTERM');
    assert.deepEqual(await app.exited, { code: 0, signal: null });
    assert.deepEqual(await readdir(app.directory), []);
    await assert.rejects(fetch(`${base}/api/health`));
  },
);

test(
  'closing the owning app pipe stops the child even without SIGTERM',
  { timeout: 10000 },
  async (t) => {
    const app = await launch(t);
    await waitForReady(app);
    app.child.stdin.end();
    assert.deepEqual(await app.exited, { code: 0, signal: null });
    assert.deepEqual(await readdir(app.directory), []);
  },
);

test(
  'occupied port exits with a useful error and never announces readiness',
  { timeout: 10000 },
  async (t) => {
    const { port } = await reservePort(t);
    const app = await launch(t, port);
    const result = await app.exited;
    assert.equal(result.code, 1);
    assert.match(app.output(), /EADDRINUSE/);
    assert.doesNotMatch(app.output(), /NEARBY_DESKTOP_READY/);
    assert.deepEqual(await readdir(app.directory), []);
  },
);
