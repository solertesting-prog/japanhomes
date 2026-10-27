import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from './cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shu focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-45 select-none',
  {
    variants: {
      variant: {
        /** Primary action on light surfaces: sumi ink. */
        ink: 'bg-ink text-paper hover:bg-ink-2',
        /** The one red action per view (invest). */
        shu: 'bg-shu text-white hover:bg-shu-deep',
        outline: 'border border-line-strong bg-paper text-ink hover:border-ink',
        ghost: 'text-ink hover:bg-washi',
        link: 'text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu',
      },
      size: {
        sm: 'h-9 rounded-md px-3 text-sm',
        md: 'h-11 rounded-lg px-5 text-[0.9375rem]',
        lg: 'h-13 rounded-lg px-7 text-base',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: { variant: 'ink', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
