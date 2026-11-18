import { cn } from '../../lib/cn';
import { useToastStore, type ToastTone } from './toast-store';

const toneStyles: Record<ToastTone, string> = {
  info: 'border-line',
  success: 'border-leaf-600',
  attention: 'border-turmeric-500',
};

/**
 * Notifications for live events. Screen readers announce them through the live region.
 * Bottom-right on larger screens so they don't cover the page header and status badges.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-4 top-20 z-50 flex flex-col gap-2 sm:top-auto sm:right-6 sm:bottom-6 sm:left-auto sm:w-96"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-lg border-l-4 bg-white p-4 shadow-lg',
            toneStyles[t.tone],
          )}
        >
          <p className="flex-1 text-sm font-medium">{t.message}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
            className="-m-1 rounded p-1 text-ash hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
