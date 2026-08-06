'use client';

import { useState, useSyncExternalStore } from 'react';

import { customLists, parseWords, type CustomList } from '@/lib/customLists';
import {
  MAX_LIST_NAME_LENGTH,
  MIN_WORDS,
  wordsNeeded,
  type ListInfo,
  type ListRef,
} from '@/lib/protocol';
import { Button, cx } from './ui';

export function useCustomLists(): CustomList[] {
  return useSyncExternalStore(
    customLists.subscribe,
    customLists.getSnapshot,
    customLists.getServerSnapshot,
  );
}

export function SourceTag({
  source,
  onDark,
}: {
  source: 'shared' | 'custom';
  onDark?: boolean;
}) {
  return (
    <span
      className={cx(
        'shrink-0 rounded px-1.5 py-px text-[0.625rem] tracking-wide uppercase',
        onDark
          ? 'border border-current/40 opacity-70'
          : source === 'custom'
            ? 'border border-accent/40 text-accent'
            : 'bg-faint text-muted',
      )}
      title={
        source === 'custom'
          ? 'Nur in diesem Browser gespeichert'
          : 'Für alle verfügbar'
      }
    >
      {source === 'custom' ? 'lokal' : 'geteilt'}
    </span>
  );
}

/**
 * Lets the host pick one of the app's lists or one of their own, and write new
 * ones. Local lists never leave the browser until a round actually uses them.
 */
export function ListPicker({
  shared,
  activeId,
  size,
  onPick,
}: {
  shared: ListInfo[];
  activeId: string;
  size: number;
  onPick: (ref: ListRef) => void;
}) {
  const mine = useCustomLists();
  const [editing, setEditing] = useState<CustomList | 'new' | null>(null);

  if (editing) {
    return (
      <ListEditor
        list={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={(list) => {
          setEditing(null);
          onPick({ kind: 'custom', id: list.id, name: list.name, words: list.words });
        }}
        onDelete={(id) => {
          customLists.remove(id);
          setEditing(null);
        }}
      />
    );
  }

  const needed = wordsNeeded(size);

  return (
    <div className="flex flex-col gap-1.5">
      {shared.map((list) => (
        <Row
          key={list.id}
          name={list.name}
          count={list.count}
          source="shared"
          active={list.id === activeId}
          short={list.count < needed}
          onClick={() => onPick({ kind: 'shared', id: list.id })}
        />
      ))}

      {mine.map((list) => (
        <Row
          key={list.id}
          name={list.name}
          count={list.words.length}
          source="custom"
          active={list.id === activeId}
          short={list.words.length < needed}
          onClick={() =>
            onPick({ kind: 'custom', id: list.id, name: list.name, words: list.words })
          }
          onEdit={() => setEditing(list)}
        />
      ))}

      <button
        type="button"
        onClick={() => setEditing('new')}
        className="rounded-lg border border-dashed border-line px-3 py-2.5 text-left text-sm text-muted hover:border-ink/30 hover:text-ink"
      >
        + Eigene Liste anlegen
      </button>

      <p className="mt-1 text-xs text-muted">
        Eigene Listen liegen nur in diesem Browser. Beim Start bekommen alle
        Mitspieler die Begriffe.
      </p>
    </div>
  );
}

function Row({
  name,
  count,
  source,
  active,
  short,
  onClick,
  onEdit,
}: {
  name: string;
  count: number;
  source: 'shared' | 'custom';
  active: boolean;
  short: boolean;
  onClick: () => void;
  onEdit?: () => void;
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors duration-150',
        active ? 'border-ink/70 bg-ink text-bg' : 'border-line bg-surface hover:border-ink/30',
      )}
    >
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{name}</span>
          <SourceTag source={source} onDark={active} />
        </span>
        <span className={cx('mt-0.5 block text-[0.7rem]', active ? 'opacity-60' : 'text-muted')}>
          {count} Begriffe{short ? ' · zu wenige für diese Größe' : ''}
        </span>
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className={cx(
            'shrink-0 rounded px-2 py-1 text-[0.7rem] tracking-wide uppercase',
            active ? 'opacity-70 hover:opacity-100' : 'text-muted hover:text-ink',
          )}
        >
          bearbeiten
        </button>
      )}
    </div>
  );
}

function ListEditor({
  list,
  onSave,
  onCancel,
  onDelete,
}: {
  list: CustomList | null;
  onSave: (list: CustomList) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(list?.name ?? '');
  const [text, setText] = useState((list?.words ?? []).join('\n'));

  const words = parseWords(text);
  const canSave = name.trim().length > 0 && words.length >= MIN_WORDS;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={MAX_LIST_NAME_LENGTH}
        autoFocus
        placeholder="Name der Liste"
        className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted/60 focus:border-ink/30"
      />
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={8}
        placeholder={'Ein Begriff pro Zeile\nnoch einer\n…'}
        className="w-full resize-y rounded-lg border border-line bg-bg p-3 text-sm leading-relaxed text-ink placeholder:text-muted/60 focus:border-ink/30"
      />
      <p className="text-xs text-muted">
        {words.length} {words.length === 1 ? 'Begriff' : 'Begriffe'} · mindestens {MIN_WORDS}
        {' · Doppelte und leere Zeilen fallen raus'}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Abbrechen
        </Button>
        <Button
          size="sm"
          className="flex-1"
          disabled={!canSave}
          onClick={() => onSave(customLists.save({ id: list?.id, name, words }))}
        >
          Speichern
        </Button>
      </div>
      {list && (
        <button
          type="button"
          onClick={() => onDelete(list.id)}
          className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          Liste löschen
        </button>
      )}
    </div>
  );
}
