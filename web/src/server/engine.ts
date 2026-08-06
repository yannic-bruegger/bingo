/**
 * Authoritative, in-memory game engine.
 *
 * Pure logic — no transport concerns. The WebSocket layer translates messages
 * into calls here and broadcasts whatever snapshots come back.
 */

import {
  CODE_LENGTH,
  MAX_PLAYERS,
  SIZES,
  completedLines,
  freeIndexFor,
  type ErrorCode,
  type PublicPlayer,
  type SelfState,
  type SessionSnapshot,
  type SessionStatus,
} from '../lib/protocol.ts';
import { DEFAULT_LIST_ID, getList } from './wordlists.ts';

export type Player = {
  id: string;
  name: string;
  connected: boolean;
  card: string[] | null;
  stamps: boolean[];
  hasBingo: boolean;
  bingoAt: number | null;
  disconnectedAt: number | null;
};

export type Session = {
  code: string;
  status: SessionStatus;
  size: number;
  listId: string;
  hostId: string;
  /** Join order — keeps the player list stable across renders. */
  order: string[];
  players: Map<string, Player>;
  winners: string[];
  startedAt: number | null;
  touchedAt: number;
};

export type Fail = { ok: false; code: ErrorCode; message: string };
export type Ok<T> = { ok: true } & T;
export type Result<T> = Ok<T> | Fail;

const fail = (code: ErrorCode, message: string): Fail => ({ ok: false, code, message });

/** Sessions with no connected players are dropped after this long. */
export const EMPTY_SESSION_TTL_MS = 10 * 60 * 1000;
/** Disconnected players are forgotten after this long. */
export const GHOST_PLAYER_TTL_MS = 5 * 60 * 1000;

export class Engine {
  private sessions = new Map<string, Session>();

  /* --------------------------------- lifecycle -------------------------------- */

  createSession(hostName: string, listId: string, size: number): Result<{ session: Session; player: Player }> {
    const name = cleanName(hostName);
    if (!name) return fail('bad_request', 'Bitte gib einen Namen ein.');
    if (!getList(listId)) return fail('bad_request', 'Unbekannte Wortliste.');
    if (!isValidSize(size)) return fail('bad_request', 'Ungültige Kartengröße.');

    const code = this.freshCode();
    const player = newPlayer(name);
    const session: Session = {
      code,
      status: 'lobby',
      size,
      listId,
      hostId: player.id,
      order: [player.id],
      players: new Map([[player.id, player]]),
      winners: [],
      startedAt: null,
      touchedAt: Date.now(),
    };
    this.sessions.set(code, session);
    return { ok: true, session, player };
  }

  get(code: string): Session | undefined {
    return this.sessions.get(normalizeCode(code));
  }

  /**
   * Join a session, or reclaim an existing seat when `playerId` matches a
   * player who was previously in it (page reload, flaky network, …).
   */
  join(code: string, rawName: string, playerId?: string): Result<{ session: Session; player: Player; rejoined: boolean }> {
    const session = this.get(code);
    if (!session) return fail('no_such_session', 'Diese Spiel-ID gibt es nicht.');

    const existing = playerId ? session.players.get(playerId) : undefined;
    if (existing) {
      existing.connected = true;
      existing.disconnectedAt = null;
      const name = cleanName(rawName);
      if (name && !this.nameTaken(session, name, existing.id)) existing.name = name;
      touch(session);
      return { ok: true, session, player: existing, rejoined: true };
    }

    const name = cleanName(rawName);
    if (!name) return fail('bad_request', 'Bitte gib einen Namen ein.');
    if (this.nameTaken(session, name)) return fail('name_taken', `„${name}“ ist hier schon vergeben.`);
    if (session.order.length >= MAX_PLAYERS) return fail('session_full', 'Diese Runde ist voll.');

    const player = newPlayer(name);
    // Late joiners get a card immediately so they can play along.
    if (session.status === 'running') dealTo(session, player);

    session.players.set(player.id, player);
    session.order.push(player.id);
    touch(session);
    return { ok: true, session, player, rejoined: false };
  }

