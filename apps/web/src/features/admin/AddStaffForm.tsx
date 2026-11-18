import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { toast } from '../../components/ui/toast-store';
import { ApiError } from '../../lib/api-client';
import { registerSchema, toFieldErrors } from '../auth/auth-schemas';
import { useCreateStaffUser } from './admin-users-api';

// Same rules as registration, plus a role. Customers sign up themselves, so it's STAFF or ADMIN.
const staffSchema = registerSchema.extend({ role: z.enum(['STAFF', 'ADMIN']) });

export function AddStaffForm({ onDone }: { onDone: () => void }) {
  const create = useCreateStaffUser();
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF' as 'STAFF' | 'ADMIN',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = staffSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    try {
      const user = await create.mutateAsync(parsed.data);
      toast(
        `Created an account for ${user.name}. Share the temporary password with them.`,
        'success',
      );
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_ALREADY_EXISTS') {
        setFieldErrors({ email: 'An account with this email already exists.' });
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        setFieldErrors(err.fieldErrors());
      } else {
        setFormError(err instanceof Error ? err.message : 'The account couldn’t be created.');
      }
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby="add-staff-heading"
      className="rounded-xl border border-leaf-600 bg-white p-5"
    >
      <h2 id="add-staff-heading" className="text-xl font-bold">
        Add a staff account
      </h2>
      {formError && <Alert className="mt-4">{formError}</Alert>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          error={fieldErrors.name}
        />
        <TextField
          label="Email"
          type="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={fieldErrors.email}
        />
        <TextField
          label="Temporary password"
          type="text"
          autoComplete="off"
          hint="At least 8 characters, with a letter and a number."
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={fieldErrors.password}
        />
        <SelectField
          label="Role"
          value={values.role}
          onChange={(e) => setValues({ ...values, role: e.target.value as 'STAFF' | 'ADMIN' })}
        >
          <option value="STAFF">Kitchen staff</option>
          <option value="ADMIN">Administrator</option>
        </SelectField>
      </div>
      <div className="mt-5 flex gap-2">
        <Button type="submit" loading={create.isPending}>
          Create account
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={create.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
