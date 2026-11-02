import { useChatRoomForm } from '../../composables/useChatRoomForm';
import { useDeviceName } from '../../composables/useDeviceName';
import type { ConversationSummary, Device } from '@nearby/shared/chat';
import { classNames } from '../../utils/classNames';
import { NetworkAccess } from '../network/NetworkAccess';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import styles from './ChatSidebar.module.css';

const icons = { computer: '▣', phone: '▯', tablet: '▤', unknown: '◇' };

export function ChatSidebar({
  device,
  devices,
  conversations,
  active,
  unread,
  ready,
  onOpen,
  onDirect,
  onCreate,
  onRename,
}: {
  device: Device;
  devices: Device[];
  conversations: ConversationSummary[];
  active?: string;
  unread: Record<string, number>;
  ready: boolean;
  onOpen(id: string): void;
  onDirect(id: string): void;
  onCreate(title: string): void;
  onRename(name: string): void;
}) {
  const form = useChatRoomForm(onCreate);
  return (
    <aside className={styles.sidebar}>
      <DeviceSettings key={device.name} device={device} ready={ready} onRename={onRename} />
      <section className={styles.section}>
        <h2>
          Комнаты <span>{conversations.filter((value) => value.kind === 'room').length}</span>
        </h2>
        <div className={styles.list}>
          {conversations
            .filter((value) => value.kind === 'room')
            .map((room) => (
              <button
                type="button"
                key={room.id}
                disabled={!ready}
                className={classNames(styles.item, active === room.id && styles.active)}
                onClick={() => onOpen(room.id)}
              >
                <span className={styles.symbol}>#</span>
                <span className={styles.itemText}>{room.title}</span>
                {Boolean(unread[room.id]) && (
                  <span className={styles.unread}>{unread[room.id]}</span>
                )}
              </button>
            ))}
        </div>
        <form className={styles.create} onSubmit={form.submit}>
          <Input
            required
            maxLength={40}
            aria-label="Название новой комнаты"
            value={form.title}
            onChange={(event) => form.setTitle(event.target.value)}
            placeholder="Новая комната"
          />
          <Button
            variant="secondary"
            type="submit"
            disabled={!ready || !form.title.trim()}
            aria-label="Создать комнату"
          >
            +
          </Button>
        </form>
      </section>
      <section className={styles.section}>
        <h2>
          Устройства <span>{devices.length}</span>
        </h2>
        <p className={styles.caption}>Сейчас на странице чата</p>
        <div className={styles.list}>
          {devices
            .filter((value) => value.id !== device.id)
            .map((peer) => (
              <button
                type="button"
                className={styles.item}
                key={peer.id}
                disabled={!ready}
                onClick={() => onDirect(peer.id)}
              >
                <span className={styles.symbol}>{icons[peer.kind]}</span>
                <span className={styles.itemText}>{peer.name}</span>
                <span className={styles.online} />
              </button>
            ))}
        </div>
        {devices.filter((value) => value.id !== device.id).length === 0 && (
          <p className={styles.caption}>
            Откройте чат на другом устройстве, чтобы отправить ему ссылку.
          </p>
        )}
      </section>
      {conversations.some((value) => value.kind === 'direct') && (
        <section className={styles.section}>
          <h2>Личные диалоги</h2>
          <div className={styles.list}>
            {conversations
              .filter((value) => value.kind === 'direct')
              .map((chat) => (
                <button
                  type="button"
                  key={chat.id}
                  disabled={!ready}
                  className={classNames(styles.item, active === chat.id && styles.active)}
                  onClick={() => onOpen(chat.id)}
                >
                  <span className={styles.symbol}>↔</span>
                  <span className={styles.itemText}>{chat.title}</span>
                  {Boolean(unread[chat.id]) && (
                    <span className={styles.unread}>{unread[chat.id]}</span>
                  )}
                </button>
              ))}
          </div>
        </section>
      )}
      <NetworkAccess />
    </aside>
  );
}

function DeviceSettings({
  device,
  ready,
  onRename,
}: {
  device: Device;
  ready: boolean;
  onRename(name: string): void;
}) {
  const form = useDeviceName(device.name, onRename);
  return (
    <details className={styles.identity}>
      <summary>
        <span>
          {icons[device.kind]} {device.name}
        </span>
        <small>Изменить</small>
      </summary>
      <form onSubmit={form.submit}>
        <Input
          aria-label="Новое имя устройства"
          required
          maxLength={40}
          value={form.name}
          onChange={(event) => form.setName(event.target.value)}
        />
        <Button variant="secondary" small type="submit" disabled={!ready}>
          Сохранить
        </Button>
      </form>
    </details>
  );
}
