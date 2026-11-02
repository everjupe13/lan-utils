import type { ComponentProps } from 'react';
import { classNames } from '../../utils/classNames';
import styles from './Input.module.css';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={classNames(styles.input, className)} />;
}