  /** Explicit leave — the seat is given up for good. */
  remove(session: Session, playerId: string): void {
    if (!session.players.delete(playerId)) return;
    session.order = session.order.filter((id) => id !== playerId);
    session.winners = session.winners.filter((id) => id !== playerId);
    if (session.hostId === playerId) reassignHost(session);
    if (session.order.length === 0) this.sessions.delete(session.code);
    touch(session);
  }

  /** Socket dropped — keep the seat warm so the player can come back. */
  markDisconnected(session: Session, playerId: string): void {
    const player = session.players.get(playerId);
    if (!player) return;
    player.connected = false;
    player.disconnectedAt = Date.now();
    // Never leave a lobby without someone who can press start.
    if (session.hostId === playerId) reassignHost(session);
    touch(session);
  }

  /* ---------------------------------- actions --------------------------------- */

  configure(session: Session, playerId: string, patch: { listId?: string; size?: number }): Result<object> {
    if (session.hostId !== playerId) return fail('not_host', 'Nur der Host kann das ändern.');
    if (session.status !== 'lobby') return fail('already_running', 'Das Spiel läuft bereits.');
    if (patch.listId !== undefined) {
      if (!getList(patch.listId)) return fail('bad_request', 'Unbekannte Wortliste.');
      session.listId = patch.listId;
    }
    if (patch.size !== undefined) {
      if (!isValidSize(patch.size)) return fail('bad_request', 'Ungültige Kartengröße.');
      session.size = patch.size;
    }
    touch(session);
    return { ok: true };
  }

  start(session: Session, playerId: string): Result<object> {
    if (session.hostId !== playerId) return fail('not_host', 'Nur der Host kann starten.');
    if (session.status === 'running') return fail('already_running', 'Das Spiel läuft bereits.');

    const list = getList(session.listId);
    const needed = session.size * session.size - (freeIndexFor(session.size) >= 0 ? 1 : 0);
    if (!list || list.words.length < needed) {
      return fail('bad_request', 'Die Wortliste hat zu wenige Begriffe für diese Kartengröße.');
    }

    session.status = 'running';
    session.startedAt = Date.now();
    session.winners = [];
    for (const id of session.order) {
      const player = session.players.get(id);
      if (player) dealTo(session, player);
    }
    touch(session);
    return { ok: true };
  }

  stop(session: Session, playerId: string): Result<object> {
    if (session.hostId !== playerId) return fail('not_host', 'Nur der Host kann das Spiel beenden.');
    if (session.status !== 'running') return fail('bad_request', 'Es läuft gerade kein Spiel.');
    session.status = 'finished';
    touch(session);
    return { ok: true };
  }

  /** Back to the lobby, cards cleared. */
  reset(session: Session, playerId: string): Result<object> {
    if (session.hostId !== playerId) return fail('not_host', 'Nur der Host kann eine neue Runde starten.');
    session.status = 'lobby';
    session.startedAt = null;
    session.winners = [];
    for (const player of session.players.values()) {
      player.card = null;
      player.stamps = [];
      player.hasBingo = false;
      player.bingoAt = null;
    }
    touch(session);
    return { ok: true };
  }

  /** Returns `bingo: true` exactly once per player and round. */
  stamp(session: Session, playerId: string, index: number, on: boolean): Result<{ bingo: boolean }> {
    const player = session.players.get(playerId);
    if (!player || !player.card) return fail('bad_request', 'Du hast noch keine Karte.');
    if (session.status !== 'running') return fail('bad_request', 'Das Spiel läuft gerade nicht.');
    if (!Number.isInteger(index) || index < 0 || index >= player.stamps.length) {
      return fail('bad_request', 'Dieses Feld gibt es nicht.');
    }
    if (index === freeIndexFor(session.size)) return { ok: true, bingo: false };

    player.stamps[index] = on;
    const lines = completedLines(player.stamps, session.size);
    const hadBingo = player.hasBingo;
    player.hasBingo = lines.length > 0;

    if (player.hasBingo && !hadBingo) {
      player.bingoAt = Date.now() - (session.startedAt ?? Date.now());
      if (!session.winners.includes(player.id)) session.winners.push(player.id);
      touch(session);
      return { ok: true, bingo: true };
    }
    if (!player.hasBingo && hadBingo) {
      player.bingoAt = null;
      session.winners = session.winners.filter((id) => id !== player.id);
    }
    touch(session);
    return { ok: true, bingo: false };
  }

