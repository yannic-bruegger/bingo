'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'md' | 'sm';
};

export function Button({ variant = 'solid', size = 'md', className, ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background,color,border-color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-40';
  const sizes = size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-5 text-[0.95rem]';
  const variants = {
    solid: 'bg-ink text-bg hover:opacity-90',
    outline: 'border border-line bg-surface text-ink hover:border-ink/40 hover:bg-faint',
    ghost: 'text-muted hover:bg-faint hover:text-ink',
  }[variant];
  return <button className={cx(base, sizes, variants, className)} {...props} />;
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function TextField({ label, className, id, ...props }: TextFieldProps) {
  return (
    <label className="block">
      <span className="label-xs mb-2 block">{label}</span>
      <input
        id={id}
        className={cx(
          'h-11 w-full rounded-lg border border-line bg-surface px-3 text-[0.95rem] text-ink',
          'placeholder:text-muted/60 focus:border-ink/30',
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="label-xs mb-2 block">{label}</span>
      {children}
    </div>
  );
}

type Option<T> = { value: T; label: string; hint?: string };

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  columns,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0,1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-150',
              'disabled:pointer-events-none disabled:opacity-50',
              active
                ? 'border-ink/70 bg-ink text-bg'
                : 'border-line bg-surface text-ink hover:border-ink/30 hover:bg-faint',
            )}
          >
            <span className="block leading-tight font-medium">{option.label}</span>
            {option.hint && (
              <span className={cx('mt-0.5 block text-[0.7rem]', active ? 'opacity-60' : 'text-muted')}>
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Divider({ children }: { children?: ReactNode }) {
  if (!children) return <hr className="border-line" />;
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span className="label-xs">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('font-mono text-sm tracking-[0.42em] text-ink uppercase', className)}>
      bingo
    </span>
  );
}
