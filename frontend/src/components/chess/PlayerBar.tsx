import type { Color } from '@nearby/shared/chess';
import type { Player } from '@nearby/shared/person';
import { classNames } from '../../utils/classNames';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './PlayerBar.module.css';

export function PlayerBar({ player, color, me }: { player?: Player; color: Color; me?: boolean }) {
  return (
    <div className={styles.playerBar}>
      <span className={classNames(styles.avatar, color === 'b' && styles.avatarDark)}>
        {player?.name[0]?.toUpperCase() ?? '?'}
      </span>
      <div>
        <strong>
          {player?.name ?? 'Место для соперника'} {me && <small>(вы)</small>}
        </strong>
        <span>{player ? `@${player.login}` : 'Пригласите друга в комнату'}</span>
      </div>
      <StatusBadge className={styles.playerPresence} online={player?.connected}>
        {player?.connected ? 'За доской' : player ? 'Не в сети' : 'Ожидание'}
      </StatusBadge>
    </div>
  );
}
