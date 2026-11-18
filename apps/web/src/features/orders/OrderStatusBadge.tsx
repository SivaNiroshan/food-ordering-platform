import { cn } from '../../lib/cn';
import { STATUS_LABEL } from './order-status';
import type { OrderStatus } from './order-types';

// Turmeric = needs attention, solid green = go and collect it, chili = ended badly.
const styles: Record<OrderStatus, string> = {
  PENDING: 'bg-turmeric-100 text-turmeric-700',
  ACCEPTED: 'bg-leaf-50 text-leaf-700',
  PREPARING: 'bg-leaf-50 text-leaf-700',
  READY: 'bg-leaf-700 text-white',
  COMPLETED: 'bg-line/60 text-ash',
  REJECTED: 'bg-chili-50 text-chili-600',
  CANCELLED: 'bg-chili-50 text-chili-600',
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold whitespace-nowrap',
        styles[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
