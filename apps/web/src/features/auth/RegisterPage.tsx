import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api-client';
import { register } from './auth-api';
import { registerSchema, toFieldErrors } from './auth-schemas';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      await register(parsed.data);
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_ALREADY_EXISTS') {
        setFieldErrors({ email: 'An account with this email already exists.' });
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        setFieldErrors(err.fieldErrors());
      } else {
        setFormError(err instanceof Error ? err.message : 'Something went wrong.');
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create an account" intro="You’ll need an account to place and track orders.">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        {formError && <Alert>{formError}</Alert>}

        <TextField
          label="Name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => update('name', e.target.value)}
          error={fieldErrors.name}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          value={values.password}
          onChange={(e) => update('password', e.target.value)}
          error={fieldErrors.password}
        />

        <Button type="submit" loading={submitting} className="mt-2">
          Create account
        </Button>

        <p className="text-sm text-ash">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-leaf-700 underline underline-offset-4">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
