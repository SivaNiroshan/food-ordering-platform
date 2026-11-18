import { toCents } from './money';

/**
 * Must match MINIMUM_ORDER_AMOUNT in the API's .env. The API is still the one that
 * enforces it; the web app only uses it to tell customers early.
 */
export const MINIMUM_ORDER_CENTS = toCents(import.meta.env.VITE_MINIMUM_ORDER_AMOUNT ?? '500.00');
