import { useEffect, useRef, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Switch } from '../../components/ui/Switch';
import { toast } from '../../components/ui/toast-store';
import { cn } from '../../lib/cn';
import { formatPrice } from '../../lib/money';
import { DishForm } from './DishForm';
import {
  useStaffCategories,
  useStaffDishes,
  useUpdateDish,
  type DishFilters,
  type StaffMenuItem,
} from './manage-menu-api';

const SHOW_OPTIONS: { value: DishFilters['show']; label: string }[] = [
  { value: 'all', label: 'All dishes' },
  { value: 'active', label: 'On the menu' },
  { value: 'removed', label: 'Removed' },
];

export function DishesPanel() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<DishFilters['show']>('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<StaffMenuItem | 'new' | null>(null);
  const debounce = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const categories = useStaffCategories();
  const dishes = useStaffDishes({ search, show, page });
  const update = useUpdateDish();

  function handleSearch(value: string) {
    setSearchInput(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 300);
  }

  function toggleAvailable(dish: StaffMenuItem, isAvailable: boolean) {
    update.mutate(
      { id: dish.id, changes: { isAvailable } },
      {
        onSuccess: () =>
          toast(`${dish.name} is ${isAvailable ? 'available again' : 'marked sold out'}`),
        onError: (err) => toast(err.message, 'attention'),
      },
    );
  }

  const meta = dishes.data?.meta;

  return (
    <div className="mt-6">
      {editing ? (
        <DishForm
          key={editing === 'new' ? 'new' : editing.id}
          dish={editing === 'new' ? undefined : editing}
          categories={categories.data ?? []}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button onClick={() => setEditing('new')} disabled={!categories.data?.length}>
          Add a dish
        </Button>
      )}
      {categories.data?.length === 0 && (
        <p className="mt-2 text-sm text-ash">Create a category first, then add dishes to it.</p>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <label htmlFor="dish-search" className="sr-only">
            Search dishes
          </label>
          <input
            id="dish-search"
            type="search"
            placeholder="Search dishes"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-white px-3 outline-none focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100"
          />
        </div>
        <div role="group" aria-label="Show" className="flex gap-2">
          {SHOW_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={show === o.value}
              onClick={() => {
                setShow(o.value);
                setPage(1);
              }}
              className={cn(
                'h-9 rounded-full border px-4 text-sm font-medium whitespace-nowrap',
                show === o.value
                  ? 'border-leaf-700 bg-leaf-700 text-white'
                  : 'border-line bg-white hover:border-leaf-600',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {dishes.isPending ? (
        <div className="mt-8 text-leaf-700">
          <Spinner label="Loading dishes" />
        </div>
      ) : dishes.isError ? (
        <Alert className="mt-6">{dishes.error.message}</Alert>
      ) : dishes.data.data.length === 0 ? (
        <p className="mt-8 text-ash">
          {search ? `No dishes match “${search}”.` : 'No dishes yet.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
          {dishes.data.data.map((dish) => (
            <li key={dish.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <p className="font-medium">
                  {dish.name}
                  {!dish.isActive && (
                    <span className="ml-2 rounded-md bg-line px-2 py-0.5 text-xs font-medium text-ash">
                      Removed from menu
                    </span>
                  )}
                </p>
                <p className="text-sm text-ash">{dish.category.name}</p>
              </div>
              <span className="font-medium tabular-nums sm:w-28 sm:text-right">
                {formatPrice(dish.price)}
              </span>
              <div className="w-32">
                <Switch
                  label={`${dish.name} available today`}
                  checked={dish.isAvailable}
                  disabled={update.isPending && update.variables?.id === dish.id}
                  onChange={(value) => toggleAvailable(dish, value)}
                >
                  {dish.isAvailable ? 'Available' : 'Sold out'}
                </Switch>
              </div>
              <Button
                variant="secondary"
                className="h-10"
                onClick={() => setEditing(dish)}
                aria-label={`Edit ${dish.name}`}
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <nav aria-label="Dish pages" className="mt-6 flex items-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-ash">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= meta.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
