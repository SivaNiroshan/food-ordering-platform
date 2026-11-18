import type { Order } from '../features/orders/order-types';
import type { User } from '../lib/types';

export const customerUser: User = {
  id: 'customer-1',
  name: 'Demo Customer',
  email: 'customer@foodflow.local',
  role: 'CUSTOMER',
  isActive: true,
  createdAt: '2026-11-01T00:00:00Z',
};

export const staffUser: User = {
  id: 'staff-1',
  name: 'Kitchen Staff',
  email: 'staff@foodflow.local',
  role: 'STAFF',
  isActive: true,
  createdAt: '2026-11-01T00:00:00Z',
};

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: '0195f0b4-0000-7000-8000-00000000a1b2',
    status: 'PENDING',
    paymentMethod: 'PAY_ON_COLLECTION',
    paymentStatus: 'UNPAID',
    subtotal: '2850.00',
    notes: null,
    acceptanceDeadline: '2026-11-17T09:15:00Z',
    statusReason: null,
    items: [
      {
        menuItemId: 'kottu',
        itemName: 'Chicken Kottu',
        unitPrice: '1200.00',
        quantity: 2,
        lineTotal: '2400.00',
      },
      {
        menuItemId: 'milo',
        itemName: 'Iced Milo',
        unitPrice: '450.00',
        quantity: 1,
        lineTotal: '450.00',
      },
    ],
    createdAt: '2026-11-17T09:00:00Z',
    updatedAt: '2026-11-17T09:00:00Z',
    history: [
      {
        previousStatus: null,
        newStatus: 'PENDING',
        changeSource: 'CUSTOMER',
        reasonCode: null,
        reasonNote: null,
        changedAt: '2026-11-17T09:00:00Z',
      },
    ],
    ...overrides,
  };
}
