import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Readable } from 'node:stream';
import type { FileAttachment, UploadPolicy } from '@nearby/shared/files';
import type { FileStoreOptions, StoredFile } from '../types/files.js';
import { ALLOWED_FILE_EXTENSIONS, fileNameProblem } from '@nearby/shared/file-policy';
import { hasExecutableHeader } from '../validation/file-content.js';

export class FileError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function uploadOptions(env: NodeJS.ProcessEnv): FileStoreOptions {
  const megabytes = (key: string, fallback: number) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > 10240)
      throw new Error(`${key}: требуется целое число от 1 до 10240.`);
    return value * 1024 * 1024;
  };
  return {
    maxFileBytes: megabytes('UPLOAD_MAX_MB', 25),
    maxTotalBytes: megabytes('UPLOAD_TOTAL_MB', 500),
  };
}

export function safeFileName(name: string) {
  const clean =
    name
      .split(/[\\/]/)
      .at(-1)!
      .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '')
      .trim()
      .replace(/^\.+$/, '') || 'file';
  if (clean.length <= 180) return clean;
  const dot = clean.lastIndexOf('.');
  const extension = dot > 0 ? clean.slice(dot) : '';
  return clean.slice(0, 180 - extension.length) + extension;
}

function mediaType(head: Buffer): FileAttachment['mediaType'] {
  if (head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(head.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (
    head.subarray(0, 4).toString('ascii') === 'RIFF' &&
    head.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  return 'application/octet-stream';
}

/** Bytes go to private disk files; only metadata and quotas stay in memory. */
export class FileStore {
  readonly directory: string;
  readonly policy: UploadPolicy;
  private files = new Map<string, StoredFile>();
  private active = new Map<string, Readable>();
  private tasks = new Set<Promise<unknown>>();
  private reserved = 0;
  private used = 0;
  private closed = false;

  constructor(options: FileStoreOptions = {}) {
    this.policy = {
      maxFileBytes: options.maxFileBytes ?? 25 * 1024 * 1024,
      maxTotalBytes: options.maxTotalBytes ?? 500 * 1024 * 1024,
      allowedExtensions: ALLOWED_FILE_EXTENSIONS,
    };
    if (
      !Number.isSafeInteger(this.policy.maxFileBytes) ||
      this.policy.maxFileBytes < 1 ||
      !Number.isSafeInteger(this.policy.maxTotalBytes) ||
      this.policy.maxTotalBytes < this.policy.maxFileBytes
    )
      throw new Error('Общий лимит файлов должен быть не меньше лимита одного файла.');
    const root = options.root ?? fileURLToPath(new URL('../../.runtime/files/', import.meta.url));
    mkdirSync(root, { recursive: true, mode: 0o700 });
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const match = /^run-(\d+)-[a-f0-9-]{36}$/.exec(entry.name);
      if (!entry.isDirectory() || !match || Number(match[1]) < 1) continue;
      let alive = true;
      try {
        process.kill(Number(match[1]), 0);
      } catch (error) {
        alive = (error as NodeJS.ErrnoException).code !== 'ESRCH';
      }
      if (!alive) rmSync(join(root, entry.name), { recursive: true, force: true });
    }
    this.directory = join(root, `run-${process.pid}-${randomUUID()}`);
    mkdirSync(this.directory, { mode: 0o700 });
  }

  save(
    source: Readable,
    input: { ownerId: string; conversationId: string; name: string; size?: number },
  ): Promise<StoredFile> {
    const task = this.receive(source, input);
    this.tasks.add(task);
    void task.then(
      () => this.tasks.delete(task),
      () => this.tasks.delete(task),
    );
    return task;
  }

  get(id: string) {
    const file = this.files.get(id);
    if (!file)
      throw new FileError(
        404,
        'Файл не найден. Возможно, сервер был перезапущен или сообщение удалено из истории.',
      );
    return file;
  }

  remove(id: string) {
    const file = this.files.get(id);
    if (!file) return;
    rmSync(file.path, { force: true });
    this.files.delete(id);
    this.used -= file.size;
  }

  async dispose() {
    this.closed = true;
    for (const source of this.active.values()) source.destroy(new Error('Сервер остановлен.'));
    await Promise.allSettled([...this.tasks]);
    this.disposeSync();
  }

  /** Last-chance cleanup during process exit; the next startup also removes abandoned runs. */
  disposeSync = () => {
    this.closed = true;
    try {
      rmSync(this.directory, { recursive: true, force: true });
    } catch (error) {
      console.error('Не удалось очистить временные файлы:', (error as Error).message);
    }
    this.files.clear();
    this.used = 0;
  };

  private async receive(
    source: Readable,
    input: { ownerId: string; conversationId: string; name: string; size?: number },
  ) {
    if (this.closed) throw new FileError(503, 'Сервер останавливается.');
    const nameProblem = fileNameProblem(input.name);
    if (nameProblem) throw new FileError(415, nameProblem);
    const name = safeFileName(input.name);
    const storedNameProblem = fileNameProblem(name);
    if (storedNameProblem) throw new FileError(415, storedNameProblem);
    const reservation = input.size ?? this.policy.maxFileBytes;
    if (!Number.isSafeInteger(reservation) || reservation < 0)
      throw new FileError(400, 'Некорректный размер файла.');
    if (reservation > this.policy.maxFileBytes)
      throw new FileError(
        413,
        `Файл превышает лимит ${this.policy.maxFileBytes / 1024 / 1024} МБ.`,
      );
    if (this.active.has(input.ownerId))
      throw new FileError(409, 'Дождитесь завершения предыдущей загрузки с этого устройства.');
    if (this.used + this.reserved + reservation > this.policy.maxTotalBytes)
      throw new FileError(
        507,
        'Временное хранилище заполнено. Освободите место перезапуском сервера.',
      );
    const onError = () => {};
    source.on('error', onError);
    this.active.set(input.ownerId, source);
    this.reserved += reservation;
    const id = randomUUID();
    const path = join(this.directory, id);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    let complete = false;
    try {
      handle = await open(path, 'wx', 0o600);
      let size = 0;
      let head = Buffer.alloc(0);
      // Do not destroy the HTTP socket on validation errors: the route must still return JSON.
      for await (const chunk of source.iterator({ destroyOnReturn: false })) {
        if (this.closed) throw new FileError(503, 'Сервер останавливается.');
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > this.policy.maxFileBytes || size > reservation)
          throw new FileError(413, 'Превышен допустимый размер файла.');
        if (head.length < 16) head = Buffer.concat([head, bytes.subarray(0, 16 - head.length)]);
        if (hasExecutableHeader(head))
          throw new FileError(
            415,
            'Обнаружена сигнатура исполняемого файла или скрипта. Переименование расширения не разрешает его загрузку.',
          );
        let offset = 0;
        while (offset < bytes.length)
          offset += (await handle.write(bytes, offset, bytes.length - offset)).bytesWritten;
      }
      if (input.size !== undefined && size !== input.size)
        throw new FileError(400, 'Файл загружен не полностью.');
      await handle.close();
      handle = undefined;
      if (this.closed) throw new FileError(503, 'Сервер останавливается.');
      const file: StoredFile = {
        id,
        path,
        name,
        size,
        mediaType: mediaType(head),
        conversationId: input.conversationId,
      };
      this.files.set(id, file);
      this.used += size;
      complete = true;
      return file;
    } finally {
      await handle?.close().catch(() => {});
      if (!complete) rmSync(path, { force: true });
      this.active.delete(input.ownerId);
      this.reserved -= reservation;
      source.off('error', onError);
    }
  }
}
