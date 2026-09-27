/**
 * Wire protocol shared by the WebSocket server and the React client.
 *
 * The server is authoritative: clients send intents, the server answers with a
 * full snapshot of the session (`sync`) plus transient one-off events.
 */

export const WS_PATH = '/ws';

export type SessionStatus = 'lobby' | 'running' | 'finished';

/**
 * `race`    — a bingo is final, the order of winners is the result.
 * `endless` — a bingo earns a point and a fresh card; everyone plays on.
 */
export type GameMode = 'race' | 'endless';

export const GAME_MODES: GameMode[] = ['race', 'endless'];

export type PublicPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  /** One boolean per cell of the player's own card — drives the mini previews. */
  stamps: boolean[];
  /** Number of completed rows/columns/diagonals on the current card. */
  lines: number;
  hasBingo: boolean;
  /** Bingos so far this round — only ever above 1 in endless mode. */
  wins: number;
  /** ms since session start, or null. */
  bingoAt: number | null;
};

/** The list a round is being played with, as everyone in the room sees it. */
export type ListInfo = {
  id: string;
  name: string;
  count: number;
  /** `shared` lists ship with the app, `custom` ones come from a player's browser. */
  source: ListSource;
};

export type ListSource = 'shared' | 'custom';

/** What a host sends when picking a list: an existing one, or words of their own. */
export type ListRef =
  | { kind: 'shared'; id: string }
  | { kind: 'custom'; id: string; name: string; words: string[] };

export type SessionSnapshot = {
  code: string;
  status: SessionStatus;
  mode: GameMode;
  size: number;
  list: ListInfo;
  /** When on, a word someone stamps lights up on every other card that has it. */
  shareStamps: boolean;
  hostId: string;
  players: PublicPlayer[];
  /** Player ids in the order they shouted bingo. */
  winners: string[];
  startedAt: number | null;
};

export type SelfState = {
  playerId: string;
  /** The words on this player's card. `null` while in the lobby. */
  card: string[] | null;
  /** Index of the free space, or -1 for even-sized cards. */
  freeIndex: number;
  /** Per cell, the word's number on lists that have them (free cell: null). */
  numbers: (number | null)[] | null;
  /**
   * Cells on this card whose word another player has stamped but this player
   * hasn't yet. Always empty unless the round has `shareStamps` on.
   */
  hints: number[];
};

export type WordListInfo = ListInfo;

/* ------------------------------- client → server ------------------------------- */

export type ClientMessage =
  | { t: 'create'; name: string; list?: ListRef; size?: number; mode?: GameMode }
  | { t: 'join'; code: string; name: string; playerId?: string }
  | { t: 'config'; list?: ListRef; size?: number; mode?: GameMode; shareStamps?: boolean }
  | { t: 'start' }
  | { t: 'stop' }
  | { t: 'reset' }
  | { t: 'stamp'; index: number; on: boolean }
  | { t: 'leave' }
  | { t: 'ping' };

/* ------------------------------- server → client ------------------------------- */

export type ServerMessage =
  | { t: 'welcome'; lists: WordListInfo[] }
  | { t: 'sync'; session: SessionSnapshot; self: SelfState }
  | { t: 'event'; kind: EventKind; playerId: string; name: string }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong' };

export type EventKind =
  | 'player_joined'
  | 'player_left'
  | 'player_bingo'
  | 'game_started'
  | 'game_stopped';

export type ErrorCode =
  | 'no_such_session'
  | 'name_taken'
  | 'not_host'
  | 'bad_request'
  | 'session_full'
  | 'already_running'
  | 'bad_list';

export const MAX_PLAYERS = 24;
/** A list needs at least this many words to fill the smallest card. */
export const MIN_WORDS = 8;
export const MAX_WORDS = 300;
export const MAX_WORD_LENGTH = 60;
export const MAX_LIST_NAME_LENGTH = 30;
export const CODE_LENGTH = 6;
export const SIZES = [3, 4, 5] as const;

/** How many words a card of `size` needs (the free centre costs nothing). */
export function wordsNeeded(size: number): number {
  return size * size - (size % 2 === 1 ? 1 : 0);
}

/** Index of the free space for a card of `size`, or -1 when there is none. */
export function freeIndexFor(size: number): number {
  return size % 2 === 1 ? Math.floor((size * size) / 2) : -1;
}

/**
 * All winning lines (rows, columns, both diagonals) as cell indices.
 * Used by the server to score and by the client to highlight.
 */
export function linesFor(size: number): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < size; r++) {
    lines.push(Array.from({ length: size }, (_, c) => r * size + c));
  }
  for (let c = 0; c < size; c++) {
    lines.push(Array.from({ length: size }, (_, r) => r * size + c));
  }
  lines.push(Array.from({ length: size }, (_, i) => i * size + i));
  lines.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));
  return lines;
}

export function completedLines(stamps: boolean[], size: number): number[][] {
  return linesFor(size).filter((line) => line.every((i) => stamps[i]));
}
