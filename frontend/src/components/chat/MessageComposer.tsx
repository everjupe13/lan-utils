import { useRef } from 'react';
import { useChatComposer } from '../../composables/useChatComposer';
import type { ChatMessage } from '@nearby/shared/chat';
import type { PendingMessage } from '../../types/chat';
import { fileSize } from '../../utils/fileSize';
import { UploadQueue } from './UploadQueue';
import { Button } from '../ui/Button';
import styles from './MessageComposer.module.css';

export function MessageComposer({
  conversationId,
  ready,
  pending,
  lastSent,
  onSend,
  onFileMessage,
}: {
  conversationId: string;
  ready: boolean;
  pending: boolean;
  lastSent: PendingMessage | null;
  onSend(text: string): boolean;
  onFileMessage(message: ChatMessage): void;
}) {
  const composer = useChatComposer(conversationId, ready, pending, lastSent, onSend, onFileMessage);
  const form = composer.text;
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className={styles.composer}
      onSubmit={composer.submit}
      onDragOver={composer.dragOver}
      onDrop={composer.drop}
    >
      <label className={styles.label} htmlFor="chat-message">
        Сообщение или ссылка
      </label>
      <div className={styles.controls}>
        <textarea
          id="chat-message"
          value={form.text}
          maxLength={4000}
          rows={2}
          placeholder="Напишите что-нибудь или вставьте ссылку…"
          onChange={(event) => form.setText(event.target.value)}
          onKeyDown={composer.keyDown}
          onPaste={composer.paste}
        />
        <Button type="submit" disabled={!composer.canSend}>
          {composer.files.busy ? 'Передаём…' : pending ? 'Отправляем…' : 'Отправить ↑'}
        </Button>
      </div>
      <UploadQueue
        files={composer.files.queue}
        busy={composer.files.busy}
        onRemove={composer.files.remove}
        onRetry={composer.files.retry}
      />
      <div className={styles.attachments}>
        <input
          className={styles.fileInput}
          ref={input}
          type="file"
          accept={composer.files.policy?.allowedExtensions.join(',')}
          multiple
          aria-label="Прикрепить файлы"
          onChange={(event) => {
            if (event.target.files) composer.files.add(event.target.files);
            event.target.value = '';
          }}
        />
        <Button
          variant="text"
          disabled={!ready || !composer.files.policy}
          onClick={() => input.current?.click()}
        >
          + Прикрепить файл
        </Button>
        <span>
          {composer.files.policy
            ? `До ${fileSize(composer.files.policy.maxFileBytes)} на файл · можно перетащить или вставить скриншот`
            : 'Получаем лимиты файлов…'}
        </span>
        <details>
          <summary>Разрешённые расширения</summary>
          <p>{composer.files.policy?.allowedExtensions.join(', ')}</p>
        </details>
      </div>
      {composer.files.error && (
        <p className={styles.error} role="status">
          {composer.files.error}
        </p>
      )}
      <div className={styles.hint}>
        <span>Enter — отправить · Shift + Enter — новая строка</span>
        <span>{form.text.length} / 4000</span>
      </div>
    </form>
  );
}
