import { useClipboard } from '../../composables/useClipboard';
import { useNetworkLinks } from '../../composables/useNetworkLinks';
import { Button } from '../ui/Button';
import styles from './NetworkAccess.module.css';

export function NetworkAccess() {
  const network = useNetworkLinks();
  const clipboard = useClipboard();
  return (
    <details className={styles.network}>
      <summary>
        Подключить другое устройство <span>+</span>
      </summary>
      <p>Подключите устройства к той же сети Wi-Fi или LAN и откройте один из адресов ниже.</p>
      {network.loading ? (
        <p>Ищем адреса компьютера…</p>
      ) : network.links.length ? (
        <div className={styles.links}>
          {network.links.map((link) => (
            <div className={styles.link} key={link}>
              <input
                aria-label="Адрес чата в локальной сети"
                readOnly
                value={link}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button variant="text" onClick={() => clipboard.copy(link)}>
                {clipboard.copied === link ? 'Скопировано' : 'Копировать'}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p>
          {network.error ||
            'Адрес локальной сети не найден. Проверьте подключение компьютера к сети.'}
        </p>
      )}
      {clipboard.error && <p role="status">{clipboard.error}</p>}
    </details>
  );
}
