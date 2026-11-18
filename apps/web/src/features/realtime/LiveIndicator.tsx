import { cn } from '../../lib/cn';
import { useRealtimeStore } from './realtime-store';

/** Shows whether live updates are flowing, so users know if the page is current. */
export function LiveIndicator({ className }: { className?: string }) {
  const connected = useRealtimeStore((s) => s.connected);
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', connected ? 'bg-leaf-600' : 'bg-turmeric-500')}
      />
      <span className={connected ? 'text-leaf-700' : 'text-turmeric-700'}>
        {connected ? 'Live updates on' : 'Reconnecting…'}
      </span>
    </span>
  );
}
