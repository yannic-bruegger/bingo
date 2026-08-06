/**
 * Wire protocol shared by the WebSocket server and the React client.
 *
 * The server is authoritative: clients send intents, the server answers with a
 * full snapshot of the session (`sync`) plus transient one-off events.
 */

export const WS_PATH = '/ws';

export type SessionStatus = 'lobby' | 'running' | 'finished';

export type PublicPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  /** One boolean per cell of the player's own card — drives the mini previews. */
  stamps: boolean[];
  /** Number of completed rows/columns/diagonals. */
  lines: number;
  hasBingo: boolean;
  /** ms since session start, or null. */
  bingoAt: number | null;
};

export type SessionSnapshot = {
  code: string;
  status: SessionStatus;
  size: number;
  listId: string;
  listName: string;
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
};

export type WordListInfo = { id: string; name: string; count: number };

/* ------------------------------- client → server ------------------------------- */

export type ClientMessage =
  | { t: 'create'; name: string; listId: string; size: number }
  | { t: 'join'; code: string; name: string; playerId?: string }
  | { t: 'config'; listId?: string; size?: number }
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
  | 'already_running';

export const MAX_PLAYERS = 24;
export const CODE_LENGTH = 6;
export const SIZES = [3, 4, 5] as const;

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
