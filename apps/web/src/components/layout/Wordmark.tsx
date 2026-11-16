import { Link } from 'react-router';
import { cn } from '../../lib/cn';

export function Wordmark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <Link
      to="/"
      className={cn(
        'font-display text-2xl font-extrabold tracking-tight',
        inverted ? 'text-white' : 'text-leaf-700',
        className,
      )}
    >
      FoodFlow
    </Link>
  );
}
