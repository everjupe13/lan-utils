import type { ReactNode } from 'react';
import styles from './HeadingRow.module.css';

export function HeadingRow({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.sectionHeading}>
      <h2>
        {title}
        {count && <span>{count}</span>}
      </h2>
      {children}
    </header>
  );
}
