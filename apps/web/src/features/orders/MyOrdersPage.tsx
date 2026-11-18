import { Link, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { formatPrice } from '../../lib/money';
import { formatDateTime, orderNumber } from './order-status';
import type { Order } from './order-types';
import { OrderStatusBadge } from './OrderStatusBadge';
import { useMyOrders } from './orders-api';

export function MyOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const orders = useMyOrders(page);
  const meta = orders.data?.meta;

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-4xl font-extrabold">My orders</h1>
      <p className="mt-2 text-ash">Your latest orders first. Open one to follow it live.</p>

      {orders.isPending ? (
        <div className="mt-10 text-leaf-700">
          <Spinner label="Loading your orders" />
        </div>
      ) : orders.isError ? (
        <Alert className="mt-8">{orders.error.message}</Alert>
      ) : orders.data.data.length === 0 ? (
        <div className="py-12">
          <p className="font-display text-xl font-semibold">You haven’t ordered anything yet.</p>
          <Link
            to="/menu"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-leaf-700 px-4 font-medium text-white hover:bg-leaf-800"
          >
            Browse the menu
          </Link>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {orders.data.data.map((order) => (
            <li key={order.id}>
              <OrderRow order={order} />
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <nav aria-label="Order pages" className="mt-8 flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setParams({ page: String(page - 1) })}
          >
            Newer
          </Button>
          <span className="text-sm text-ash">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= meta.totalPages}
            onClick={() => setParams({ page: String(page + 1) })}
          >
            Older
          </Button>
        </nav>
      )}
    </section>
  );
}

function OrderRow({ order }: { order: Order }) {
  const summary = order.items.map((i) => `${i.quantity} × ${i.itemName}`).join(', ');

  return (
    <Link
      to={`/orders/${order.id}`}
      className="block rounded-xl border border-line bg-white p-5 transition-colors hover:border-leaf-600"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold">Order {orderNumber(order.id)}</p>
          <p className="text-sm text-ash">{formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="min-w-0 truncate text-sm text-ash">{summary}</p>
        <p className="shrink-0 font-medium tabular-nums">{formatPrice(order.subtotal)}</p>
      </div>
    </Link>
  );
}
