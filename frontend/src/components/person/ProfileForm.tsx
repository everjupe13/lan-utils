import { useProfileForm } from '../../composables/useProfileForm';
import type { Profile } from '@nearby/shared/person';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Eyebrow, MutedText } from '../ui/Typography';
import styles from './ProfileForm.module.css';

export function ProfileForm({
  initial,
  onSubmit,
}: {
  initial: Profile | null;
  onSubmit(profile: Profile): void;
}) {
  const form = useProfileForm(initial, onSubmit);
  return (
    <Card className={styles.profileCard}>
      <Eyebrow>01 / ЗНАКОМСТВО</Eyebrow>
      <h2>Как вас представить?</h2>
      <MutedText>Имя и логин будут видны вашему сопернику.</MutedText>
      <form onSubmit={form.submit}>
        <label>
          Ваше имя
          <Input
            autoFocus
            required
            value={form.name}
            onChange={(event) => form.setName(event.target.value)}
            maxLength={40}
            placeholder="Например, Александр"
            autoComplete="given-name"
          />
        </label>
        <label>
          Логин
          <span className={styles.inputPrefix}>
            <span>@</span>
            <Input
              required
              pattern="[a-zA-Z0-9_-]{3,24}"
              minLength={3}
              maxLength={24}
              value={form.login}
              onChange={(event) => form.setLogin(event.target.value)}
              placeholder="chess_player"
              autoComplete="username"
            />
          </span>
        </label>
        <p className={styles.fieldHint}>3–24 символа: латиница, цифры, _ или -</p>
        <Button type="submit" full>
          Войти в игровую <span>↗</span>
        </Button>
      </form>
      <p className={styles.cardFootnote}>Профиль сохраняется в этой вкладке.</p>
    </Card>
  );
}
