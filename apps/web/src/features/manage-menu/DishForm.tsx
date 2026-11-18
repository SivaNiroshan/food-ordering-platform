import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { toast } from '../../components/ui/toast-store';
import { ApiError } from '../../lib/api-client';
import { toFieldErrors } from '../auth/auth-schemas';
import {
  useCreateDish,
  useUpdateDish,
  type StaffCategory,
  type StaffMenuItem,
} from './manage-menu-api';

// Same rules as the API's createMenuItemSchema.
const dishSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(100),
  categoryId: z.string().min(1, 'Choose a category'),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Enter a price like 1200 or 1200.50'),
  description: z.string().trim().max(500, 'Use 500 characters or fewer'),
  imageUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^https:\/\/\S+$/.test(v),
      'Use a full https:// link, or leave it empty',
    ),
  isAvailable: z.boolean(),
  isActive: z.boolean(),
});

type DishValues = z.input<typeof dishSchema>;

interface DishFormProps {
  /** The dish to edit, or undefined to add a new one. */
  dish?: StaffMenuItem;
  categories: StaffCategory[];
  onDone: () => void;
}

export function DishForm({ dish, categories, onDone }: DishFormProps) {
  const create = useCreateDish();
  const update = useUpdateDish();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [values, setValues] = useState<DishValues>({
    name: dish?.name ?? '',
    categoryId: dish?.category.id ?? '',
    price: dish?.price ?? '',
    description: dish?.description ?? '',
    imageUrl: dish?.imageUrl ?? '',
    isAvailable: dish?.isAvailable ?? true,
    isActive: dish?.isActive ?? true,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Move focus to the form when it opens, so keyboard and screen-reader users land in it.
  useEffect(() => headingRef.current?.focus(), []);

  function set<K extends keyof DishValues>(key: K, value: DishValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = dishSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    const v = parsed.data;

    try {
      if (dish) {
        await update.mutateAsync({
          id: dish.id,
          changes: {
            name: v.name,
            categoryId: v.categoryId,
            price: v.price,
            description: v.description || null, // null clears it
            imageUrl: v.imageUrl || null,
            isAvailable: v.isAvailable,
            isActive: v.isActive,
          },
        });
        toast(`Saved changes to ${v.name}`, 'success');
      } else {
        await create.mutateAsync({
          name: v.name,
          categoryId: v.categoryId,
          price: v.price,
          description: v.description || undefined,
          imageUrl: v.imageUrl || undefined,
          isAvailable: v.isAvailable,
        });
        toast(`Added ${v.name} to the menu`, 'success');
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CATEGORY_NOT_FOUND') {
        setFieldErrors({ categoryId: 'This category is hidden or was removed. Choose another.' });
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        setFieldErrors(err.fieldErrors());
      } else {
        setFormError(err instanceof Error ? err.message : 'The dish couldn’t be saved.');
      }
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby="dish-form-heading"
      className="rounded-xl border border-leaf-600 bg-white p-5"
    >
      <h2
        id="dish-form-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold outline-none"
      >
        {dish ? `Edit ${dish.name}` : 'Add a dish'}
      </h2>

      {formError && <Alert className="mt-4">{formError}</Alert>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          error={fieldErrors.name}
        />
        <SelectField
          label="Category"
          value={values.categoryId}
          onChange={(e) => set('categoryId', e.target.value)}
          error={fieldErrors.categoryId}
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isActive ? '' : ' (hidden)'}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Price (LKR)"
          inputMode="decimal"
          placeholder="1200.00"
          value={values.price}
          onChange={(e) => set('price', e.target.value)}
          error={fieldErrors.price}
        />
        <TextField
          label="Image link (optional)"
          type="url"
          placeholder="https://…"
          value={values.imageUrl}
          onChange={(e) => set('imageUrl', e.target.value)}
          error={fieldErrors.imageUrl}
        />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="dish-description" className="text-sm font-medium">
          Description (optional)
        </label>
        <textarea
          id="dish-description"
          rows={2}
          maxLength={500}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100"
        />
        {fieldErrors.description && (
          <p className="text-sm text-chili-600">{fieldErrors.description}</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isAvailable}
            onChange={(e) => set('isAvailable', e.target.checked)}
            className="size-4 accent-leaf-700"
          />
          Available today
        </label>
        {dish && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="size-4 accent-leaf-700"
            />
            Show on the menu (untick to remove it; past orders keep it)
          </label>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Button type="submit" loading={saving}>
          {dish ? 'Save changes' : 'Add dish'}
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
