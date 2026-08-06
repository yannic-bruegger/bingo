'use client';

/**
 * A single, app-wide WebSocket connection exposed as an external store.
 *
 * Living outside React means it survives navigation and StrictMode's double
 * mount, and it can transparently re-join a session after a reconnect: the
 * seat (playerId) is remembered per session code in localStorage.
 */

import {
  WS_PATH,
  type ClientMessage,
  type ServerMessage,
  type SelfState,
  type SessionSnapshot,
  type WordListInfo,
} from './protocol';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export type Notice = {
  id: number;
  tone: 'info' | 'error' | 'bingo';
  text: string;
};

export type BingoState = {
  status: ConnectionStatus;
  session: SessionSnapshot | null;
  self: SelfState | null;
  lists: WordListInfo[];
  notices: Notice[];
  /** Set when a create/join attempt was rejected; cleared on the next try. */
  formError: string | null;
  /** True between sending create/join and the first sync. */
  pending: boolean;
};

type Intent =
  | { t: 'create'; name: string; listId: string; size: number }
  | { t: 'join'; code: string; name: string; playerId?: string };

const NAME_KEY = 'bingo:name';
const seatKey = (code: string) => `bingo:seat:${code}`;
const NOTICE_MS = 4000;
const MAX_BACKOFF_MS = 8000;
const HANDSHAKE_TIMEOUT_MS = 6000;

const INITIAL: BingoState = {
  status: 'connecting',
  session: null,
  self: null,
  lists: [],
  notices: [],
  formError: null,
  pending: false,
};

export function readName(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(NAME_KEY) ?? '';
}

function rememberName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private mode — not worth surfacing */
  }
}

function readSeat(code: string): string | undefined {
  try {
    return localStorage.getItem(seatKey(code)) ?? undefined;
  } catch {
    return undefined;
  }
}

function rememberSeat(code: string, playerId: string) {
  try {
    localStorage.setItem(seatKey(code), playerId);
  } catch {
    /* ignore */
  }
}

function forgetSeat(code: string) {
  try {
    localStorage.removeItem(seatKey(code));
  } catch {
    /* ignore */
  }
}

