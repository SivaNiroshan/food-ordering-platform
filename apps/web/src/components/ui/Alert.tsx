import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Alert({
  tone = 'error',
  children,
  className,
}: {
  tone?: 'error' | 'info';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-4 py-3 text-sm',
        tone === 'error' ? 'bg-chili-50 text-chili-600' : 'bg-leaf-50 text-leaf-700',
        className,
      )}
    >
      {children}
    </div>
  );
}
