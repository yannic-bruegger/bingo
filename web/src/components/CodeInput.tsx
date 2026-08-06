'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import { CODE_LENGTH } from '@/lib/protocol';
import { cx } from './ui';

/** Six single-digit boxes that behave like one field (paste, arrows, backspace). */
export function CodeInput({
  value,
  onChange,
  onComplete,
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const completed = useRef('');

  useEffect(() => {
    if (value.length === CODE_LENGTH && completed.current !== value) {
      completed.current = value;
      onComplete?.(value);
    }
    if (value.length < CODE_LENGTH) completed.current = '';
  }, [value, onComplete]);

  const focus = (index: number) => {
    boxes.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))]?.focus();
  };

  const handleInput = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    if (digits.length > 1) {
      onChange((value.slice(0, index) + digits).slice(0, CODE_LENGTH));
      focus(index + digits.length);
      return;
    }
    const next = (value.slice(0, index) + digits + value.slice(index + 1)).slice(0, CODE_LENGTH);
    onChange(next);
    focus(index + 1);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else {
        onChange(value.slice(0, Math.max(0, index - 1)) + value.slice(index));
        focus(index - 1);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focus(index + 1);
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    onChange((value.slice(0, index) + digits).slice(0, CODE_LENGTH));
    focus(index + digits.length);
  };

  return (
    <div className="flex gap-1.5" role="group" aria-label="Spiel-ID">
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          value={value[index] ?? ''}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.target.select()}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={2}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Ziffer ${index + 1}`}
          className={cx(
            'h-12 w-full min-w-0 rounded-lg border border-line bg-surface text-center',
            'font-mono text-lg text-ink tabular-nums',
            'focus:border-ink/40 disabled:opacity-50',
            index === 2 && 'mr-2',
          )}
        />
      ))}
    </div>
  );
}
