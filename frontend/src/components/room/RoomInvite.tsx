import { useRoomInvite } from '../../composables/useRoomInvite';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Eyebrow, MutedText } from '../ui/Typography';
import styles from './RoomInvite.module.css';

export function RoomInvite({ roomId, waiting }: { roomId: string; waiting: boolean }) {
  const invite = useRoomInvite(roomId);
  return (
    <Card className={styles.inviteCard}>
      <Eyebrow>ВАША КОМНАТА</Eyebrow>
      <div className={styles.roomCode}>{roomId}</div>
      <MutedText>
        {waiting
          ? 'Передайте код другу. Партия начнётся, когда он займёт второе место.'
          : 'Два игрока. Одна партия. Без ограничения времени.'}
      </MutedText>
      <Button variant="secondary" full onClick={invite.copy}>
        {invite.copied ? 'Ссылка скопирована ✓' : 'Скопировать приглашение ↗'}
      </Button>
      {invite.error && <MutedText role="status">{invite.error}</MutedText>}
    </Card>
  );
}
