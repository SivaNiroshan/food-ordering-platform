import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/api-client';
import { MINIMUM_ORDER_CENTS } from '../../lib/config';
import { formatCents } from '../../lib/money';
import { lineTotalCents, subtotalCents, useCartStore } from '../cart/cart-store';
import { usePlaceOrder } from './orders-api';

const NOTES_MAX = 300;

export function CheckoutPage() {
  const lines = useCartStore((s) => s.lines);
  const removeFromCart = useCartStore((s) => s.remove);
  const clearCart = useCartStore((s) => s.clear);
  const navigate = useNavigate();
  const placeOrder = usePlaceOrder();

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  /*
   * One Idempotency-Key per checkout attempt. If the request fails or times out and the
   * customer presses the button again, the SAME key is sent, so the API returns the order
   * it may already have created instead of making a second one. A changed cart or note
   * is a different order, so it gets a new key.
   */
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const subtotal = subtotalCents(lines);
  const belowMinimum = subtotal < MINIMUM_ORDER_CENTS;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const items = lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }));
    const trimmedNotes = notes.trim() || undefined;
    const signature = JSON.stringify([items, trimmedNotes]);
    if (attempt.current?.signature !== signature) {
      attempt.current = { signature, key: crypto.randomUUID() };
    }

    try {
      const order = await placeOrder.mutateAsync({
        items,
        notes: trimmedNotes,
        idempotencyKey: attempt.current.key,
      });
      // Navigate first, so this page never flashes its "empty cart" state.
      navigate(`/orders/${order.id}`, { replace: true, state: { justPlaced: true } });
      clearCart();
    } catch (err) {
      setError(describeError(err));
    }
  }

  function describeError(err: unknown): string {
    if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';

    switch (err.code) {
      case 'MENU_ITEM_UNAVAILABLE': {
        const ids = Array.isArray(err.details)
          ? (err.details as { menuItemId: string }[]).map((d) => d.menuItemId)
          : [];
        const names = lines.filter((l) => ids.includes(l.menuItemId)).map((l) => l.name);
        ids.forEach(removeFromCart);
        const list = names.join(', ') || 'Some items';
        return `${list} ${names.length === 1 ? 'is' : 'are'} no longer available, so we removed ${
          names.length === 1 ? 'it' : 'them'
        } from your order. Check your order, then place it again.`;
      }
      case 'NETWORK_ERROR':
        return 'We couldn’t reach the server, so we can’t tell whether your order went through. Press Place order again: if it did go through, you’ll see the same order, not a second one.';
      default:
        return err.message;
    }
  }

  if (lines.length === 0) {
    return (
      <section className="mx-auto max-w-lg py-12">
        {/* E.g. every item sold out while the customer was checking out: still say why. */}
        {error && <Alert className="mb-6">{error}</Alert>}
        <h1 className="text-3xl font-bold">Your order is empty</h1>
        <p className="mt-2 text-ash">Add dishes from the menu to place an order.</p>
        <Link
          to="/menu"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-leaf-700 px-4 font-medium text-white hover:bg-leaf-800"
        >
          Browse the menu
        </Link>
      </section>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mx-auto max-w-2xl">
      <Link to="/menu" className="text-sm font-medium text-leaf-700 underline underline-offset-4">
        Back to the menu
      </Link>
      <h1 className="mt-4 text-4xl font-extrabold">Checkout</h1>
      <p className="mt-2 text-ash">Check your order, add a note if you need to, and place it.</p>

      {error && <Alert className="mt-6">{error}</Alert>}

      <section
        aria-labelledby="summary-heading"
        className="mt-8 rounded-xl border border-line bg-white p-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="summary-heading" className="text-xl font-bold">
            Your order
          </h2>
          <Link
            to="/cart"
            className="text-sm font-medium text-leaf-700 underline underline-offset-4"
          >
            Edit
          </Link>
        </div>

        <ul className="mt-3 divide-y divide-line">
          {lines.map((line) => (
            <li key={line.menuItemId} className="flex justify-between gap-4 py-3">
              <span>
                <span className="font-medium tabular-nums">{line.quantity} ×</span> {line.name}
              </span>
              <span className="tabular-nums">{formatCents(lineTotalCents(line))}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-medium">Total</span>
          <span className="font-display text-2xl font-bold tabular-nums">
            {formatCents(subtotal)}
          </span>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-1.5">
        <label htmlFor="order-notes" className="text-sm font-medium">
          Notes for the kitchen (optional)
        </label>
        <textarea
          id="order-notes"
          rows={3}
          maxLength={NOTES_MAX}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="For example: less spicy, no onions"
          aria-describedby="order-notes-count"
          className="rounded-lg border border-line bg-white px-3 py-2 outline-none transition-colors placeholder:text-ash/70 focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100"
        />
        <p id="order-notes-count" className="text-right text-xs text-ash">
          {notes.length}/{NOTES_MAX}
        </p>
      </div>

      <section className="mt-4 rounded-xl bg-leaf-50 p-5 text-leaf-800">
        <h2 className="font-display text-lg font-bold text-leaf-800">Pickup and payment</h2>
        <p className="mt-1 text-sm">
          Collect your order from the counter and pay there. This page will show you when it’s
          ready.
        </p>
      </section>

      {belowMinimum && (
        <p className="mt-4 rounded-lg bg-turmeric-100 px-3 py-2 text-sm text-turmeric-700">
          The minimum order is {formatCents(MINIMUM_ORDER_CENTS)}. Add{' '}
          {formatCents(MINIMUM_ORDER_CENTS - subtotal)} more to place it.
        </p>
      )}

      <Button
        type="submit"
        className="mt-6 h-12 w-full text-base"
        loading={placeOrder.isPending}
        disabled={belowMinimum}
      >
        Place order
      </Button>
    </form>
  );
}
