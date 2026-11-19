import { useRealtimeStore } from './realtime-store';

/**
 * A thin bar under the header, on every page, when the live connection drops.
 * It only appears after a connection was working, so it never flashes on page load.
 */
export function ConnectionBanner() {
  const lost = useRealtimeStore((s) => s.lost);
  if (!lost) return null;

  return (
    <div role="status" className="bg-turmeric-100 text-sm text-turmeric-700">
      <p className="mx-auto max-w-6xl px-4 py-2">
        Lost connection to the server. Reconnecting… Live updates will resume by themselves.
      </p>
    </div>
  );
}
