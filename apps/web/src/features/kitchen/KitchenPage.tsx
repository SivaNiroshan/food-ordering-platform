import { useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../lib/cn';
import { formatPrice } from '../../lib/money';
import { useNow } from '../../lib/use-now';
import { useAuthStore } from '../auth/auth-store';
import { formatDateTime, orderNumber } from '../orders/order-status';
import type { Order, OrderReasonCode, OrderStatus } from '../orders/order-types';
import { OrderStatusBadge } from '../orders/OrderStatusBadge';
import { LiveIndicator } from '../realtime/LiveIndicator';
import { useKitchenBoard, useOrderHistory } from './kitchen-api';
import { TicketCard } from './TicketCard';

const COLUMNS: { status: OrderStatus; title: string; empty: string }[] = [
  { status: 'PENDING', title: 'New', empty: 'No new orders.' },
  { status: 'ACCEPTED', title: 'Accepted', empty: 'Nothing waiting to start.' },
  { status: 'PREPARING', title: 'Preparing', empty: 'Nothing being prepared.' },
  { status: 'READY', title: 'Ready', empty: 'Nothing waiting for pickup.' },
];

const STAFF_REASON_LABEL: Record<OrderReasonCode, string> = {
  CUSTOMER_REQUEST: 'Cancelled by the customer',
  ITEM_UNAVAILABLE: 'Item unavailable',
  KITCHEN_BUSY: 'Kitchen too busy',
  RESTAURANT_CLOSING: 'Restaurant closing',
  ACCEPTANCE_TIMEOUT: 'Not accepted in time',
  OTHER: 'Other reason',
};

export function KitchenPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'history' ? 'history' : 'board';
  const role = useAuthStore((s) => s.user?.role);
  // Admins can watch the board; only kitchen staff move orders (the API enforces this too).
  const canAct = role === 'STAFF';

  function showView(next: 'board' | 'history') {
    setParams(next === 'board' ? {} : { view: next });
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold">{canAct ? 'Kitchen' : 'Orders'}</h1>
          <p className="mt-2 text-ash">
            {canAct
              ? 'Oldest orders first. New orders appear by themselves.'
              : 'You can follow every order here. Kitchen staff accept and update them.'}
          </p>
        </div>
        <LiveIndicator />
      </header>

      <div className="mt-6 inline-flex rounded-lg border border-line bg-white p-1" role="group">
        {(['board', 'history'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => showView(v)}
            className={cn(
              'h-9 rounded-md px-4 text-sm font-medium transition-colors',
              view === v ? 'bg-leaf-700 text-white' : 'text-ash hover:text-ink',
            )}
          >
            {v === 'board' ? 'Active orders' : 'Finished orders'}
          </button>
        ))}
      </div>

      {view === 'board' ? <Board canAct={canAct} /> : <History />}
    </div>
  );
}

function Board({ canAct }: { canAct: boolean }) {
  const board = useKitchenBoard();
  const now = useNow();

  if (board.isPending) {
    return (
      <div className="mt-10 text-leaf-700">
        <Spinner label="Loading orders" />
      </div>
    );
  }
  if (board.isError) return <Alert className="mt-8">{board.error.message}</Alert>;

  const byStatus = (status: OrderStatus) => board.data.data.filter((o) => o.status === status);

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((column) => {
        const orders = byStatus(column.status);
        const headingId = `column-${column.status}`;
        return (
          <section key={column.status} aria-labelledby={headingId} className="min-w-0">
            <h2
              id={headingId}
              className="flex items-center gap-2 border-b-2 border-leaf-700 pb-2 text-xl font-bold"
            >
              {column.title}
              <span
                className={cn(
                  'grid h-6 min-w-6 place-items-center rounded-full px-2 text-xs font-semibold',
                  column.status === 'PENDING' && orders.length > 0
                    ? 'bg-turmeric-500 text-ink'
                    : 'bg-line text-ash',
                )}
              >
                <span className="sr-only">, </span>
                {orders.length}
              </span>
            </h2>
            {orders.length === 0 ? (
              <p className="mt-4 text-sm text-ash">{column.empty}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {orders.map((order) => (
                  <li key={order.id}>
                    <TicketCard order={order} canAct={canAct} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function History() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const date = params.get('date') ?? undefined;
  const history = useOrderHistory({ page, date });
  const meta = history.data?.meta;

  function update(changes: Record<string, string | undefined>) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  }

  return (
    <section aria-label="Finished orders" className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="history-date" className="text-sm font-medium">
            Day
          </label>
          <input
            id="history-date"
            type="date"
            value={date ?? ''}
            onChange={(e) => update({ date: e.target.value || undefined, page: undefined })}
            className="h-11 rounded-lg border border-line bg-white px-3 outline-none focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100"
          />
        </div>
        {date && (
          <Button variant="ghost" onClick={() => update({ date: undefined, page: undefined })}>
            Show all days
          </Button>
        )}
      </div>

      {history.isPending ? (
        <div className="mt-8 text-leaf-700">
          <Spinner label="Loading finished orders" />
        </div>
      ) : history.isError ? (
        <Alert className="mt-6">{history.error.message}</Alert>
      ) : history.data.data.length === 0 ? (
        <p className="mt-8 text-ash">
          {date ? 'No finished orders on this day.' : 'No finished orders yet.'}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
          {history.data.data.map((order) => (
            <li key={order.id}>
              <HistoryRow order={order} />
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <nav aria-label="Finished order pages" className="mt-6 flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => update({ page: String(page - 1) })}
          >
            Newer
          </Button>
          <span className="text-sm text-ash">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= meta.totalPages}
            onClick={() => update({ page: String(page + 1) })}
          >
            Older
          </Button>
        </nav>
      )}
    </section>
  );
}

function HistoryRow({ order }: { order: Order }) {
  const summary = order.items.map((i) => `${i.quantity} × ${i.itemName}`).join(', ');
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-bold">
          {orderNumber(order.id)}{' '}
          <span className="font-sans text-sm font-normal text-ash">{order.customer?.name}</span>
        </p>
        <p className="text-sm text-ash">{formatDateTime(order.createdAt)}</p>
        <p className="mt-1 truncate text-sm">{summary}</p>
        {order.statusReason && (
          <p className="mt-1 text-sm text-chili-600">
            {STAFF_REASON_LABEL[order.statusReason.code]}
            {order.statusReason.note && `: ${order.statusReason.note}`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="font-medium tabular-nums">{formatPrice(order.subtotal)}</span>
        <OrderStatusBadge status={order.status} />
      </div>
    </div>
  );
}
