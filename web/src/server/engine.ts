/**
 * Authoritative, in-memory game engine.
 *
 * Pure logic — no transport concerns. The WebSocket layer translates messages
 * into calls here and broadcasts whatever snapshots come back.
 */

import {
  CODE_LENGTH,
  MAX_LIST_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_WORDS,
  MAX_WORD_LENGTH,
  MIN_WORDS,
  SIZES,
  GAME_MODES,
  completedLines,
  freeIndexFor,
  wordsNeeded,
  type ErrorCode,
  type GameMode,
  type ListInfo,
  type ListRef,
  type PublicPlayer,
  type SelfState,
  type SessionSnapshot,
  type SessionStatus,
} from '../lib/protocol.ts';
import { DEFAULT_LIST_ID, getList } from './wordlists.ts';

/** A list as it lives inside a session — resolved, validated, self-contained. */
export type SessionList = ListInfo & {
  words: string[];
  freeLabel: string;
  /** Word → its number, for lists whose cells are numbered. */
  numbers?: ReadonlyMap<string, number>;
};

export type Player = {
  id: string;
  name: string;
  connected: boolean;
  card: string[] | null;
  stamps: boolean[];
  hasBingo: boolean;
  bingoAt: number | null;
  wins: number;
  disconnectedAt: number | null;
};

