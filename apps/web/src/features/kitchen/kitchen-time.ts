const MINUTE = 60_000;

/** "Just now", "4 min ago", "1 h 5 min ago" */
export function timeAgo(iso: string, now: number): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / MINUTE);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h ago` : `${hours} h ${rest} min ago`;
}

/** Whole minutes left until `iso` (0 when it has passed). */
export function minutesLeft(iso: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / MINUTE));
}

/** Start and end of a calendar day ("2026-11-17") in the browser's time zone, as ISO strings. */
export function dayRange(date: string): { from: string; to: string } {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}