class Connection {
  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private state: BingoState = INITIAL;
  private intent: Intent | null = null;
  private retries = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private noticeSeq = 0;
  /** Called once after a create/join succeeds — used to route to the room. */
  private onEnter: ((code: string) => void) | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    this.open();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): BingoState => this.state;
  getServerSnapshot = (): BingoState => INITIAL;

  /* --------------------------------- socket --------------------------------- */

  private open() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.patch({ status: this.state.session ? 'connecting' : this.state.status });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}${WS_PATH}`);
    this.ws = ws;

    // A half-dead server can accept the socket and never finish the handshake.
    // Without this the socket sits in CONNECTING forever and retries never fire.
    const handshake = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) ws.close();
    }, HANDSHAKE_TIMEOUT_MS);

    ws.onopen = () => {
      clearTimeout(handshake);
      this.retries = 0;
      this.patch({ status: 'online' });
      // Re-establish whatever we were doing before the connection dropped.
      if (this.intent) this.send(this.intent);
    };

    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      this.receive(message);
    };

    ws.onclose = () => {
      clearTimeout(handshake);
      this.ws = null;
      this.patch({ status: 'offline' });
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(400 * 2 ** this.retries, MAX_BACKOFF_MS);
    this.retries += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    this.open();
    return false;
  }

  /* -------------------------------- messages -------------------------------- */

  private receive(message: ServerMessage) {
    switch (message.t) {
      case 'welcome':
        this.patch({ lists: message.lists });
        break;

      case 'sync': {
        const first = this.state.session?.code !== message.session.code;
        rememberSeat(message.session.code, message.self.playerId);
        this.intent = {
          t: 'join',
          code: message.session.code,
          name: this.nameOf(message),
          playerId: message.self.playerId,
        };
        this.patch({
          session: message.session,
          self: message.self,
          status: 'online',
          pending: false,
          formError: null,
        });
        if (first && this.onEnter) {
          const enter = this.onEnter;
          this.onEnter = null;
          enter(message.session.code);
        }
        break;
      }

      case 'event':
        this.handleEvent(message);
        break;

      case 'error':
        if (message.code === 'no_such_session' && this.state.session) {
          // The round is gone (server restart, or it was swept). Don't leave the
          // player staring at a board that no longer exists.
          forgetSeat(this.state.session.code);
          this.intent = null;
          this.patch({
            session: null,
            self: null,
            pending: false,
            formError: 'Diese Runde gibt es nicht mehr.',
          });
        } else if (this.state.pending || !this.state.session) {
          // Failed create/join — surface it on the form and stop retrying it.
          this.intent = null;
          this.patch({ pending: false, formError: message.message });
        } else {
          this.notify('error', message.message);
        }
        break;

      case 'pong':
        break;
    }
  }

  private handleEvent(message: Extract<ServerMessage, { t: 'event' }>) {
    const me = this.state.self?.playerId;
    switch (message.kind) {
      case 'player_joined':
        if (message.playerId !== me) this.notify('info', `${message.name} ist dabei`);
        break;
      case 'player_left':
        this.notify('info', `${message.name} hat die Runde verlassen`);
        break;
      case 'player_bingo':
        this.notify('bingo', message.playerId === me ? 'BINGO! Du hast es!' : `BINGO für ${message.name}`);
        break;
      case 'game_started':
        this.notify('info', 'Los geht’s — viel Glück!');
        break;
      case 'game_stopped':
        this.notify('info', 'Runde beendet');
        break;
    }
  }

  private nameOf(message: Extract<ServerMessage, { t: 'sync' }>): string {
    const me = message.session.players.find((p) => p.id === message.self.playerId);
    return me?.name ?? readName();
  }

  /* --------------------------------- actions -------------------------------- */

  create(name: string, listId: string, size: number, onEnter: (code: string) => void) {
    rememberName(name);
    this.onEnter = onEnter;
    this.intent = { t: 'create', name, listId, size };
    this.patch({ pending: true, formError: null });
    this.send(this.intent);
  }

  join(code: string, name: string, onEnter?: (code: string) => void) {
    rememberName(name);
    if (onEnter) this.onEnter = onEnter;
    this.intent = { t: 'join', code, name, playerId: readSeat(code) };
    this.patch({ pending: true, formError: null });
    this.send(this.intent);
  }

  /** Re-attach to a room we already have a seat for (page reload, deep link). */
  resume(code: string, name: string) {
    const seat = readSeat(code);
    if (!name && !seat) return false;
    this.intent = { t: 'join', code, name, playerId: seat };
    this.patch({ pending: true, formError: null });
    this.send(this.intent);
    return true;
  }

  configure(patch: { listId?: string; size?: number }) {
    this.send({ t: 'config', ...patch });
  }

  start() {
    this.send({ t: 'start' });
  }

  stop() {
    this.send({ t: 'stop' });
  }

  reset() {
    this.send({ t: 'reset' });
  }

  stamp(index: number, on: boolean) {
    // Optimistic: the board reacts instantly, the server confirms right after.
    const self = this.state.self;
    const session = this.state.session;
    if (!self || !session) return;
    this.patch({
      session: {
        ...session,
        players: session.players.map((p) =>
          p.id === self.playerId
            ? { ...p, stamps: p.stamps.map((s, i) => (i === index ? on : s)) }
            : p,
        ),
      },
    });
    this.send({ t: 'stamp', index, on });
  }

  leave() {
    const code = this.state.session?.code;
    this.send({ t: 'leave' });
    if (code) forgetSeat(code);
    this.intent = null;
    this.patch({ session: null, self: null, pending: false, formError: null });
  }

  clearFormError() {
    if (this.state.formError) this.patch({ formError: null });
  }

  dismiss(id: number) {
    this.patch({ notices: this.state.notices.filter((n) => n.id !== id) });
  }

  /* --------------------------------- internals ------------------------------- */

  private notify(tone: Notice['tone'], text: string) {
    const notice: Notice = { id: ++this.noticeSeq, tone, text };
    this.patch({ notices: [...this.state.notices, notice].slice(-4) });
    setTimeout(() => this.dismiss(notice.id), NOTICE_MS);
  }

  private patch(partial: Partial<BingoState>) {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener();
  }
}

export const connection = new Connection();
