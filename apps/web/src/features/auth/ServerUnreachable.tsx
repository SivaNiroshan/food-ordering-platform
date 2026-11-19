import { useEffect } from 'react';
import { Wordmark } from '../../components/layout/Wordmark';
import { Button } from '../../components/ui/Button';
import { restoreSession } from './auth-api';

const RETRY_EVERY_MS = 10_000;

/**
 * Shown when the app can't reach the server to check the session. The user is not
 * logged out: their refresh cookie is still valid, so we try again until the server is back.
 *
 * `standalone` is for pages outside the app shell (login, register, "/"), which have no header.
 */
export function ServerUnreachable({ standalone = false }: { standalone?: boolean }) {
  useEffect(() => {
    const timer = window.setInterval(() => void restoreSession(), RETRY_EVERY_MS);
    return () => window.clearInterval(timer);
  }, []);

  const message = (
    <div role="alert" className="mx-auto max-w-md py-16">
      <h1 className="text-3xl font-bold">Can’t reach FoodFlow right now</h1>
      <p className="mt-3 text-ash">
        The server isn’t responding. You haven’t been logged out, and this page will reconnect by
        itself when it’s back.
      </p>
      <Button className="mt-6" onClick={() => void restoreSession()}>
        Try again now
      </Button>
    </div>
  );

  if (!standalone) return message;

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-10">
      <Wordmark />
      <div className="my-auto">{message}</div>
    </div>
  );
}
