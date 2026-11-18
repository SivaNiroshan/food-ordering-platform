import { useSearchParams } from 'react-router';
import { cn } from '../../lib/cn';
import { CategoriesPanel } from './CategoriesPanel';
import { DishesPanel } from './DishesPanel';

export function ManageMenuPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'categories' ? 'categories' : 'dishes';

  return (
    <div>
      <h1 className="text-4xl font-extrabold">Manage the menu</h1>
      <p className="mt-2 text-ash">
        Changes appear on the customer menu straight away. Removed dishes stay in past orders.
      </p>

      <div className="mt-6 inline-flex rounded-lg border border-line bg-white p-1" role="group">
        {(['dishes', 'categories'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setParams(t === 'dishes' ? {} : { tab: t })}
            className={cn(
              'h-9 rounded-md px-4 text-sm font-medium transition-colors',
              tab === t ? 'bg-leaf-700 text-white' : 'text-ash hover:text-ink',
            )}
          >
            {t === 'dishes' ? 'Dishes' : 'Categories'}
          </button>
        ))}
      </div>

      {tab === 'dishes' ? <DishesPanel /> : <CategoriesPanel />}
    </div>
  );
}
