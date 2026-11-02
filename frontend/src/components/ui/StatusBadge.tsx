import type { ReactNode } from 'react';
import { classNames } from '../../utils/classNames';
import styles from './StatusBadge.module.css';

export function StatusBadge({
  online,
  compact,
  children,
  className,
}: {
  online?: boolean;
  compact?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={classNames(styles.badge, compact && styles.compact, className)}>
      <i aria-hidden="true" className={classNames(styles.dot, online && styles.online)} />
      <span>{children}</span>
    </span>
  );
}
