import { beforeEach, describe, expect, it } from 'vitest';
import { itemCount, MAX_QUANTITY_PER_ITEM, subtotalCents, useCartStore } from './cart-store';

const kottu = { id: 'kottu', name: 'Chicken Kottu', price: '1200.00' };
const milo = { id: 'milo', name: 'Iced Milo', price: '450.00' };

const cart = () => useCartStore.getState();

beforeEach(() => {
  localStorage.clear();
  cart().clear();
});

describe('cart store', () => {
  it('adds an item, and adding it again increases the quantity', () => {
    cart().add(kottu);
    cart().add(kottu);
    cart().add(milo);

    expect(cart().lines).toEqual([
      { menuItemId: 'kottu', name: 'Chicken Kottu', unitPrice: '1200.00', quantity: 2 },
      { menuItemId: 'milo', name: 'Iced Milo', unitPrice: '450.00', quantity: 1 },
    ]);
  });

  it('caps the quantity at the API limit', () => {
    cart().add(kottu);
    cart().setQuantity('kottu', 99);

    expect(cart().lines[0]?.quantity).toBe(MAX_QUANTITY_PER_ITEM);
  });

  it('removes a line when its quantity reaches zero', () => {
    cart().add(kottu);
    cart().setQuantity('kottu', 0);

    expect(cart().lines).toEqual([]);
  });

  it('calculates the item count and subtotal in cents', () => {
    cart().add(kottu);
    cart().add(kottu);
    cart().add(milo);

    expect(itemCount(cart().lines)).toBe(3);
    expect(subtotalCents(cart().lines)).toBe(285000);
  });

  it('saves the cart to localStorage so it survives a reload', () => {
    cart().add(kottu);

    const saved = JSON.parse(localStorage.getItem('foodflow-cart') ?? '{}');
    expect(saved.state.lines).toHaveLength(1);
  });
});