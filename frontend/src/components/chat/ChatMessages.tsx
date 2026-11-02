import type { ChatMessage } from '@nearby/shared/chat';
import { useMessageScroll } from '../../composables/useMessageScroll';
import { useClipboard } from '../../composables/useClipboard';
import { messageLinks } from '../../utils/messageLinks';
import { classNames } from '../../utils/classNames';
import { Button } from '../ui/Button';
import styles from './ChatMessages.module.css';
import { FileAttachment } from './FileAttachment';

export function ChatMessages({
  conversationId,
  messages,
  deviceId,
}: {
  conversationId: string;
  messages: ChatMessage[];
  deviceId: string;
}) {
  const scroll = useMessageScroll(conversationId, messages.at(-1)?.id);
  const clipboard = useClipboard();
  return (
    <div
      className={styles.messages}
      ref={scroll.ref}
      onScroll={scroll.onScroll}
      role="log"
      aria-label="Сообщения"
      aria-live="polite"
    >
      {!messages.length && (
        <div className={styles.empty}>
          <span>↔</span>
          <h3>Начните разговор</h3>
          <p>Напишите сообщение или вставьте ссылку, чтобы открыть её на другом устройстве.</p>
        </div>
      )}
      {messages.map((message) => (
        <article
          key={message.id}
          className={classNames(styles.message, message.sender.id === deviceId && styles.own)}
        >
          <header>
            <strong>{message.sender.name}</strong>
            <time dateTime={message.createdAt}>
              {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </header>
          {message.text && (
            <p>
              {messageLinks(message.text).map((part, index) =>
                part.href ? (
                  <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
                    {part.text}
                  </a>
                ) : (
                  <span key={index}>{part.text}</span>
                ),
              )}
            </p>
          )}
          {message.attachment && (
            <FileAttachment key={message.attachment.id} file={message.attachment} />
          )}
          {message.text && (
            <Button variant="text" onClick={() => clipboard.copy(message.text, message.id)}>
              {clipboard.copied === message.id ? 'Скопировано ✓' : 'Копировать'}
            </Button>
          )}
        </article>
      ))}
      {clipboard.error && (
        <p className={styles.copyError} role="status">
          {clipboard.error}
        </p>
      )}
    </div>
  );
}
