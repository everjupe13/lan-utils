import { useEffect, useRef, useState } from 'react';
import { fileBlob } from '../services/ChatFiles';
import type { FileAttachment } from '@nearby/shared/files';

export function useFileAttachment(file: FileAttachment) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const url = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [file.id],
  );
  async function load(show: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    controller.current = new AbortController();
    let downloadUrl: string | undefined;
    try {
      const blob = await fileBlob(file, controller.current.signal);
      if (controller.current.signal.aborted) return;
      const objectUrl = URL.createObjectURL(blob);
      if (show) {
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = objectUrl;
        setPreview(objectUrl);
      } else {
        downloadUrl = objectUrl;
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = file.name;
        document.body.append(link);
        link.click();
        link.remove();
      }
    } catch (value) {
      if (!controller.current.signal.aborted) setError((value as Error).message);
    } finally {
      if (downloadUrl) {
        const value = downloadUrl;
        setTimeout(() => URL.revokeObjectURL(value), 1000);
      }
      if (!controller.current.signal.aborted) setBusy(false);
    }
  }
  function hide() {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setPreview(null);
  }
  function previewError() {
    hide();
    setError('Не удалось открыть изображение. Файл можно скачать.');
  }
  return {
    preview,
    busy,
    error,
    show: () => load(true),
    download: () => load(false),
    hide,
    previewError,
  };
}
