import { cn } from '../../lib/cn';

interface QuantityStepperProps {
  /** What is being counted, for screen readers, e.g. "Chicken Kottu". */
  label: string;
  quantity: number;
  max: number;
  onChange: (quantity: number) => void;
  className?: string;
}

const stepButton =
  'grid size-10 place-items-center text-lg text-leaf-700 transition-colors hover:bg-leaf-50 disabled:cursor-not-allowed disabled:text-ash/40 disabled:hover:bg-transparent';

export function QuantityStepper({
  label,
  quantity,
  max,
  onChange,
  className,
}: QuantityStepperProps) {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center overflow-hidden rounded-lg border border-leaf-600 bg-white',
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${label} quantity`}
        className={stepButton}
        onClick={() => onChange(quantity - 1)}
      >
        −
      </button>
      <span aria-live="polite" className="w-8 text-center font-medium tabular-nums">
        <span className="sr-only">{label} quantity </span>
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label} quantity`}
        className={stepButton}
        disabled={quantity >= max}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </button>
    </div>
  );
}
