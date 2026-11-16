import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, className, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          'h-11 rounded-lg border bg-white px-3 outline-none transition-colors placeholder:text-ash/70 focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100',
          error ? 'border-chili-600' : 'border-line',
        )}
        {...props}
      />
      {message && (
        <p id={messageId} className={cn('text-sm', error ? 'text-chili-600' : 'text-ash')}>
          {message}
        </p>
      )}
    </div>
  );
}
