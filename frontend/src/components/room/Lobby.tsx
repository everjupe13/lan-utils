import { useRoomCode } from '../../composables/useRoomCode';
import type { RoomSummary } from '@nearby/shared/room';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Eyebrow, MutedText } from '../ui/Typography';
import { RoomList } from './RoomList';
import styles from './Lobby.module.css';

export function Lobby({
  rooms,
  ready,
  onCreate,
  onJoin,
}: {
  rooms: RoomSummary[];
  ready: boolean;
  onCreate(): void;
  onJoin(roomId: string): void;
}) {
  const form = useRoomCode(onJoin);
  return (
    <main className={styles.lobby}>
      <div className={styles.pageHeading}>
        <div>
          <Eyebrow>ИГРОВАЯ</Eyebrow>
          <h1>С кем сыграем?</h1>
        </div>
        <MutedText>
          Создайте своё место за доской
          <br />
          или присоединитесь к другу.
        </MutedText>
      </div>
      <div className={styles.lobbyActions}>
        <Card className={styles.createCard}>
          <span className={styles.cardIcon}>♔</span>
          <h2>Новая партия</h2>
          <p>Вы играете белыми. Пригласите соперника по коду комнаты или ссылке.</p>
          <Button disabled={!ready} onClick={onCreate}>
            Создать комнату <span>+</span>
          </Button>
        </Card>
        <Card className={styles.joinCard}>
          <Eyebrow>УЖЕ ПРИГЛАСИЛИ?</Eyebrow>
          <h2>Место напротив</h2>
          <MutedText>Введите шестизначный код комнаты.</MutedText>
          <form className={styles.joinForm} onSubmit={form.submit}>
            <Input
              aria-label="Код комнаты"
              placeholder="ABC234"
              value={form.code}
              maxLength={6}
              minLength={6}
              pattern="[A-Za-z0-9]{6}"
              required
              onChange={(event) => form.setCode(event.target.value)}
            />
            <Button variant="secondary" type="submit" disabled={!ready}>
              Присоединиться ↗
            </Button>
          </form>
        </Card>
      </div>
      <section className={styles.roomsSection}>
        <RoomList rooms={rooms} ready={ready} onJoin={onJoin} />
      </section>
    </main>
  );
}
