import type { ComponentProps } from 'react';
import { classNames } from '../../utils/classNames';
import styles from './Button.module.css';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: 'primary' | 'secondary' | 'text';
  full?: boolean;
  small?: boolean;
  danger?: boolean;
}

export function Button({
  variant = 'primary',
  full,
  small,
  danger,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={classNames(
        variant === 'text' ? styles.textButton : styles.button,
        variant !== 'text' && styles[variant],
        full && styles.full,
        small && styles.small,
        danger && styles.danger,
        className,
      )}
    />
  );
}
