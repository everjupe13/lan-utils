import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, mkdir, writeFile, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, PassThrough } from 'node:stream';
import { FileStore, FileError, uploadOptions } from '../src/services/file-store.js';
import { ChatService, MESSAGE_LIMIT } from '../src/services/chat-service.js';
import type { ChatServerMessage } from '@nearby/shared/chat';
import { ALLOWED_FILE_EXTENSIONS, fileNameProblem } from '@nearby/shared/file-policy';

async function storage(
  t: { after(callback: () => Promise<void>): void },
  maxFileBytes = 64,
  maxTotalBytes = 256,
) {
  const root = await mkdtemp(join(tmpdir(), 'nearby-files-'));
  const files = new FileStore({ root, maxFileBytes, maxTotalBytes });
  t.after(async () => {
    await files.dispose();
    await rm(root, { recursive: true, force: true });
  });
  return { root, files };
}
const meta = { ownerId: 'device', conversationId: 'general', name: 'file.txt' };
const status = (value: unknown, code: number) =>
  value instanceof FileError && value.status === code;

test('files stream to private generated paths, preserve Unicode names and detect safe images from bytes', async (t) => {
  const { files } = await storage(t);
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  const file = await files.save(Readable.from([bytes]), {
    ...meta,
    name: '../../Скриншот.png',
    size: bytes.length,
  });
  assert.equal(file.name, 'Скриншот.png');
  assert.equal(file.mediaType, 'image/png');
  assert.equal(file.size, bytes.length);
  assert.equal(file.path, join(files.directory, file.id));
  assert.deepEqual(await readFile(file.path), bytes);
  const svg = await files.save(Readable.from(['<svg onload="alert(1)"></svg>']), {
    ...meta,
    name: 'image.png',
  });
  assert.equal(svg.mediaType, 'application/octet-stream');
});

test('single-file and streaming limits reject excess bytes and remove partial files', async (t) => {
  const { files } = await storage(t, 8, 16);
  await assert.rejects(files.save(Readable.from(['too large']), { ...meta, size: 9 }), (error) =>
    status(error, 413),
  );
  await assert.rejects(files.save(Readable.from(['12345', '67890']), meta), (error) =>
    status(error, 413),
  );
  await assert.rejects(files.save(Readable.from(['12']), { ...meta, size: 4 }), (error) =>
    status(error, 400),
  );
  assert.deepEqual(await readdir(files.directory), []);
  const empty = await files.save(Readable.from([]), { ...meta, size: 0 });
  assert.equal(empty.size, 0);
});

test('quota reservations include concurrent uploads; cancellation releases reserved disk space', async (t) => {
  const { files } = await storage(t, 8, 10);
  const stream = new PassThrough();
  const pending = files.save(stream, meta);
  await assert.rejects(files.save(Readable.from(['a']), { ...meta, ownerId: 'other' }), (error) =>
    status(error, 507),
  );
  await assert.rejects(files.save(Readable.from(['a']), meta), (error) => status(error, 409));
  stream.end('12');
  const first = await pending;
  const second = await files.save(Readable.from(['12345678']), {
    ...meta,
    ownerId: 'other',
    size: 8,
  });
  await assert.rejects(files.save(Readable.from(['a']), { ...meta, size: 1 }), (error) =>
    status(error, 507),
  );
  files.remove(first.id);
  files.remove(second.id);
  const aborted = new PassThrough();
  const failing = files.save(aborted, meta);
  aborted.destroy(new Error('Client disconnected'));
  await assert.rejects(failing, /Client disconnected/);
  const restored = await files.save(Readable.from(['ok']), meta);
  assert.equal(restored.size, 2);
});

test('graceful disposal aborts active writes and removes the instance directory', async (t) => {
  const { files } = await storage(t);
  const stream = new PassThrough();
  const pending = files.save(stream, meta);
  const rejected = assert.rejects(pending);
  await files.dispose();
  await rejected;
  await assert.rejects(access(files.directory));
  await assert.rejects(files.save(Readable.from(['a']), meta), (error) => status(error, 503));
});

