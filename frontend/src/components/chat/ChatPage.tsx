import { useChat } from '../../composables/useChat';
import { Alert } from '../ui/Alert';
import { Eyebrow } from '../ui/Typography';
import { StatusBadge } from '../ui/StatusBadge';
import { DeviceSetup } from './DeviceSetup';
import { ChatSidebar } from './ChatSidebar';
import { ChatThread } from './ChatThread';
import styles from './ChatPage.module.css';

export function ChatPage() {
  const chat = useChat();
  const current = chat.conversations.find((value) => value.id === chat.conversation?.id);
  return (
    <main className={styles.chat}>
      <div className={styles.heading}>
        <div>
          <Eyebrow>СОБРАЛИСЬ В ОДНОЙ СЕТИ</Eyebrow>
          <h1>На связи.</h1>
        </div>
        <StatusBadge online={chat.ready}>
          {!chat.identity
            ? 'Без регистрации'
            : chat.ready
              ? `На связи: ${chat.devices.length}`
              : 'Подключаемся…'}
        </StatusBadge>
      </div>
      <p className={styles.intro}>
        Сообщения и ссылки между вашими устройствами. История исчезнет при перезапуске сервера.
      </p>
      {chat.error && <Alert onDismiss={() => chat.session?.clearError()}>{chat.error}</Alert>}
      {chat.needsName ? (
        <DeviceSetup initial={chat.identity} onEnter={chat.enter} />
      ) : chat.device && chat.session ? (
        <div className={styles.layout}>
          <ChatSidebar
            device={chat.device}
            devices={chat.devices}
            conversations={chat.conversations}
            active={chat.conversation?.id}
            unread={chat.unread}
            ready={chat.ready}
            onOpen={chat.session.open}
            onDirect={chat.session.direct}
            onCreate={chat.session.createRoom}
            onRename={chat.session.rename}
          />
          {chat.conversation ? (
            <ChatThread
              conversation={chat.conversation}
              title={current?.title ?? chat.conversation.title}
              deviceId={chat.device.id}
              ready={chat.ready}
              pending={Boolean(chat.pending)}
              lastSent={chat.lastSent}
              onSend={chat.session.sendText}
              onFileMessage={chat.session.acceptFileMessage}
            />
          ) : (
            <p>Выберите комнату.</p>
          )}
        </div>
      ) : (
        <p className={styles.loading} role="status">
          Подключаем устройство к локальной сети…
        </p>
      )}
    </main>
  );
}
