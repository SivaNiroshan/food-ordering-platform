import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import type { StaffActionInput } from './kitchen-api';

type RejectReason = Extract<StaffActionInput, { action: 'reject' }>['reasonCode'];

const REASONS: { code: RejectReason; label: string }[] = [
  { code: 'ITEM_UNAVAILABLE', label: 'An item is unavailable' },
  { code: 'KITCHEN_BUSY', label: 'The kitchen is too busy' },
  { code: 'RESTAURANT_CLOSING', label: 'The restaurant is closing' },
  { code: 'OTHER', label: 'Other reason' },
];

interface RejectFormProps {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (reasonCode: RejectReason, note: string | undefined) => void;
}

/** Inline form on a ticket. The customer sees the reason and note on their order page. */
export function RejectForm({ submitting, onCancel, onSubmit }: RejectFormProps) {
  const id = useId();
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason) return setError('Choose a reason.');
    if (reason === 'OTHER' && !note.trim()) return setError('Add a note explaining the reason.');
    setError(null);
    onSubmit(reason, note.trim() || undefined);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-4 rounded-lg bg-chili-50 p-4">
      <fieldset>
        <legend className="font-medium text-chili-600">Why are you rejecting this order?</legend>
        <div className="mt-2 flex flex-col gap-1">
          {REASONS.map((r) => (
            <label key={r.code} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${id}-reason`}
                value={r.code}
                checked={reason === r.code}
                onChange={() => setReason(r.code)}
                className="size-4 accent-chili-600"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={`${id}-note`} className="mt-3 block text-sm font-medium">
        Note for the customer {reason === 'OTHER' ? '(required)' : '(optional)'}
      </label>
      <textarea
        id={`${id}-note`}
        rows={2}
        maxLength={300}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-leaf-600 focus:ring-2 focus:ring-leaf-100"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-chili-600">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting} className="h-10 px-3">
          Back
        </Button>
        <Button
          type="submit"
          variant="danger"
          loading={submitting}
          className="h-10 flex-1 px-3 whitespace-nowrap"
        >
          Reject order
        </Button>
      </div>
    </form>
  );
}
