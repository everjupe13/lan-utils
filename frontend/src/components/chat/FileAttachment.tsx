import type { FileAttachment as Attachment } from '@nearby/shared/files';
import { useFileAttachment } from '../../composables/useFileAttachment';
import { fileSize } from '../../utils/fileSize';
import { Button } from '../ui/Button';
import styles from './FileAttachment.module.css';

export function FileAttachment({ file }: { file: Attachment }) {
  const attachment = useFileAttachment(file);
  return (
    <section className={styles.attachment} aria-label={`Вложение: ${file.name}`}>
      <div className={styles.info}>
        <span aria-hidden="true">▧</span>
        <div>
          <strong>{file.name}</strong>
          <small>{fileSize(file.size)}</small>
        </div>
      </div>
      <div className={styles.actions}>
        <Button variant="text" disabled={attachment.busy} onClick={attachment.download}>
          {attachment.busy ? 'Загружаем…' : 'Скачать ↓'}
        </Button>
        {file.mediaType.startsWith('image/') && (
          <Button
            variant="text"
            disabled={attachment.busy}
            onClick={attachment.preview ? attachment.hide : attachment.show}
          >
            {attachment.preview ? 'Скрыть' : 'Предпросмотр'}
          </Button>
        )}
      </div>
      {attachment.preview && (
        <img
          className={styles.preview}
          src={attachment.preview}
          alt={file.name}
          onError={attachment.previewError}
        />
      )}
      {attachment.error && (
        <p className={styles.error} role="status">
          {attachment.error}
        </p>
      )}
    </section>
  );
}
