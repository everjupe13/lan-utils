import { Button } from '../ui/Button';
import styles from './GameControls.module.css';

export function GameControls({
  active,
  ready,
  onResign,
  onLeave,
}: {
  active: boolean;
  ready: boolean;
  onResign(): void;
  onLeave(): void;
}) {
  return (
    <div className={styles.gameControls}>
      {active && (
        <Button variant="text" danger disabled={!ready} onClick={onResign}>
          ⚑ Сдаться
        </Button>
      )}
      <Button variant="text" disabled={!ready} onClick={onLeave}>
        Выйти из комнаты ↗
      </Button>
    </div>
  );
}
