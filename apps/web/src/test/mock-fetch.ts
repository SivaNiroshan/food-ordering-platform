import { vi } from 'vitest';

type Handler = (url: URL, init: RequestInit) => { status?: number; body?: unknown } | undefined;

/**
 * Replaces fetch with a small fake API. The first handler that returns a response wins;
 * any request no handler answers fails the test loudly.
 */
export function mockFetch(...handlers: Handler[]) {
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost');
    for (const handler of handlers) {
      const result = handler(url, init);
      if (result) {
        return new Response(result.body === undefined ? null : JSON.stringify(result.body), {
          status: result.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    throw new Error(`Unhandled request: ${init.method ?? 'GET'} ${url.pathname}${url.search}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}