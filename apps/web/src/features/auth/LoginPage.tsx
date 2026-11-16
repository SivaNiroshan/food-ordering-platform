import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api-client';
import { login } from './auth-api';
import { loginSchema, toFieldErrors } from './auth-schemas';
import { HOME_BY_ROLE } from './roles';
import { AuthLayout } from './AuthLayout';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'That email and password don’t match an account.',
  ACCOUNT_DEACTIVATED: 'This account has been deactivated. Contact the restaurant for help.',
  RATE_LIMITED: 'Too many attempts. Wait a minute, then try again.',
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string; registered?: boolean } | null)?.from;
  const justRegistered = (location.state as { registered?: boolean } | null)?.registered;

  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const user = await login(parsed.data);
      navigate(from ?? HOME_BY_ROLE[user.role], { replace: true });
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? (ERROR_MESSAGES[err.code] ?? err.message)
          : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Log in" intro="Welcome back. Log in to order and track your food.">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        {justRegistered && <Alert tone="info">Your account is ready. Log in to continue.</Alert>}
        {formError && <Alert>{formError}</Alert>}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={fieldErrors.password}
        />

        <Button type="submit" loading={submitting} className="mt-2">
          Log in
        </Button>

        <p className="text-sm text-ash">
          New here?{' '}
          <Link to="/register" className="font-medium text-leaf-700 underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
