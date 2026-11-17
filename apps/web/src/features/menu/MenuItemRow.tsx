import { Button } from '../../components/ui/Button';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { cn } from '../../lib/cn';
import { formatPrice } from '../../lib/money';
import { MAX_QUANTITY_PER_ITEM, useCartStore } from '../cart/cart-store';
import type { MenuItem } from './menu-api';

export function MenuItemRow({ item, canOrder }: { item: MenuItem; canOrder: boolean }) {
  const quantity = useCartStore(
    (s) => s.lines.find((l) => l.menuItemId === item.id)?.quantity ?? 0,
  );
  const add = useCartStore((s) => s.add);
  const setQuantity = useCartStore((s) => s.setQuantity);

  return (
    <li className="flex gap-4 py-5">
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          className="size-20 shrink-0 rounded-lg object-cover"
        />
      )}

      <div className="min-w-0 flex-1">
        {/* Name ....... price, like a printed menu board */}
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-lg font-semibold">{item.name}</h3>
          <span
            aria-hidden="true"
            className="min-w-4 flex-1 border-b-2 border-dotted border-line"
          />
          <span
            className={cn(
              'shrink-0 font-medium tabular-nums',
              !item.isAvailable && 'text-ash line-through',
            )}
          >
            {formatPrice(item.price)}
          </span>
        </div>
        {item.description && (
          <p className="mt-1 max-w-prose text-sm text-ash">{item.description}</p>
        )}
        {!item.isAvailable && (
          <p className="mt-2 inline-block rounded-md bg-turmeric-100 px-2 py-0.5 text-xs font-medium text-turmeric-700">
            Sold out today
          </p>
        )}
      </div>

      {canOrder && item.isAvailable && (
        <div className="shrink-0 self-center">
          {quantity === 0 ? (
            <Button
              variant="secondary"
              className="h-10 min-w-20"
              aria-label={`Add ${item.name}`}
              onClick={() => add(item)}
            >
              Add
            </Button>
          ) : (
            <QuantityStepper
              label={item.name}
              quantity={quantity}
              max={MAX_QUANTITY_PER_ITEM}
              onChange={(next) => setQuantity(item.id, next)}
            />
          )}
        </div>
      )}
    </li>
  );
}