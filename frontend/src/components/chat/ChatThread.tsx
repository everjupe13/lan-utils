import type { ChatMessage, ConversationState } from '@nearby/shared/chat';
import type { PendingMessage } from '../../types/chat';
import { useClipboard } from '../../composables/useClipboard';
import { useNetworkLinks } from '../../composables/useNetworkLinks';
import { Button } from '../ui/Button';
import { ChatMessages } from './ChatMessages';
import { MessageComposer } from './MessageComposer';
import styles from './ChatThread.module.css';

export function ChatThread({
  conversation,
  title,
  deviceId,
  ready,
  pending,
  lastSent,
  onSend,
  onFileMessage,
}: {
  conversation: ConversationState;
  title: string;
  deviceId: string;
  ready: boolean;
  pending: boolean;
  lastSent: PendingMessage | null;
  onSend(text: string): boolean;
  onFileMessage(message: ChatMessage): void;
}) {
  const clipboard = useClipboard();
  const network = useNetworkLinks(`/chat?room=${encodeURIComponent(conversation.id)}`);
  const link = network.links[0];
  return (
    <section className={styles.thread}>
      <header className={styles.heading}>
        <div>
          <h2>
            {conversation.kind === 'room' ? '# ' : '↔ '}
            {title}
          </h2>
          <p>
            {conversation.kind === 'room'
              ? 'Комната для всех подключённых устройств'
              : 'Личный диалог двух устройств'}
          </p>
        </div>
        {conversation.kind === 'room' && (
          <Button variant="text" disabled={!link} onClick={() => link && clipboard.copy(link)}>
            {clipboard.copied === link ? 'Скопировано ✓' : 'Пригласить ↗'}
          </Button>
        )}
      </header>
      {clipboard.error && (
        <div className={styles.copyFallback}>
          <p role="status">{clipboard.error}</p>
          <input
            aria-label="Ссылка приглашения"
            readOnly
            value={link ?? ''}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
      <ChatMessages
        conversationId={conversation.id}
        messages={conversation.messages}
        deviceId={deviceId}
      />
      <MessageComposer
        conversationId={conversation.id}
        ready={ready}
        pending={pending}
        lastSent={lastSent}
        onSend={onSend}
        onFileMessage={onFileMessage}
      />
    </section>
  );
}
