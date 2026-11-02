import type { QueuedFile } from '../../types/files';
import { fileSize } from '../../utils/fileSize';
import { Button } from '../ui/Button';
import styles from './UploadQueue.module.css';

export function UploadQueue({
  files,
  busy,
  onRemove,
  onRetry,
}: {
  files: QueuedFile[];
  busy: boolean;
  onRemove(id: string): void;
  onRetry(id: string): void;
}) {
  if (!files.length) return null;
  return (
    <ul className={styles.queue} aria-label="Файлы к отправке">
      {files.map((item) => (
        <li key={item.id}>
          <div className={styles.row}>
            <div>
              <strong>{item.file.name}</strong>
              <small>
                {fileSize(item.file.size)}
                {item.status === 'queued'
                  ? ' · готов к отправке'
                  : item.status === 'uploading'
                    ? ` · ${item.progress}%`
                    : ' · ошибка'}
              </small>
            </div>
            <div className={styles.actions}>
              {item.status === 'failed' && (
                <Button variant="text" disabled={busy} onClick={() => onRetry(item.id)}>
                  Повторить
                </Button>
              )}
              <Button variant="text" onClick={() => onRemove(item.id)}>
                {item.status === 'uploading' ? 'Отменить' : 'Убрать'}
              </Button>
            </div>
          </div>
          {item.status === 'uploading' && (
            <progress value={item.progress} max={100} aria-label={`Загрузка ${item.file.name}`} />
          )}
          {item.error && <p role="status">{item.error}</p>}
        </li>
      ))}
    </ul>
  );
}
