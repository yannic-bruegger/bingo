'use client';

import { connection, useBingo } from '@/lib/useBingo';
import { cx } from './ui';

export function Notices() {
  const { notices } = useBingo();
  if (notices.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {notices.map((notice) => (
        <button
          key={notice.id}
          type="button"
          onClick={() => connection.dismiss(notice.id)}
          className={cx(
            'animate-rise pointer-events-auto max-w-sm rounded-full border px-4 py-2 text-sm shadow-sm backdrop-blur',
            notice.tone === 'bingo'
              ? 'border-accent bg-accent text-accent-ink font-medium'
              : notice.tone === 'error'
                ? 'border-line bg-surface text-ink'
                : 'border-line bg-surface text-muted',
          )}
        >
          {notice.text}
        </button>
      ))}
    </div>
  );
}

export function ConnectionDot() {
  const { status } = useBingo();
  const label = status === 'online' ? 'live' : status === 'connecting' ? 'verbinde' : 'offline';
  return (
    <span className="label-xs inline-flex items-center gap-1.5" title={`Verbindung: ${label}`}>
      <span
        className={cx(
          'size-1.5 rounded-full',
          status === 'online' ? 'bg-accent' : status === 'connecting' ? 'animate-flash bg-muted' : 'bg-muted/50',
        )}
      />
      {label}
    </span>
  );
}
