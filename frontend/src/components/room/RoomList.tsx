import type { RoomSummary } from '@nearby/shared/room';
import { Button } from '../ui/Button';
import { HeadingRow } from '../ui/HeadingRow';
import { StatusBadge } from '../ui/StatusBadge';
import { classNames } from '../../utils/classNames';
import styles from './RoomList.module.css';

export function RoomList({
  rooms,
  ready,
  onJoin,
}: {
  rooms: RoomSummary[];
  ready: boolean;
  onJoin(roomId: string): void;
}) {
  return (
    <>
      <HeadingRow title="Комнаты" count={rooms.length.toString().padStart(2, '0')}>
        <StatusBadge online compact>
          Обновляются в реальном времени
        </StatusBadge>
      </HeadingRow>
      {rooms.length === 0 ? (
        <div className={styles.emptyState}>
          <span>♙</span>
          <h3>Пока тихо</h3>
          <p>Создайте первую комнату — начало партии за вами.</p>
        </div>
      ) : (
        <div className={styles.roomList}>
          {rooms.map((room) => (
            <article key={room.id} className={styles.roomRow}>
              <span className={styles.roomSymbol}>♟</span>
              <div className={styles.roomHost}>
                <strong>{room.host}</strong>
                <span>Комната {room.id}</span>
              </div>
              <span
                className={classNames(
                  styles.roomStatus,
                  room.status === 'waiting' && styles.waiting,
                )}
              >
                {room.status === 'waiting' ? 'Ждёт соперника' : 'Идёт партия'}
              </span>
              <span className={styles.occupancy}>{room.players} / 2</span>
              <Button
                variant="secondary"
                small
                disabled={!ready || room.status !== 'waiting'}
                onClick={() => onJoin(room.id)}
              >
                За доску ↗
              </Button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
