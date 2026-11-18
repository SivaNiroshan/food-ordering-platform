import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export function SelectField({ label, error, className, id, children, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={selectId} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-11 rounded-lg border bg-white px-3 outline-none focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100',
          error ? 'border-chili-600' : 'border-line',
        )}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-chili-600">
          {error}
        </p>
      )}
    </div>
  );
}
