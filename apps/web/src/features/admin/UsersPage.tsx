import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/toast-store';
import { ApiError } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import type { User, UserRole } from '../../lib/types';
import { useAuthStore } from '../auth/auth-store';
import { AddStaffForm } from './AddStaffForm';
import { useAdminUsers, useChangeRole, useChangeStatus } from './admin-users-api';

const ROLE_LABEL: Record<UserRole, string> = {
  CUSTOMER: 'Customer',
  STAFF: 'Kitchen staff',
  ADMIN: 'Administrator',
};

const joinedFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function describeError(err: unknown) {
  if (err instanceof ApiError && err.code === 'CANNOT_MODIFY_SELF') {
    return 'You can’t change your own role or status.';
  }
  return err instanceof Error ? err.message : 'The change couldn’t be saved.';
}

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const role = (params.get('role') as UserRole | null) ?? undefined;
  const statusParam = params.get('status');
  const status =
    statusParam === 'active' || statusParam === 'deactivated' ? statusParam : undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [adding, setAdding] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const debounce = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const users = useAdminUsers({ search, role, status, page });
  const meta = users.data?.meta;

  function update(changes: Record<string, string | undefined>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  function handleSearch(value: string) {
    setSearchInput(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => update({ q: value.trim() || undefined }), 300);
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold">Users</h1>
          <p className="mt-2 text-ash">
            Create staff accounts, change roles and deactivate accounts. Changes apply on the
            person’s next request.
          </p>
        </div>
        {!adding && <Button onClick={() => setAdding(true)}>Add a staff account</Button>}
      </header>

      {adding && (
        <div className="mt-6">
          <AddStaffForm onDone={() => setAdding(false)} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex w-full max-w-sm flex-col gap-1.5">
          <label htmlFor="user-search" className="text-sm font-medium">
            Search
          </label>
          <input
            id="user-search"
            type="search"
            placeholder="Name or email"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-11 rounded-lg border border-line bg-white px-3 outline-none focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100"
          />
        </div>
        <SelectField
          label="Role"
          value={role ?? ''}
          onChange={(e) => update({ role: e.target.value || undefined })}
        >
          <option value="">All roles</option>
          <option value="CUSTOMER">Customers</option>
          <option value="STAFF">Kitchen staff</option>
          <option value="ADMIN">Administrators</option>
        </SelectField>
        <SelectField
          label="Status"
          value={status ?? ''}
          onChange={(e) => update({ status: e.target.value || undefined })}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </SelectField>
      </div>

      {users.isPending ? (
        <div className="mt-8 text-leaf-700">
          <Spinner label="Loading users" />
        </div>
      ) : users.isError ? (
        <Alert className="mt-6">{users.error.message}</Alert>
      ) : users.data.data.length === 0 ? (
        <p className="mt-8 text-ash">No users match these filters.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
          {users.data.data.map((user) => (
            <li key={user.id}>
              <UserRow user={user} />
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <nav aria-label="User pages" className="mt-6 flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => update({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <span className="text-sm text-ash">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= meta.totalPages}
            onClick={() => update({ page: String(page + 1) })}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

function UserRow({ user }: { user: User }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isMe = user.id === currentUserId;
  const changeRole = useChangeRole();
  const changeStatus = useChangeStatus();

  function handleRole(role: UserRole) {
    changeRole.mutate(
      { id: user.id, role },
      {
        onSuccess: () => toast(`${user.name} is now ${ROLE_LABEL[role].toLowerCase()}`),
        onError: (err) => toast(describeError(err), 'attention'),
      },
    );
  }

  function handleStatus() {
    const isActive = !user.isActive;
    changeStatus.mutate(
      { id: user.id, isActive },
      {
        onSuccess: () =>
          toast(
            isActive
              ? `${user.name} can log in again`
              : `${user.name} is deactivated and logged out everywhere`,
          ),
        onError: (err) => toast(describeError(err), 'attention'),
      },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
        <p className="font-medium">
          {user.name}
          {isMe && (
            <span className="ml-2 rounded-md bg-leaf-50 px-2 py-0.5 text-xs font-medium text-leaf-700">
              You
            </span>
          )}
        </p>
        <p className="truncate text-sm text-ash">{user.email}</p>
        <p className="text-xs text-ash">Joined {joinedFormat.format(new Date(user.createdAt))}</p>
      </div>

      <select
        aria-label={`Role for ${user.name}`}
        value={user.role}
        disabled={isMe || changeRole.isPending}
        onChange={(e) => handleRole(e.target.value as UserRole)}
        className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100 disabled:opacity-60"
      >
        {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>

      <span
        className={cn(
          'w-24 text-sm font-medium',
          user.isActive ? 'text-leaf-700' : 'text-chili-600',
        )}
      >
        {user.isActive ? 'Active' : 'Deactivated'}
      </span>

      <Button
        variant={user.isActive ? 'secondary' : 'primary'}
        className="h-10 w-32"
        disabled={isMe}
        loading={changeStatus.isPending}
        onClick={handleStatus}
        aria-label={`${user.isActive ? 'Deactivate' : 'Reactivate'} ${user.name}`}
      >
        {user.isActive ? 'Deactivate' : 'Reactivate'}
      </Button>
    </div>
  );
}
