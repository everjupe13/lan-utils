import type { Profile } from '@nearby/shared/person';
import { Eyebrow } from '../ui/Typography';
import { ProfileForm } from './ProfileForm';
import styles from './Welcome.module.css';

export function Welcome({
  profile,
  onEnter,
}: {
  profile: Profile | null;
  onEnter(profile: Profile): void;
}) {
  return (
    <main className={styles.welcomeLayout}>
      <section className={styles.welcomeCopy}>
        <Eyebrow>ОДНА ДОСКА. ДВА ИГРОКА.</Eyebrow>
        <h1>
          Хорошая партия
          <br />
          начинается
          <br />
          <em>с одного хода.</em>
        </h1>
        <p className={styles.lead}>
          Пригласите друга за доску. Создайте комнату, поделитесь кодом — и играйте в своём ритме.
        </p>
        <div className={styles.welcomeBottom}>
          <span className={styles.decorPiece}>♔</span>
          <p>
            Без регистрации и таймера.
            <br />
            Только вы, соперник и 64 клетки.
          </p>
        </div>
      </section>
      <ProfileForm initial={profile} onSubmit={onEnter} />
    </main>
  );
}