test('startup removes abandoned runs while preserving other live instances and unrelated folders', async (t) => {
  const { root, files } = await storage(t);
  const stale = join(root, 'run-2147483647-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  await mkdir(stale);
  await writeFile(join(stale, 'old-upload'), 'old');
  await mkdir(join(root, 'unrelated'));
  t.mock.method(process, 'kill', (pid: number) => {
    if (pid === 2147483647) throw Object.assign(new Error('No such process'), { code: 'ESRCH' });
    return true;
  });
  const next = new FileStore({ root });
  t.after(() => next.dispose());
  await assert.rejects(access(stale));
  await access(files.directory);
  await access(join(root, 'unrelated'));
});

test('attachment messages are delivered to members and files are deleted when history evicts them', async (t) => {
  const { files } = await storage(t);
  const service = new ChatService((message) => {
    if (message.attachment) files.remove(message.attachment.id);
  });
  const events: ChatServerMessage[] = [];
  const peer = { send: (message: ChatServerMessage) => events.push(message), close() {} };
  service.hello(peer, 'Mac', 'computer');
  const welcome = events.find((message) => message.type === 'welcome');
  assert.ok(welcome?.type === 'welcome');
  const device = service.deviceForToken(welcome.sessionToken)!;
  const file = await files.save(Readable.from(['hello']), { ...meta, ownerId: device.id });
  const { id, name, size, mediaType } = file;
  const message = service.publishFile('general', device, 'upload-1', { id, name, size, mediaType });
  assert.equal(message.attachment!.id, id);
  assert.equal(service.findMessage('general', device.id, 'upload-1')!.id, message.id);
  for (let index = 0; index < MESSAGE_LIMIT; index++)
    service.handle(peer, {
      type: 'send_message',
      conversationId: 'general',
      clientMessageId: String(index),
      text: String(index),
    });
  await assert.rejects(access(file.path));
  assert.throws(
    () => files.get(id),
    (error) => status(error, 404),
  );
});

test('volume settings are validated and converted from megabytes to bytes', () => {
  assert.deepEqual(uploadOptions({}), {
    maxFileBytes: 25 * 1024 * 1024,
    maxTotalBytes: 500 * 1024 * 1024,
  });
  assert.throws(() => uploadOptions({ UPLOAD_MAX_MB: '-1' }));
  assert.throws(() => uploadOptions({ UPLOAD_TOTAL_MB: 'NaN' }));
  assert.throws(() => new FileStore({ maxFileBytes: 20, maxTotalBytes: 10 }));
});

test('the allowlist accepts requested file categories and rejects executable, script and macro suffixes', () => {
  for (const name of [
    'скриншот.PNG',
    'photo.JpEg',
    'camera.heic',
    'clip.mov',
    'video.webm',
    'voice.m4a',
    'music.flac',
    'report.pdf',
    'document.docx',
    'table.xlsx',
    'slides.pptx',
    'notes.txt',
    'README.md',
    'data.json',
    'data.csv',
    'backup.zip',
    'backup.7z',
    'backup.rar',
    'backup.tar.gz',
    'backup.tar.xz',
  ])
    assert.equal(fileNameProblem(name), null, name);
  for (const name of [
    'setup.exe',
    'lib.dll',
    'update.msi',
    'application.app',
    'installer.dmg',
    'installer.pkg',
    'run.command',
    'library.dylib',
    'shortcut.lnk',
    'launch.bat',
    'launch.ps1',
    'script.js',
    'script.sh',
    'archive.jar',
    'report.docm',
    'sheet.xlsm',
    'slides.pptm',
    'page.html',
    'drawing.svg',
    'unknown',
    'no-extension.',
    '.json',
    'image.exe.png',
    'archive.app.zip',
    'notes.ps1.txt',
    'image.png ',
    'image.png.',
    'report:payload.png',
    'report\u0000.png',
    'report\u202e.png',
  ])
    assert.ok(fileNameProblem(name), name);
});

test('disallowed uploads never enter storage, and long permitted names keep their extension', async (t) => {
  const { files } = await storage(t);
  assert.deepEqual(files.policy.allowedExtensions, ALLOWED_FILE_EXTENSIONS);
  for (const name of ['a.exe', 'a.dmg', 'image.exe.png', 'launch.command.txt', 'image.png\u0000']) {
    await assert.rejects(files.save(Readable.from(['data']), { ...meta, name }), (error) =>
      status(error, 415),
    );
  }
  assert.deepEqual(await readdir(files.directory), []);
  const file = await files.save(Readable.from(['data']), {
    ...meta,
    name: 'д'.repeat(220) + '.txt',
  });
  assert.equal(file.name.length, 180);
  assert.ok(file.name.endsWith('.txt'));
  assert.equal(fileNameProblem(file.name), null);
});

test('renamed Windows, macOS and ELF binaries and shebang scripts are rejected across stream chunks', async (t) => {
  const { files } = await storage(t);
  const headers = [
    '4d5a0000',
    'feedface',
    'cefaedfe',
    'feedfacf',
    'cffaedfe',
    'cafebabe',
    'bebafeca',
    'cafebabf',
    'bfbafeca',
    '7f454c46',
    '23212f62',
    'efbbbf2321',
  ];
  for (const hex of headers) {
    const bytes = Buffer.from(hex, 'hex');
    const chunks = [...bytes].map((byte) => Buffer.from([byte]));
    await assert.rejects(
      files.save(Readable.from(chunks), { ...meta, name: 'renamed.txt' }),
      (error) => status(error, 415),
    );
    assert.deepEqual(await readdir(files.directory), [], hex);
  }
  const valid = await files.save(Readable.from(['# Notes\nJust text']), {
    ...meta,
    name: 'README.md',
  });
  assert.equal(valid.name, 'README.md');
});