  /* -------------------------------- projections ------------------------------- */

  snapshot(session: Session): SessionSnapshot {
    const list = getList(session.listId);
    return {
      code: session.code,
      status: session.status,
      size: session.size,
      listId: session.listId,
      listName: list?.name ?? session.listId,
      hostId: session.hostId,
      winners: [...session.winners],
      startedAt: session.startedAt,
      players: session.order
        .map((id) => session.players.get(id))
        .filter((p): p is Player => Boolean(p))
        .map((p): PublicPlayer => ({
          id: p.id,
          name: p.name,
          isHost: p.id === session.hostId,
          connected: p.connected,
          stamps: [...p.stamps],
          lines: p.card ? completedLines(p.stamps, session.size).length : 0,
          hasBingo: p.hasBingo,
          bingoAt: p.bingoAt,
        })),
    };
  }

  selfState(session: Session, player: Player): SelfState {
    return {
      playerId: player.id,
      card: player.card ? [...player.card] : null,
      freeIndex: freeIndexFor(session.size),
    };
  }

  /* ------------------------------- housekeeping ------------------------------- */

  /** Drops long-gone players and abandoned sessions. Called on an interval. */
  sweep(now = Date.now()): Session[] {
    const changed: Session[] = [];
    for (const session of [...this.sessions.values()]) {
      let dirty = false;
      for (const player of [...session.players.values()]) {
        if (!player.connected && player.disconnectedAt && now - player.disconnectedAt > GHOST_PLAYER_TTL_MS) {
          this.remove(session, player.id);
          dirty = true;
        }
      }
      const anyoneHome = session.order.some((id) => session.players.get(id)?.connected);
      if (!anyoneHome && now - session.touchedAt > EMPTY_SESSION_TTL_MS) {
        this.sessions.delete(session.code);
        continue;
      }
      if (dirty && this.sessions.has(session.code)) changed.push(session);
    }
    return changed;
  }

  get size(): number {
    return this.sessions.size;
  }

  /* ---------------------------------- internals ------------------------------- */

  private nameTaken(session: Session, name: string, exceptId?: string): boolean {
    const wanted = name.toLocaleLowerCase();
    for (const player of session.players.values()) {
      if (player.id !== exceptId && player.name.toLocaleLowerCase() === wanted) return true;
    }
    return false;
  }

  private freshCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = randomCode();
      if (!this.sessions.has(code)) return code;
    }
    throw new Error('Could not allocate a free session code');
  }
}

/* ---------------------------------- helpers ---------------------------------- */

function newPlayer(name: string): Player {
  return {
    id: randomId(),
    name,
    connected: true,
    card: null,
    stamps: [],
    hasBingo: false,
    bingoAt: null,
    disconnectedAt: null,
  };
}

function dealTo(session: Session, player: Player): void {
  const list = getList(session.listId);
  if (!list) return;
  player.card = buildCard(list.words, session.size);
  player.stamps = new Array(session.size * session.size).fill(false);
  player.hasBingo = false;
  player.bingoAt = null;
  const free = freeIndexFor(session.size);
  if (free >= 0) player.stamps[free] = true;
}

/** A fresh shuffle per player, so no two cards are alike. */
export function buildCard(words: string[], size: number): string[] {
  const free = freeIndexFor(size);
  const needed = size * size - (free >= 0 ? 1 : 0);
  const picked = shuffle(words).slice(0, needed);
  if (free < 0) return picked;
  return [...picked.slice(0, free), FREE_CELL, ...picked.slice(free)];
}

export const FREE_CELL = '★';

function shuffle<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function reassignHost(session: Session): void {
  const next =
    session.order.find((id) => session.players.get(id)?.connected) ?? session.order[0];
  if (next) session.hostId = next;
}

function touch(session: Session): void {
  session.touchedAt = Date.now();
}

export function cleanName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.replace(/\s+/g, ' ').trim().slice(0, 20);
}

export function normalizeCode(code: unknown): string {
  if (typeof code !== 'string') return '';
  return code.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function isValidSize(size: unknown): size is number {
  return typeof size === 'number' && (SIZES as readonly number[]).includes(size);
}

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += Math.floor(Math.random() * 10);
  return out;
}

function randomId(): string {
  return crypto.randomUUID();
}
