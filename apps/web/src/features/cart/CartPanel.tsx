import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { MINIMUM_ORDER_CENTS } from '../../lib/config';
import { cn } from '../../lib/cn';
import { formatCents, formatPrice } from '../../lib/money';
import { useAuthStore } from '../auth/auth-store';
import { lineTotalCents, MAX_QUANTITY_PER_ITEM, subtotalCents, useCartStore } from './cart-store';

export function CartPanel({ className }: { className?: string }) {
  const lines = useCartStore((s) => s.lines);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const subtotal = subtotalCents(lines);
  const remaining = MINIMUM_ORDER_CENTS - subtotal;

  function handleCheckout() {
    if (user) navigate('/checkout');
    else navigate('/login', { state: { from: '/checkout' } });
  }

  return (
    <section
      aria-labelledby="cart-heading"
      className={cn('rounded-xl border border-line bg-white p-5', className)}
    >
      <h2 id="cart-heading" className="text-xl font-bold">
        Your order
      </h2>

      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-ash">
          Nothing here yet. Add dishes from the menu and they’ll appear here.
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-line">
            {lines.map((line) => (
              <li key={line.menuItemId} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{line.name}</p>
                    <p className="text-sm text-ash">{formatPrice(line.unitPrice)} each</p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums">
                    {formatCents(lineTotalCents(line))}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <QuantityStepper
                    label={line.name}
                    quantity={line.quantity}
                    max={MAX_QUANTITY_PER_ITEM}
                    onChange={(next) => setQuantity(line.menuItemId, next)}
                  />
                  <button
                    type="button"
                    className="text-sm text-ash underline underline-offset-4 hover:text-chili-600"
                    onClick={() => remove(line.menuItemId)}
                    aria-label={`Remove ${line.name}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-4">
            <span className="font-medium">Subtotal</span>
            <span className="font-display text-xl font-bold tabular-nums">
              {formatCents(subtotal)}
            </span>
          </div>

          {remaining > 0 && (
            <p className="mt-3 rounded-lg bg-turmeric-100 px-3 py-2 text-sm text-turmeric-700">
              Add {formatCents(remaining)} more to reach the {formatCents(MINIMUM_ORDER_CENTS)}{' '}
              minimum order.
            </p>
          )}

          <p className="mt-3 text-sm text-ash">
            You pay at the counter when you collect. Prices are confirmed when you place the order.
          </p>

          <Button className="mt-4 w-full" disabled={remaining > 0} onClick={handleCheckout}>
            {user ? 'Go to checkout' : 'Log in to order'}
          </Button>
        </>
      )}
    </section>
  );
}
