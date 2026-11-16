import type { ReactNode } from 'react';
import { Wordmark } from '../../components/layout/Wordmark';

export function AuthLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-leaf-700 p-10 text-white md:flex">
        <Wordmark inverted />
        <div className="max-w-sm">
          <p className="font-display text-5xl leading-[1.05] font-extrabold tracking-tight">
            Order ahead. Pick it up hot.
          </p>
          <p className="mt-4 text-leaf-100">
            Choose from the menu, pay when you collect, and watch your order move from the kitchen
            to the counter.
          </p>
        </div>
        <div aria-hidden="true" className="h-1.5 w-24 rounded-full bg-turmeric-500" />
      </aside>

      <section className="flex flex-col px-5 py-8 sm:px-10">
        <Wordmark className="md:hidden" />
        <div className="m-auto w-full max-w-sm py-10">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-ash">{intro}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}
