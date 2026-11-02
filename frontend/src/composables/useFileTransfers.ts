import { useEffect, useRef, useState } from 'react';
import { chatFiles, uploadPolicy } from '../services/ChatFiles';
import type { ChatMessage } from '@nearby/shared/chat';
import type { UploadPolicy } from '@nearby/shared/files';
import type { QueuedFile } from '../types/files';
import { fileSize } from '../utils/fileSize';
import { fileNameProblem } from '@nearby/shared/file-policy';

export function useFileTransfers(
  conversationId: string,
  ready: boolean,
  onMessage: (message: ChatMessage) => void,
) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [policy, setPolicy] = useState<UploadPolicy | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const active = useRef<{ id: string; controller: AbortController } | null>(null);
  const mounted = useRef(true);
  const removed = useRef(new Set<string>());
  const currentQueue = useRef(queue);
  currentQueue.current = queue;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    uploadPolicy(controller.signal)
      .then((value) => {
        setPolicy(value);
        setError('');
      })
      .catch((value) => {
        if (!controller.signal.aborted) setError((value as Error).message);
      });
    return () => controller.abort();
  }, [ready]);
  const patch = (id: string, value: Partial<QueuedFile>) => {
    if (mounted.current)
      setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...value } : item)));
  };
  function add(values: FileList | File[]) {
    if (!policy || !ready) return;
    const files = Array.from(values);
    if (files.length + currentQueue.current.length > 10) {
      setError('В очереди может быть не больше 10 файлов.');
      return;
    }
    const reason = (file: File) =>
      fileNameProblem(file.name) ??
      (!policy.allowedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension))
        ? 'Расширение не разрешено сервером.'
        : null) ??
      (file.size > policy.maxFileBytes
        ? `Максимальный размер — ${fileSize(policy.maxFileBytes)}.`
        : null) ??
      (file.name.length > 255 ? 'Имя должно быть не длиннее 255 символов.' : null);
    const rejected = files.filter((file) => reason(file));
    setError(
      rejected.length ? rejected.map((file) => `${file.name}: ${reason(file)}`).join(' ') : '',
    );
    const entries: QueuedFile[] = files
      .filter((file) => !rejected.includes(file))
      .map((file) => ({
        id: [...crypto.getRandomValues(new Uint8Array(16))]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join(''),
        file,
        conversationId,
        status: 'queued',
        progress: 0,
        error: '',
      }));
    setQueue((current) => [...current, ...entries]);
  }
  function remove(id: string) {
    removed.current.add(id);
    if (active.current?.id === id) active.current.controller.abort();
    else setQueue((current) => current.filter((item) => item.id !== id));
  }
  async function sendQueued(onlyId?: string) {
    if (running.current || !ready) return;
    const entries = currentQueue.current.filter((item) =>
      onlyId
        ? item.id === onlyId
        : item.conversationId === conversationId && item.status === 'queued',
    );
    if (!entries.length) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      for (const item of entries) {
        if (!mounted.current) break;
        if (removed.current.has(item.id)) continue;
        const controller = new AbortController();
        active.current = { id: item.id, controller };
        patch(item.id, { status: 'uploading', progress: 0, error: '' });
        try {
          const message = await chatFiles.upload(
            item.file,
            item.conversationId,
            item.id,
            (value) => patch(item.id, { progress: value }),
            controller.signal,
          );
          if (!mounted.current) break;
          onMessage(message);
          setQueue((current) => current.filter((value) => value.id !== item.id));
        } catch (value) {
          if (!mounted.current) break;
          if ((value as Error).name === 'AbortError')
            setQueue((current) => current.filter((value) => value.id !== item.id));
          else {
            patch(item.id, { status: 'failed', error: (value as Error).message });
            break;
          }
        } finally {
          active.current = null;
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    queue: queue.filter((item) => item.conversationId === conversationId),
    busy,
    policy,
    error,
    add,
    remove,
    sendQueued: () => sendQueued(),
    retry: (id: string) => sendQueued(id),
  };
}
