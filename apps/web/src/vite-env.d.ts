/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API URL. Defaults to "/api/v1" (same origin, via the Vite proxy). */
  readonly VITE_API_URL?: string;
}
