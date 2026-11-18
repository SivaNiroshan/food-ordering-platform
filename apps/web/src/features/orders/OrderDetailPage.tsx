import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { ApiError } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import { formatPrice } from '../../lib/money';
import { LiveIndicator } from '../realtime/LiveIndicator';
import {
  CUSTOMER_HEADLINE,
  formatDateTime,
  formatTime,
  isFinal,
  ORDER_JOURNEY,
  orderNumber,
  REASON_LABEL,
  STATUS_LABEL,
} from './order-status';
import type { Order } from './order-types';
import { useCancelOrder, useMyOrder } from './orders-api';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const justPlaced = (location.state as { justPlaced?: boolean } | null)?.justPlaced;
  const order = useMyOrder(id);

  if (order.isPending) {
    return (
      <div className="py-16 text-leaf-700">
        <Spinner label="Loading your order" />
      </div>
    );
  }

  if (order.isError) {
    const notFound = order.error instanceof ApiError && order.error.status === 404;
    return (
      <section className="mx-auto max-w-lg py-12">
        <h1 className="text-3xl font-bold">
          {notFound ? 'We couldn’t find this order' : 'This order couldn’t be loaded'}
        </h1>
        <p className="mt-2 text-ash">
          {notFound ? 'It may belong to a different account.' : order.error.message}
        </p>
        <Link
          to="/orders"
          className="mt-6 inline-block font-medium text-leaf-700 underline underline-offset-4"
        >
          See your orders
        </Link>
      </section>
    );
  }

  const data = order.data;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/orders"
          className="text-sm font-medium text-leaf-700 underline underline-offset-4"
        >
          All orders
        </Link>
        {!isFinal(data.status) && <LiveIndicator />}
      </div>

      {justPlaced && (
        <Alert tone="info" className="mt-4">
          Order placed. This page updates by itself as the kitchen works on it.
        </Alert>
      )}

      <header className="mt-6">
        <p className="font-medium text-ash">
          Order {orderNumber(data.id)}, placed {formatDateTime(data.createdAt)}
        </p>
        <h1
          className={cn(
            'mt-1 text-4xl leading-tight font-extrabold sm:text-5xl',
            data.status === 'READY' && 'text-leaf-700',
            (data.status === 'REJECTED' || data.status === 'CANCELLED') && 'text-chili-600',
          )}
        >
          {CUSTOMER_HEADLINE[data.status]}
        </h1>
        <StatusDetail order={data} />
      </header>

      {data.status === 'PENDING' && <CancelOrder orderId={data.id} />}

      <OrderTimeline order={data} />

      <section
        aria-labelledby="items-heading"
        className="mt-10 rounded-xl border border-line bg-white p-5"
      >
        <h2 id="items-heading" className="text-xl font-bold">
          What you ordered
        </h2>
        <ul className="mt-3 divide-y divide-line">
          {data.items.map((item) => (
            <li key={item.menuItemId} className="flex justify-between gap-4 py-3">
              <span>
                <span className="font-medium tabular-nums">{item.quantity} ×</span> {item.itemName}
              </span>
              <span className="tabular-nums">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-medium">Total</span>
          <span className="font-display text-2xl font-bold tabular-nums">
            {formatPrice(data.subtotal)}
          </span>
        </div>
        <p className="mt-2 text-sm text-ash">
          {data.paymentStatus === 'PAID'
            ? 'Paid at the counter.'
            : 'Pay at the counter when you collect.'}
        </p>
        {data.notes && (
          <p className="mt-4 rounded-lg bg-coconut px-3 py-2 text-sm">
            <span className="font-medium">Your note:</span> {data.notes}
          </p>
        )}
      </section>
    </div>
  );
}

function StatusDetail({ order }: { order: Order }) {
  if (order.status === 'PENDING') {
    return (
      <p className="mt-3 text-ash">
        If the kitchen hasn’t accepted it by {formatTime(order.acceptanceDeadline)}, it’s cancelled
        automatically.
      </p>
    );
  }
  if (order.status === 'READY') {
    return (
      <p className="mt-3 text-lg">
        Show order <span className="font-bold">{orderNumber(order.id)}</span> at the counter and pay{' '}
        <span className="font-bold">{formatPrice(order.subtotal)}</span>.
      </p>
    );
  }
  if (order.statusReason) {
    return (
      <div className="mt-3 text-ash">
        <p>{REASON_LABEL[order.statusReason.code]}</p>
        {order.statusReason.note && <p className="mt-1">“{order.statusReason.note}”</p>}
      </div>
    );
  }
  return null;
}

function CancelOrder({ orderId }: { orderId: string }) {
  const cancel = useCancelOrder(orderId);
  const [confirming, setConfirming] = useState(false);

  const errorMessage =
    cancel.error instanceof ApiError && cancel.error.code === 'INVALID_STATUS_TRANSITION'
      ? 'The kitchen has already accepted this order, so it can’t be cancelled.'
      : cancel.error?.message;

  return (
    <div className="mt-6">
      {errorMessage && <Alert className="mb-3">{errorMessage}</Alert>}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-chili-600/30 bg-chili-50 p-4">
          <p className="mr-auto font-medium text-chili-600">Cancel this order?</p>
          <Button
            variant="secondary"
            onClick={() => setConfirming(false)}
            disabled={cancel.isPending}
          >
            Keep order
          </Button>
          <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
            Yes, cancel it
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Cancel order
        </Button>
      )}
    </div>
  );
}

function OrderTimeline({ order }: { order: Order }) {
  const reachedAt = new Map((order.history ?? []).map((h) => [h.newStatus, h.changedAt]));
  const ended = order.status === 'REJECTED' || order.status === 'CANCELLED';
  // An order that ended early only shows the steps it actually reached.
  const steps = ended ? ORDER_JOURNEY.filter((s) => reachedAt.has(s)) : ORDER_JOURNEY;

  return (
    <section aria-labelledby="progress-heading" className="mt-10">
      <h2 id="progress-heading" className="sr-only">
        Progress
      </h2>
      <ol className="relative flex flex-col gap-6 border-l-2 border-line pl-6">
        {steps.map((step) => {
          const time = reachedAt.get(step);
          const isCurrent = step === order.status && order.status !== 'COMPLETED';
          const state = !time ? 'todo' : isCurrent ? 'current' : 'done';
          return (
            <li key={step} className="relative" aria-current={isCurrent ? 'step' : undefined}>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-1 -left-[33px] grid size-4 place-items-center rounded-full ring-4 ring-coconut',
                  state === 'done' && 'bg-leaf-700',
                  state === 'current' && 'bg-turmeric-500',
                  state === 'todo' && 'border-2 border-line bg-white',
                )}
              >
                {state === 'current' && (
                  <span className="absolute size-4 animate-ping rounded-full bg-turmeric-400 opacity-60 motion-reduce:hidden" />
                )}
              </span>
              <p className={cn('font-medium', state === 'todo' && 'text-ash')}>
                {step === 'PENDING' ? 'Order placed' : STATUS_LABEL[step]}
              </p>
              {time && <p className="text-sm text-ash">{formatTime(time)}</p>}
            </li>
          );
        })}

        {ended && (
          <li className="relative">
            <span
              aria-hidden="true"
              className="absolute top-1 -left-[33px] size-4 rounded-full bg-chili-600 ring-4 ring-coconut"
            />
            <p className="font-medium text-chili-600">{STATUS_LABEL[order.status]}</p>
            {reachedAt.get(order.status) && (
              <p className="text-sm text-ash">{formatTime(reachedAt.get(order.status)!)}</p>
            )}
          </li>
        )}
      </ol>
    </section>
  );
}