export type Session = {
  code: string;
  status: SessionStatus;
  mode: GameMode;
  size: number;
  list: SessionList;
  shareStamps: boolean;
  /**
   * Who owns the round. Sticky: it only changes when this player leaves for
   * good. While they are away, `actingHostId` picks a stand-in.
   */
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

/**
 * Sessions with no connected players are dropped after this long. Phones in a
 * pocket all go quiet at once during a long evening, so this has to cover one.
 */
export const EMPTY_SESSION_TTL_MS = 3 * 60 * 60 * 1000;
/**
 * Disconnected players keep their seat — card, stamps, host role — this long.
 * A locked phone drops its socket within seconds; that must never cost a card.
 */
export const GHOST_PLAYER_TTL_MS = 3 * 60 * 60 * 1000;

export class Engine {
  private sessions = new Map<string, Session>();

  /* --------------------------------- lifecycle -------------------------------- */

  createSession(
    hostName: string,
    listRef: ListRef | undefined,
    size: number | undefined,
    mode: GameMode = 'race',
  ): Result<{ session: Session; player: Player }> {
    const name = cleanName(hostName);
    if (!name) return fail('bad_request', 'Bitte gib einen Namen ein.');

    const cardSize = size ?? 5;
    if (!isValidSize(cardSize)) return fail('bad_request', 'Ungültige Kartengröße.');

    if (!isValidMode(mode)) return fail('bad_request', 'Unbekannter Spielmodus.');

    const resolved = resolveList(listRef ?? { kind: 'shared', id: DEFAULT_LIST_ID });
    if (!resolved.ok) return resolved;
    if (resolved.list.count < wordsNeeded(cardSize)) {
      return fail('bad_list', tooFewWords(resolved.list.count, cardSize));
    }

    const code = this.freshCode();
    const player = newPlayer(name);
    const session: Session = {
      code,
      status: 'lobby',
      mode,
      size: cardSize,
      list: resolved.list,
      shareStamps: false,
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
    // The host role stays put — see actingHostId for who steps in meanwhile.
    touch(session);
  }

  /* ---------------------------------- actions --------------------------------- */

  configure(
    session: Session,
    playerId: string,
    patch: { list?: ListRef; size?: number; mode?: GameMode; shareStamps?: boolean },
  ): Result<object> {
    if (actingHostId(session) !== playerId) return fail('not_host', 'Nur der Host kann das ändern.');

    // Hints change nothing about the cards, so they may be flipped mid-game.
    if (patch.shareStamps !== undefined) {
      if (typeof patch.shareStamps !== 'boolean') return fail('bad_request', 'Ungültige Einstellung.');
      session.shareStamps = patch.shareStamps;
    }
    const touchesCards = patch.list !== undefined || patch.size !== undefined || patch.mode !== undefined;
    if (!touchesCards) {
      touch(session);
      return { ok: true };
    }
    if (session.status !== 'lobby') return fail('already_running', 'Das Spiel läuft bereits.');

    if (patch.mode !== undefined) {
      if (!isValidMode(patch.mode)) return fail('bad_request', 'Unbekannter Spielmodus.');
      session.mode = patch.mode;
    }

    let list = session.list;
    if (patch.list !== undefined) {
      const resolved = resolveList(patch.list);
      if (!resolved.ok) return resolved;
      list = resolved.list;
    }

    let size = session.size;
    if (patch.size !== undefined) {
      if (!isValidSize(patch.size)) return fail('bad_request', 'Ungültige Kartengröße.');
      size = patch.size;
    } else if (list.count < wordsNeeded(size)) {
      // Picking a shorter list shouldn't dead-end — fall back to the biggest
      // card it can still fill. An explicit size choice stays strict.
      const fits = SIZES.filter((option) => list.count >= wordsNeeded(option));
      if (fits.length > 0) size = Math.max(...fits);
    }

    // List and size only make sense together — reject the combination, not one half.
    if (list.count < wordsNeeded(size)) return fail('bad_list', tooFewWords(list.count, size));

    session.list = list;
    session.size = size;
    touch(session);
    return { ok: true };
  }

  start(session: Session, playerId: string): Result<object> {
    if (actingHostId(session) !== playerId) return fail('not_host', 'Nur der Host kann starten.');
    if (session.status === 'running') return fail('already_running', 'Das Spiel läuft bereits.');

    if (session.list.count < wordsNeeded(session.size)) {
      return fail('bad_list', tooFewWords(session.list.count, session.size));
    }

    session.status = 'running';
    session.startedAt = Date.now();
    session.winners = [];
    for (const id of session.order) {
      const player = session.players.get(id);
      if (!player) continue;
      player.wins = 0;
      dealTo(session, player);
    }
    touch(session);
    return { ok: true };
  }

  stop(session: Session, playerId: string): Result<object> {
    if (actingHostId(session) !== playerId) return fail('not_host', 'Nur der Host kann das Spiel beenden.');
    if (session.status !== 'running') return fail('bad_request', 'Es läuft gerade kein Spiel.');
    session.status = 'finished';
    touch(session);
    return { ok: true };
  }

  /** Back to the lobby, cards cleared. */
  reset(session: Session, playerId: string): Result<object> {
    if (actingHostId(session) !== playerId) return fail('not_host', 'Nur der Host kann eine neue Runde starten.');
    session.status = 'lobby';
    session.startedAt = null;
    session.winners = [];
    for (const player of session.players.values()) {
      player.card = null;
      player.stamps = [];
      player.hasBingo = false;
      player.bingoAt = null;
      player.wins = 0;
    }
    touch(session);
    return { ok: true };
  }

  /**
   * Returns `bingo: true` on the stamp that completes a line. In endless mode
   * that also banks a win and deals the player a fresh card straight away, so
   * everyone else can keep working on theirs.
   */
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
      player.wins += 1;
      if (session.mode === 'endless') {
        dealTo(session, player);
      } else if (!session.winners.includes(player.id)) {
        session.winners.push(player.id);
      }
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
    const host = actingHostId(session);
    return {
      code: session.code,
      status: session.status,
      mode: session.mode,
      size: session.size,
      list: { id: session.list.id, name: session.list.name, count: session.list.count, source: session.list.source },
      shareStamps: session.shareStamps,
      hostId: actingHostId(session),
      winners: [...session.winners],
      startedAt: session.startedAt,
      players: session.order
        .map((id) => session.players.get(id))
        .filter((p): p is Player => Boolean(p))
        .map((p): PublicPlayer => ({
          id: p.id,
          name: p.name,
          isHost: p.id === host,
          connected: p.connected,
          stamps: [...p.stamps],
          lines: p.card ? completedLines(p.stamps, session.size).length : 0,
          hasBingo: p.hasBingo,
          bingoAt: p.bingoAt,
          wins: p.wins,
        })),
    };
  }

  selfState(session: Session, player: Player): SelfState {
    return {
      playerId: player.id,
      card: player.card ? [...player.card] : null,
      freeIndex: freeIndexFor(session.size),
      numbers: numbersFor(session.list, player.card),
      hints: this.hintsFor(session, player),
    };
  }

  /** Cells on `player`'s card that someone else has stamped and they haven't. */
  private hintsFor(session: Session, player: Player): number[] {
    if (!session.shareStamps || session.status !== 'running' || !player.card) return [];
    const free = freeIndexFor(session.size);

    const stampedElsewhere = new Set<string>();
    for (const other of session.players.values()) {
      if (other.id === player.id || !other.card) continue;
      other.card.forEach((word, index) => {
        if (index !== free && other.stamps[index]) stampedElsewhere.add(word);
      });
    }

    const hints: number[] = [];
    player.card.forEach((word, index) => {
      if (index !== free && !player.stamps[index] && stampedElsewhere.has(word)) hints.push(index);
    });
    return hints;
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
    wins: 0,
    disconnectedAt: null,
  };
}

function dealTo(session: Session, player: Player): void {
  player.card = buildCard(session.list.words, session.size, session.list.freeLabel);
  player.stamps = new Array(session.size * session.size).fill(false);
  player.hasBingo = false;
  player.bingoAt = null;
  const free = freeIndexFor(session.size);
  if (free >= 0) player.stamps[free] = true;
}

/** A fresh shuffle per player, so no two cards are alike. */
export function buildCard(words: string[], size: number, freeLabel = FREE_CELL): string[] {
  const free = freeIndexFor(size);
  const picked = shuffle(words).slice(0, wordsNeeded(size));
  if (free < 0) return picked;
  return [...picked.slice(0, free), freeLabel, ...picked.slice(free)];
}

export const FREE_CELL = '★';

function numbersFor(list: SessionList, card: string[] | null): (number | null)[] | null {
  const numbers = list.numbers;
  if (!numbers || !card) return null;
  return card.map((word) => numbers.get(word) ?? null);
}

/* ----------------------------------- lists ----------------------------------- */

function tooFewWords(count: number, size: number): string {
  return `Die Liste hat ${count} Begriffe, für ${size} × ${size} werden ${wordsNeeded(size)} gebraucht.`;
}

/**
 * Turns whatever a host picked into a self-contained list. Custom lists carry
 * their words with them, so a round never depends on the creator staying online.
 */
export function resolveList(ref: ListRef): Result<{ list: SessionList }> {
  if (!ref || typeof ref !== 'object') return fail('bad_list', 'Keine Wortliste ausgewählt.');

  if (ref.kind === 'shared') {
    const list = getList(String(ref.id));
    if (!list) return fail('bad_list', 'Unbekannte Wortliste.');
    return {
      ok: true,
      list: {
        id: list.id,
        name: list.name,
        count: list.words.length,
        source: 'shared',
        words: list.words,
        freeLabel: list.freeLabel,
        numbers: list.numbered ? new Map(list.words.map((word, i) => [word, i + 1])) : undefined,
      },
    };
  }

  if (ref.kind === 'custom') {
    const name = cleanListName(ref.name);
    if (!name) return fail('bad_list', 'Die Liste braucht einen Namen.');
    const words = normalizeWords(ref.words);
    if (words.length < MIN_WORDS) {
      return fail('bad_list', `Die Liste braucht mindestens ${MIN_WORDS} Begriffe.`);
    }
    return {
      ok: true,
      list: {
        id: typeof ref.id === 'string' && ref.id ? ref.id.slice(0, 64) : `custom:${randomId()}`,
        name,
        count: words.length,
        source: 'custom',
        words,
        freeLabel: FREE_CELL,
      },
    };
  }

  return fail('bad_list', 'Unbekannte Wortliste.');
}

/** Trims, drops blanks and duplicates, and caps length — order is preserved. */
export function normalizeWords(words: unknown): string[] {
  if (!Array.isArray(words)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    if (typeof word !== 'string') continue;
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

export function cleanListName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_LIST_NAME_LENGTH);
}

function shuffle<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The host while they are connected; otherwise the first connected player in
 * join order stands in, so a round never lacks someone who can start or stop
 * it. The moment the host is back, the role is theirs again.
 */
export function actingHostId(session: Session): string {
  if (session.players.get(session.hostId)?.connected) return session.hostId;
  return session.order.find((id) => session.players.get(id)?.connected) ?? session.hostId;
}

/** Hands ownership on for good — only when the host has left the round. */
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

export function isValidMode(mode: unknown): mode is GameMode {
  return typeof mode === 'string' && (GAME_MODES as string[]).includes(mode);
}

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += Math.floor(Math.random() * 10);
  return out;
}

function randomId(): string {
  return crypto.randomUUID();
}
