import { useEffect, useRef, useState } from 'react';
import { copyText } from '../utils/clipboard';

export function useClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);
  async function copy(text: string, key = text) {
    const success = await copyText(text);
    clearTimeout(reset.current);
    setCopied(success ? key : null);
    setError(
      success
        ? ''
        : 'Не удалось скопировать автоматически. Выделите текст и скопируйте его вручную.',
    );
    if (success) reset.current = setTimeout(() => setCopied(null), 2000);
  }
  return { copied, error, copy };
}
