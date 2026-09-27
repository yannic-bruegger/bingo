'use client';

import { useMemo } from 'react';

import { completedLines } from '@/lib/protocol';
import { cx } from './ui';

/** Long phrases get a smaller type size so they never get clipped. */
function fit(word: string): number {
  if (word.length > 40) return 0.56;
  if (word.length > 32) return 0.63;
  if (word.length > 26) return 0.68;
  if (word.length > 18) return 0.79;
  if (word.length > 12) return 0.89;
  return 1;
}

export function BingoCard({
  card,
  stamps,
  size,
  freeIndex,
  onToggle,
  disabled,
  hints,
  numbers,
}: {
  card: string[];
  stamps: boolean[];
  size: number;
  freeIndex: number;
  onToggle?: (index: number, on: boolean) => void;
  disabled?: boolean;
  /** Cells someone else already stamped — they blink until this player does too. */
  hints?: ReadonlySet<number>;
  /** Per cell, the word's number on lists that have them. */
  numbers?: (number | null)[] | null;
}) {
  const winning = useMemo(() => {
    const set = new Set<number>();
    for (const line of completedLines(stamps, size)) for (const index of line) set.add(index);
    return set;
  }, [stamps, size]);

  return (
    <div className="w-full [container-type:inline-size]">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {card.map((word, index) => {
          const isFree = index === freeIndex;
          const stamped = Boolean(stamps[index]);
          const inLine = winning.has(index);
          const hinted = !stamped && !isFree && Boolean(hints?.has(index));
          const number = isFree ? null : (numbers?.[index] ?? null);
          const label = number === null ? word : `${number} ${word}`;

          return (
            <button
              key={index}
              type="button"
              disabled={disabled || isFree}
              aria-pressed={stamped}
              onClick={() => onToggle?.(index, !stamped)}
              aria-label={hinted ? `${label} – von anderen schon abgehakt` : label}
              className={cx(
                'relative flex aspect-square items-center justify-center rounded-xl border p-1 text-center',
                'leading-[1.05] break-words hyphens-auto transition-colors duration-150',
                'disabled:cursor-default',
                isFree
                  ? 'border-accent/30 bg-accent-soft text-accent'
                  : inLine
                    ? 'animate-pop border-accent bg-accent text-accent-ink'
                    : stamped
                      ? 'animate-pop border-accent/40 bg-accent-soft text-ink'
                      : hinted
                        ? 'animate-hint border-2 border-accent bg-surface text-ink'
                        : 'border-line bg-surface text-ink hover:border-ink/30 hover:bg-faint',
              )}
              style={{ fontSize: `calc(clamp(0.5rem, ${14 / size}cqw, 1.05rem) * ${fit(word)})` }}
            >
              {number !== null && (
                <span
                  aria-hidden
                  className="absolute top-1 left-1.5 font-mono text-[0.625rem] leading-none tabular-nums opacity-55"
                >
                  {number}
                </span>
              )}
              <span className="max-h-full overflow-hidden">{word}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Tiny read-only preview of somebody else's progress. */
export function MiniCard({
  stamps,
  size,
  highlight,
}: {
  stamps: boolean[];
  size: number;
  highlight?: boolean;
}) {
  return (
    <div
      className="grid shrink-0 gap-px rounded-[3px] p-px"
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        width: '2.25rem',
        height: '2.25rem',
      }}
      aria-hidden
    >
      {Array.from({ length: size * size }, (_, index) => (
        <span
          key={index}
          className={cx(
            'rounded-[1px] transition-colors duration-150',
            stamps[index]
              ? highlight
                ? 'bg-accent'
                : 'bg-ink/70'
              : 'bg-line',
          )}
        />
      ))}
    </div>
  );
}
