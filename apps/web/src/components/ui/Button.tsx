import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-leaf-700 text-white hover:bg-leaf-800 disabled:bg-leaf-700/50',
  secondary:
    'border border-line bg-white text-ink hover:border-leaf-600 hover:text-leaf-700 disabled:opacity-50',
  ghost: 'text-ink hover:bg-leaf-50 disabled:opacity-50',
  danger: 'bg-chili-600 text-white hover:bg-chili-600/90 disabled:bg-chili-600/50',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 font-medium transition-colors disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && <Spinner label="Working" />}
      {children}
    </button>
  );
}
