import { useMemo } from 'react';
import { useDeviceName } from '../../composables/useDeviceName';
import type { ChatIdentity } from '../../types/chat';
import { deviceHint } from '../../utils/deviceHint';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Eyebrow } from '../ui/Typography';
import styles from './DeviceSetup.module.css';

export function DeviceSetup({
  initial,
  onEnter,
}: {
  initial: ChatIdentity | null;
  onEnter(identity: ChatIdentity): void;
}) {
  const hint = useMemo(deviceHint, []);
  const form = useDeviceName(initial?.name ?? hint.name, (name) =>
    onEnter({ ...initial, name, kind: initial?.kind ?? hint.kind }),
  );
  return (
    <Card className={styles.setup}>
      <Eyebrow>ДАВАЙТЕ ПОЗНАКОМИМСЯ</Eyebrow>
      <h2>Как назвать это устройство?</h2>
      <p>
        Имя увидят другие участники вашей сети. Подсказку по браузеру можно заменить своим именем.
      </p>
      <form onSubmit={form.submit}>
        <label htmlFor="device-name">Имя устройства</label>
        <Input
          id="device-name"
          autoFocus
          required
          maxLength={40}
          value={form.name}
          onChange={(event) => form.setName(event.target.value)}
          placeholder="Например, ноутбук Саши"
        />
        <Button type="submit" full>
          Подключиться к чату ↗
        </Button>
      </form>
    </Card>
  );
}
