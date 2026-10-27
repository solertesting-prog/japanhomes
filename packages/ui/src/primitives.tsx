import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

/* Badge ------------------------------------------------------------------ */

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5',
  {
    variants: {
      tone: {
        neutral: 'bg-washi text-ink-2',
        open: 'bg-shu-tint text-shu-deep',
        soon: 'bg-ai-tint text-ai',
        funded: 'bg-matcha-tint text-matcha',
        closed: 'bg-washi text-ink-3',
        demo: 'border border-dashed border-line-strong bg-paper text-ink-2',
        warning: 'bg-kincha-tint text-kincha',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* Progress --------------------------------------------------------------- */

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–10000 basis points. */
  valueBps: number;
  label: string;
}

export function Progress({ valueBps, label, className, ...props }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, valueBps / 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-washi-deep', className)}
      {...props}
    >
      <div className="h-full rounded-full bg-shu" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* Skeleton --------------------------------------------------------------- */

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-washi-deep', className)} {...props} />;
}

/* Form fields ------------------------------------------------------------ */

const fieldBase =
  'w-full rounded-lg border border-line-strong bg-paper px-3 text-[0.9375rem] text-ink placeholder:text-ink-3 transition-colors focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-shu/30 disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        'select-chevron h-11 appearance-none pr-9',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-line-strong bg-paper transition-colors checked:border-ink checked:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shu/40',
        'checkbox-mark',
        className,
      )}
      {...props}
    />
  );
}
