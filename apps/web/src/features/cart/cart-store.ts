import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toCents } from '../../lib/money';

// Same limits as the API's createOrderSchema.
export const MAX_QUANTITY_PER_ITEM = 20;
export const MAX_CART_LINES = 30;

export interface CartLine {
  menuItemId: string;
  name: string;
  /** Price when added, for display only. The API recalculates every price at checkout. */
  unitPrice: string;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  add: (item: { id: string; name: string; price: string }) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
}

/**
 * The cart lives in the browser (our requirements decision), saved to localStorage
 * so it survives a reload. The server only sees it at checkout, where it validates
 * every item and price again.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      add: (item) =>
        set((state) => {
          const existing = state.lines.find((l) => l.menuItemId === item.id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.menuItemId === item.id
                  ? { ...l, quantity: Math.min(l.quantity + 1, MAX_QUANTITY_PER_ITEM) }
                  : l,
              ),
            };
          }
          if (state.lines.length >= MAX_CART_LINES) return state;
          return {
            lines: [
              ...state.lines,
              { menuItemId: item.id, name: item.name, unitPrice: item.price, quantity: 1 },
            ],
          };
        }),

      setQuantity: (menuItemId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.menuItemId !== menuItemId)
              : state.lines.map((l) =>
                  l.menuItemId === menuItemId
                    ? { ...l, quantity: Math.min(Math.floor(quantity), MAX_QUANTITY_PER_ITEM) }
                    : l,
                ),
        })),

      remove: (menuItemId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.menuItemId !== menuItemId) })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: 'foodflow-cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

// ---------- Derived values (pure functions, easy to test) ----------

export function itemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function lineTotalCents(line: CartLine): number {
  return toCents(line.unitPrice) * line.quantity;
}

export function subtotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotalCents(l), 0);
}