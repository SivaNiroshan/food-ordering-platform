import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Switch } from '../../components/ui/Switch';
import { TextField } from '../../components/ui/TextField';
import { toast } from '../../components/ui/toast-store';
import { ApiError } from '../../lib/api-client';
import {
  useCreateCategory,
  useStaffCategories,
  useUpdateCategory,
  type StaffCategory,
} from './manage-menu-api';

const DUPLICATE_NAME = 'A category with this name already exists.';

function nameError(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Enter at least 2 characters';
  if (trimmed.length > 100) return 'Use 100 characters or fewer';
  return undefined;
}

export function CategoriesPanel() {
  const categories = useStaffCategories();

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <AddCategoryForm />
      <section aria-labelledby="category-list-heading">
        <h2 id="category-list-heading" className="text-xl font-bold">
          Categories
        </h2>
        {categories.isPending ? (
          <div className="mt-6 text-leaf-700">
            <Spinner label="Loading categories" />
          </div>
        ) : categories.isError ? (
          <Alert className="mt-4">{categories.error.message}</Alert>
        ) : categories.data.length === 0 ? (
          <p className="mt-4 text-ash">No categories yet. Add the first one.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
            {categories.data.map((category) => (
              <li key={category.id}>
                <CategoryRow category={category} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddCategoryForm() {
  const create = useCreateCategory();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = nameError(name);
    if (problem) return setError(problem);
    setError(undefined);
    try {
      await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
      toast(`Added the ${name.trim()} category`, 'success');
      setName('');
      setDescription('');
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'CATEGORY_ALREADY_EXISTS'
          ? DUPLICATE_NAME
          : err instanceof Error
            ? err.message
            : 'The category couldn’t be added.',
      );
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby="add-category-heading"
      className="h-fit rounded-xl border border-line bg-white p-5"
    >
      <h2 id="add-category-heading" className="text-xl font-bold">
        Add a category
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
        <Button type="submit" loading={create.isPending}>
          Add category
        </Button>
      </div>
    </form>
  );
}

function CategoryRow({ category }: { category: StaffCategory }) {
  const update = useUpdateCategory();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? '');
  const [error, setError] = useState<string | undefined>();

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const problem = nameError(name);
    if (problem) return setError(problem);
    try {
      await update.mutateAsync({
        id: category.id,
        changes: { name: name.trim(), description: description.trim() || null },
      });
      setError(undefined);
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'CATEGORY_ALREADY_EXISTS'
          ? DUPLICATE_NAME
          : err instanceof Error
            ? err.message
            : 'The category couldn’t be saved.',
      );
    }
  }

  function toggleShown(isActive: boolean) {
    update.mutate(
      { id: category.id, changes: { isActive } },
      {
        onSuccess: () =>
          toast(
            isActive
              ? `${category.name} is back on the menu`
              : `${category.name} and its dishes are hidden from customers`,
          ),
        onError: (err) => toast(err.message, 'attention'),
      },
    );
  }

  if (editing) {
    return (
      <form noValidate onSubmit={handleSave} className="flex flex-col gap-3 p-4">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
        <div className="flex gap-2">
          <Button type="submit" loading={update.isPending} className="h-10">
            Save
          </Button>
          <Button
            variant="secondary"
            className="h-10"
            onClick={() => {
              setEditing(false);
              setName(category.name);
              setDescription(category.description ?? '');
              setError(undefined);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
        <p className="font-medium">{category.name}</p>
        {category.description && <p className="text-sm text-ash">{category.description}</p>}
      </div>
      <Switch
        label={`Show ${category.name} on the menu`}
        checked={category.isActive}
        disabled={update.isPending}
        onChange={toggleShown}
      >
        {category.isActive ? 'Shown' : 'Hidden'}
      </Switch>
      <Button
        variant="secondary"
        className="h-10"
        onClick={() => setEditing(true)}
        aria-label={`Rename ${category.name}`}
      >
        Rename
      </Button>
    </div>
  );
}
