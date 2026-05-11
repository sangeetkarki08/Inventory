'use client';

import { forwardRef, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
//  Button
// ═══════════════════════════════════════════════════════════════════════════
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, size = 'md', className, children, disabled, ...rest },
  ref,
) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  } as const;

  const variants = {
    primary:   'bg-gradient-amber text-bg font-semibold shadow-soft hover:shadow-glow-amber active:scale-[0.98]',
    secondary: 'bg-surface text-text border border-border hover:bg-border/40 hover:border-border/80',
    ghost:     'text-text/80 hover:text-text hover:bg-surface',
    danger:    'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
  } as const;

  return (
    <button
      ref={ref}
      disabled={loading || disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100',
        sizes[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  Input
// ═══════════════════════════════════════════════════════════════════════════
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...rest }, ref,
) {
  const inputId = id ?? rest.name ?? undefined;
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-muted uppercase tracking-wide"
        >
          {label}{rest.required && <span className="text-accent ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm',
          'bg-bg/50 border border-border',
          'placeholder:text-muted/60',
          'transition-all duration-150',
          'hover:border-border/80',
          'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-bg',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className,
        )}
        {...rest}
      />
      {error && (
        <p className="text-xs text-danger flex items-center gap-1">
          <span className="text-[10px]">⚠</span> {error}
        </p>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  Textarea
// ═══════════════════════════════════════════════════════════════════════════
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, rows = 3, ...rest }, ref,
) {
  const inputId = id ?? rest.name ?? undefined;
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-muted uppercase tracking-wide"
        >
          {label}{rest.required && <span className="text-accent ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm resize-none',
          'bg-bg/50 border border-border',
          'placeholder:text-muted/60',
          'transition-all duration-150',
          'hover:border-border/80',
          'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-bg',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className,
        )}
        {...rest}
      />
      {error && (
        <p className="text-xs text-danger flex items-center gap-1">
          <span className="text-[10px]">⚠</span> {error}
        </p>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  Select
// ═══════════════════════════════════════════════════════════════════════════
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, className, id, ...rest }, ref,
) {
  const inputId = id ?? rest.name ?? undefined;
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-muted uppercase tracking-wide"
        >
          {label}{rest.required && <span className="text-accent ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 pr-9 rounded-lg text-sm appearance-none cursor-pointer',
            'bg-bg/50 border border-border',
            'transition-all duration-150',
            'hover:border-border/80',
            'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-bg',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-panel text-text">
              {o.label}
            </option>
          ))}
        </select>
        {/* Custom chevron */}
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
          width="14" height="14" viewBox="0 0 14 14" fill="none"
        >
          <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {error && (
        <p className="text-xs text-danger flex items-center gap-1">
          <span className="text-[10px]">⚠</span> {error}
        </p>
      )}
    </div>
  );
});
