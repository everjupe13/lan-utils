import type { ComponentProps } from 'react';
import { classNames } from '../../utils/classNames';
import styles from './Card.module.css';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={classNames(styles.card, className)} />;
}
