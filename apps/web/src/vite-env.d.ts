/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API URL. Defaults to "/api/v1" (same origin, via the Vite proxy). */
  readonly VITE_API_URL?: string;
  /** Minimum order amount shown in the cart. Defaults to "500.00" (same as the API). */
  readonly VITE_MINIMUM_ORDER_AMOUNT?: string;
}