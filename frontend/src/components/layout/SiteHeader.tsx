import type { GameStatus } from '../../types/game';
import type { Profile } from '@nearby/shared/person';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './SiteHeader.module.css';

const statusLabels: Record<GameStatus, string> = {
  connected: 'На связи',
  connecting: 'Подключаемся',
  reconnecting: 'Подключаемся',
  displaced: 'Другая вкладка',
  rejected: 'Проверьте профиль',
};

export function SiteHeader({
  profile,
  status,
  showProfile,
}: {
  profile: Profile | null;
  status: GameStatus;
  showProfile: boolean;
}) {
  return (
    <header className={styles.siteHeader}>
      <a className={styles.brand} href="/gambit" aria-label="Гамбит — шахматы">
        <span className={styles.brandMark}>♞</span>
        <span>
          тихий ход<span className={styles.brandCaption}>ШАХМАТЫ ДЛЯ ДВОИХ</span>
        </span>
      </a>
      <div className={styles.headerRight}>
        <a className={styles.menuLink} href="/">
          ← Меню
        </a>
        <StatusBadge compact online={Boolean(profile && status === 'connected')}>
          {profile ? statusLabels[status] : 'Локальная игра'}
        </StatusBadge>
        {profile && showProfile && (
          <span className={styles.profileBadge}>
            {profile.name}
            <small>@{profile.login}</small>
          </span>
        )}
      </div>
    </header>
  );
}
