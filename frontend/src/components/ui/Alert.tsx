import type { ReactNode } from 'react';
import styles from './Alert.module.css';

export function Alert({ children, onDismiss }: { children: ReactNode; onDismiss(): void }) {
  return (
    <div className={styles.errorBanner} role="alert">
      <span>{children}</span>
      <button type="button" aria-label="Закрыть уведомление" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
