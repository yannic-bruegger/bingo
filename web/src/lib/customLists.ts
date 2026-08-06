'use client';

/**
 * Word lists a player wrote themselves. They live in localStorage, so they are
 * private to this browser and survive across rounds. Picking one for a game
 * uploads its words to the server for that session only.
 */

import { MAX_LIST_NAME_LENGTH, MAX_WORDS, MAX_WORD_LENGTH, MIN_WORDS } from './protocol';

export type CustomList = {
  id: string;
  name: string;
  words: string[];
  updatedAt: number;
};

const KEY = 'bingo:lists';

let cache: CustomList[] | null = null;
const listeners = new Set<() => void>();

function load(): CustomList[] {
  if (cache) return cache;
  if (typeof localStorage === 'undefined') return (cache = []);
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    cache = Array.isArray(raw) ? raw.filter(isCustomList) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function isCustomList(value: unknown): value is CustomList {
  if (!value || typeof value !== 'object') return false;
  const list = value as Partial<CustomList>;
  return (
    typeof list.id === 'string' &&
    typeof list.name === 'string' &&
    Array.isArray(list.words) &&
    list.words.every((word) => typeof word === 'string')
  );
}

function persist(next: CustomList[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — the list still works for this session */
  }
  for (const listener of listeners) listener();
}

const EMPTY: CustomList[] = [];

export const customLists = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): CustomList[] => load(),
  getServerSnapshot: (): CustomList[] => EMPTY,

  get(id: string): CustomList | undefined {
    return load().find((list) => list.id === id);
  },

  /** Creates or updates a list and returns the stored version. */
  save(draft: { id?: string; name: string; words: string[] }): CustomList {
    const list: CustomList = {
      id: draft.id ?? `custom:${crypto.randomUUID()}`,
      name: cleanListName(draft.name),
      words: normalizeWords(draft.words),
      updatedAt: Date.now(),
    };
    const rest = load().filter((existing) => existing.id !== list.id);
    persist([...rest, list].sort((a, b) => a.name.localeCompare(b.name, 'de')));
    return list;
  },

  remove(id: string) {
    persist(load().filter((list) => list.id !== id));
  },
};

/** Mirrors the server's rules so the editor can show the same numbers. */
export function normalizeWords(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    const clean = word.replace(/\s+/g, ' ').trim().slice(0, MAX_WORD_LENGTH);
    if (!clean) continue;
    const key = clean.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

export function cleanListName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_LIST_NAME_LENGTH);
}

export function parseWords(text: string): string[] {
  return normalizeWords(text.split('\n'));
}

export { MIN_WORDS };
