import { cn } from '../../lib/cn';

interface SwitchProps {
  /** Accessible name, e.g. "Chicken Kottu available today" */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Visible text next to the switch */
  children?: string;
}

/** An on/off control that saves immediately (no form submit). */
export function Switch({ label, checked, onChange, disabled, children }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-leaf-700' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </span>
      {children && <span className={checked ? 'text-ink' : 'text-ash'}>{children}</span>}
    </button>
  );
}
