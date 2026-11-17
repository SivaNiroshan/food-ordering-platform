import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import { formatCents } from '../../lib/money';
import { useAuthStore } from '../auth/auth-store';
import { CartPanel } from '../cart/CartPanel';
import { itemCount, subtotalCents, useCartStore } from '../cart/cart-store';
import { groupByCategory, useCategories, useMenuItems } from './menu-api';
import { MenuItemRow } from './MenuItemRow';

const SEARCH_DEBOUNCE_MS = 300;

export function MenuPage() {
  // Filters live in the URL (?q=kottu&category=…), so a filtered menu can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const categoryId = params.get('category') ?? undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const user = useAuthStore((s) => s.user);
  const canOrder = !user || user.role === 'CUSTOMER';

  const categories = useCategories();
  const menu = useMenuItems({ search, categoryId, page });
  const lines = useCartStore((s) => s.lines);
  const count = itemCount(lines);

  const [searchInput, setSearchInput] = useState(search);
  const debounceTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(debounceTimer.current), []);

  function updateParams(changes: Record<string, string | undefined>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        // Any filter change starts again from page 1.
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(
      () => updateParams({ q: value.trim() || undefined }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  function clearSearch() {
    window.clearTimeout(debounceTimer.current);
    setSearchInput('');
    updateParams({ q: undefined });
  }

  const groups = groupByCategory(menu.data?.data ?? []);
  const meta = menu.data?.meta;
  const showMobileCartBar = canOrder && count > 0;

  return (
    <div className={cn(showMobileCartBar && 'pb-24 lg:pb-0')}>
      <header className="max-w-2xl">
        <h1 className="text-4xl font-extrabold">Menu</h1>
        <p className="mt-2 text-ash">
          Order ahead and collect from the counter. You pay when you pick up.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-4">
        <div className="max-w-md">
          <label htmlFor="menu-search" className="sr-only">
            Search the menu
          </label>
          <input
            id="menu-search"
            type="search"
            placeholder="Search dishes, e.g. kottu"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-white px-3 outline-none transition-colors placeholder:text-ash/70 focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by category"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          <CategoryChip active={!categoryId} onClick={() => updateParams({ category: undefined })}>
            All
          </CategoryChip>
          {categories.data?.map((category) => (
            <CategoryChip
              key={category.id}
              active={categoryId === category.id}
              onClick={() => updateParams({ category: category.id })}
            >
              {category.name}
            </CategoryChip>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Menu items" aria-busy={menu.isFetching || undefined}>
          {search && meta && meta.totalItems > 0 && (
            <p aria-live="polite" className="text-sm text-ash">
              {meta.totalItems === 1 ? '1 dish matches' : `${meta.totalItems} dishes match`} “
              {search}”
            </p>
          )}

          {menu.isPending ? (
            <MenuSkeleton />
          ) : menu.isError ? (
            <Alert className="mt-4">
              <p>
                {menu.error instanceof ApiError
                  ? menu.error.message
                  : 'The menu couldn’t be loaded.'}
              </p>
              <button
                type="button"
                className="mt-2 font-medium underline underline-offset-4"
                onClick={() => void menu.refetch()}
              >
                Try again
              </button>
            </Alert>
          ) : groups.length === 0 ? (
            <div className="py-12">
              <p className="font-display text-xl font-semibold">
                {search
                  ? `No dishes match “${search}”.`
                  : 'There are no dishes in this category yet.'}
              </p>
              <p className="mt-1 text-ash">Try another word, or browse all categories.</p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  clearSearch();
                  updateParams({ q: undefined, category: undefined });
                }}
              >
                Show the full menu
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {groups.map((group) => (
                <section key={group.id} aria-labelledby={`category-${group.id}`}>
                  <h2
                    id={`category-${group.id}`}
                    className="border-b-2 border-leaf-700 pb-2 text-2xl font-bold text-leaf-700"
                  >
                    {group.name}
                  </h2>
                  <ul className="divide-y divide-line">
                    {group.items.map((item) => (
                      <MenuItemRow key={item.id} item={item} canOrder={canOrder} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <nav aria-label="Menu pages" className="mt-8 flex items-center gap-3">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <span className="text-sm text-ash">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= meta.totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
              </Button>
            </nav>
          )}
        </section>

        {canOrder && (
          <aside className="hidden lg:block">
            <CartPanel className="sticky top-24" />
          </aside>
        )}
      </div>

      {showMobileCartBar && (
        <Link
          to="/cart"
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-xl bg-leaf-700 px-5 py-4 text-white shadow-lg lg:hidden"
        >
          <span className="font-medium">
            View order ({count} {count === 1 ? 'item' : 'items'})
          </span>
          <span className="font-display text-lg font-bold tabular-nums">
            {formatCents(subtotalCents(lines))}
          </span>
        </Link>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-9 shrink-0 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
        active
          ? 'border-leaf-700 bg-leaf-700 text-white'
          : 'border-line bg-white text-ink hover:border-leaf-600',
      )}
    >
      {children}
    </button>
  );
}

function MenuSkeleton() {
  return (
    <div aria-hidden="true" className="mt-2 flex flex-col gap-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-5 w-1/3 rounded bg-line" />
          <div className="mt-2 h-4 w-2/3 rounded bg-line/70" />
        </div>
      ))}
    </div>
  );
}