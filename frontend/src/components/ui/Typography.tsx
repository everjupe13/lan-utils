import type { ComponentProps } from 'react';
import { classNames } from '../../utils/classNames';
import styles from './Typography.module.css';

export function Eyebrow({ className, ...props }: ComponentProps<'p'>) {
  return <p {...props} className={classNames(styles.eyebrow, className)} />;
}

export function MutedText({ className, ...props }: ComponentProps<'p'>) {
  return <p {...props} className={classNames(styles.muted, className)} />;
}
