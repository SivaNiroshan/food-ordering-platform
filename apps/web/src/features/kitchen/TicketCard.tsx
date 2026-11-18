import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/toast-store';
import { ApiError } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import { formatPrice } from '../../lib/money';
import { orderNumber } from '../orders/order-status';
import type { Order } from '../orders/order-types';
import { NEXT_ACTION, useStaffOrderAction, type StaffActionInput } from './kitchen-api';
import { minutesLeft, timeAgo } from './kitchen-time';
import { RejectForm } from './RejectForm';

const URGENT_MINUTES = 3;

const borderByStatus: Record<string, string> = {
  PENDING: 'border-l-turmeric-500',
  ACCEPTED: 'border-l-leaf-600',
  PREPARING: 'border-l-leaf-600',
  READY: 'border-l-leaf-700',
};

function describeActionError(err: unknown, order: Order) {
  if (err instanceof ApiError && err.code === 'INVALID_STATUS_TRANSITION') {
    return `Order ${orderNumber(order.id)} was already updated, by someone else or because it timed out. The board is up to date now.`;
  }
  if (err instanceof ApiError && err.status === 403) {
    return 'Only kitchen staff can update orders.';
  }
  return err instanceof Error ? err.message : 'The order couldn’t be updated.';
}

/** One kitchen ticket: what to cook, any note, and the single next action. */
export function TicketCard({ order, canAct, now }: { order: Order; canAct: boolean; now: number }) {
  const mutation = useStaffOrderAction();
  const [rejecting, setRejecting] = useState(false);
  const next = NEXT_ACTION[order.status];
  const headingId = `ticket-${order.id}`;

  function run(input: StaffActionInput) {
    mutation.mutate(input, {
      onSuccess: () => setRejecting(false),
      onError: (err) => toast(describeActionError(err, order), 'attention'),
    });
  }

  const left = order.status === 'PENDING' ? minutesLeft(order.acceptanceDeadline, now) : null;

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        'rounded-xl border border-l-4 border-line bg-white p-4 shadow-sm',
        borderByStatus[order.status],
      )}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-2xl font-extrabold tabular-nums">
          {orderNumber(order.id)}
        </h3>
        <span className="text-sm text-ash">{timeAgo(order.createdAt, now)}</span>
      </header>
      {order.customer && <p className="text-sm text-ash">{order.customer.name}</p>}

      <ul className="mt-3 flex flex-col gap-1">
        {order.items.map((item) => (
          <li key={item.menuItemId} className="flex gap-2 text-lg leading-snug">
            <span className="w-8 shrink-0 font-display font-bold tabular-nums">
              {item.quantity}×
            </span>
            <span>{item.itemName}</span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mt-3 rounded-lg bg-turmeric-100 px-3 py-2 text-sm text-turmeric-700">
          <span className="font-semibold">Note:</span> {order.notes}
        </p>
      )}

      {left !== null && (
        <p
          className={cn(
            'mt-3 text-sm font-medium',
            left <= URGENT_MINUTES ? 'text-chili-600' : 'text-turmeric-700',
          )}
        >
          {left === 0 ? 'Cancelling automatically now' : `Cancels automatically in ${left} min`}
        </p>
      )}

      {order.status === 'READY' && (
        <p className="mt-3 text-sm">
          Collect <span className="font-semibold">{formatPrice(order.subtotal)}</span> when the
          customer picks it up.
        </p>
      )}

      {canAct && next && !rejecting && (
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            loading={mutation.isPending}
            onClick={() => run({ orderId: order.id, action: next.action })}
            aria-label={`${next.label}: order ${orderNumber(order.id)}`}
          >
            {next.label}
          </Button>
          {order.status === 'PENDING' && (
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setRejecting(true)}
              aria-label={`Reject order ${orderNumber(order.id)}`}
            >
              Reject
            </Button>
          )}
        </div>
      )}

      {canAct && rejecting && (
        <RejectForm
          submitting={mutation.isPending}
          onCancel={() => setRejecting(false)}
          onSubmit={(reasonCode, note) =>
            run({ orderId: order.id, action: 'reject', reasonCode, note })
          }
        />
      )}
    </article>
  );
}
