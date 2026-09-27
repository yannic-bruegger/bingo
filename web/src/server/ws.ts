/**
 * WebSocket transport: translates client messages into engine calls and pushes
 * a fresh snapshot to everyone in the session after every state change.
 */

import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';

import {
  WS_PATH,
  type ClientMessage,
  type EventKind,
  type ServerMessage,
  type WordListInfo,
} from '../lib/protocol.ts';
import { Engine, cleanName, normalizeCode, type Session } from './engine.ts';
import { WORD_LISTS } from './wordlists.ts';

type Bound = { code: string; playerId: string };

type Client = WebSocket & {
  bound?: Bound;
  isAlive?: boolean;
};

const HEARTBEAT_MS = 30_000;
const SWEEP_MS = 60_000;

const LISTS: WordListInfo[] = WORD_LISTS.map((l) => ({
  id: l.id,
  name: l.name,
  count: l.words.length,
  source: 'shared',
}));

export function attachBingoServer(server: HttpServer): WebSocketServer {
  const engine = new Engine();
  // `noServer` + a manual upgrade hook: anything that is not ours (Next's HMR
  // socket in dev, for instance) has to stay untouched.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname !== WS_PATH) return;
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });
  /** code → sockets currently in that session. */
  const rooms = new Map<string, Set<Client>>();

  const send = (socket: Client, message: ServerMessage) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };

  const roomOf = (code: string) => rooms.get(code) ?? new Set<Client>();

  const bind = (socket: Client, session: Session, playerId: string) => {
    unbind(socket, { keepSeat: true });
    socket.bound = { code: session.code, playerId };
    let room = rooms.get(session.code);
    if (!room) rooms.set(session.code, (room = new Set()));
    room.add(socket);
  };

  const unbind = (socket: Client, opts: { keepSeat: boolean }) => {
    const bound = socket.bound;
    if (!bound) return;
    socket.bound = undefined;

    const room = rooms.get(bound.code);
    room?.delete(socket);
    if (room && room.size === 0) rooms.delete(bound.code);

    const session = engine.get(bound.code);
    if (!session) return;
    const player = session.players.get(bound.playerId);
    if (!player) return;

    // Another tab of the same player may still be connected.
    const stillHere = [...roomOf(bound.code)].some((s) => s.bound?.playerId === bound.playerId);
    if (stillHere) return;

    const name = player.name;
    if (opts.keepSeat) {
      engine.markDisconnected(session, bound.playerId);
    } else {
      engine.remove(session, bound.playerId);
    }
    broadcast(bound.code);
    if (!opts.keepSeat) emit(bound.code, 'player_left', bound.playerId, name);
  };

  /** Push the current session state to every socket in the room. */
  const broadcast = (code: string) => {
    const session = engine.get(code);
    if (!session) return;
    const snapshot = engine.snapshot(session);
    for (const socket of roomOf(code)) {
      const player = session.players.get(socket.bound?.playerId ?? '');
      if (!player) continue;
      send(socket, { t: 'sync', session: snapshot, self: engine.selfState(session, player) });
    }
  };

  const emit = (code: string, kind: EventKind, playerId: string, name: string) => {
    for (const socket of roomOf(code)) send(socket, { t: 'event', kind, playerId, name });
  };

  wss.on('connection', (raw: WebSocket) => {
    const socket = raw as Client;
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    send(socket, { t: 'welcome', lists: LISTS });

    socket.on('message', (data) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(String(data)) as ClientMessage;
      } catch {
        return send(socket, { t: 'error', code: 'bad_request', message: 'Ungültige Nachricht.' });
      }
      handle(socket, message);
    });

    socket.on('close', () => unbind(socket, { keepSeat: true }));
    socket.on('error', () => unbind(socket, { keepSeat: true }));
  });

  function handle(socket: Client, message: ClientMessage) {
    if (!message || typeof message.t !== 'string') return;

    if (message.t === 'ping') return send(socket, { t: 'pong' });

    if (message.t === 'create') {
      const result = engine.createSession(
        cleanName(message.name),
        message.list,
        message.size,
        message.mode ?? 'race',
      );
      if (!result.ok) return send(socket, { t: 'error', code: result.code, message: result.message });
      bind(socket, result.session, result.player.id);
      return broadcast(result.session.code);
    }

    if (message.t === 'join') {
      const result = engine.join(
        normalizeCode(message.code),
        cleanName(message.name),
        typeof message.playerId === 'string' ? message.playerId : undefined,
      );
      if (!result.ok) return send(socket, { t: 'error', code: result.code, message: result.message });
      bind(socket, result.session, result.player.id);
      broadcast(result.session.code);
      if (!result.rejoined) {
        emit(result.session.code, 'player_joined', result.player.id, result.player.name);
      }
      return;
    }

    // Everything below needs an established seat.
    const bound = socket.bound;
    const session = bound ? engine.get(bound.code) : undefined;
    if (!bound || !session || !session.players.has(bound.playerId)) {
      return send(socket, { t: 'error', code: 'no_such_session', message: 'Nicht mit einer Runde verbunden.' });
    }
    const playerId = bound.playerId;
    const name = session.players.get(playerId)?.name ?? '';

    switch (message.t) {
      case 'config': {
        const result = engine.configure(session, playerId, {
          list: message.list,
          size: typeof message.size === 'number' ? message.size : undefined,
          mode: message.mode,
          shareStamps: message.shareStamps,
        });
        if (!result.ok) return send(socket, { t: 'error', code: result.code, message: result.message });
        return broadcast(session.code);
      }
      case 'start': {
        const result = engine.start(session, playerId);
        if (!result.ok) return send(socket, { t: 'error', code: result.code, message: result.message });
        broadcast(session.code);
        return emit(session.code, 'game_started', playerId, name);
      }
      case 'stop': {
        const result = engine.stop(session, playerId);
        if (!result.ok) return send(socket, { t: 'error', code: result.code, message: result.message });
        broadcast(session.code);
        return emit(session.code, 'game_stopped', playerId, name);
      }
      case 'reset': {
        const result = engine.reset(session, playerId);
        if (!result.ok) return send(socket, { t: 'error', code: result.code, message: result.message });
        return broadcast(session.code);
      }
      case 'stamp': {
        const result = engine.stamp(session, playerId, Number(message.index), Boolean(message.on));
        if (!result.ok) return send(socket, { t: 'error', code: result.code, message: result.message });
        broadcast(session.code);
        if (result.bingo) emit(session.code, 'player_bingo', playerId, name);
        return;
      }
      case 'leave': {
        return unbind(socket, { keepSeat: false });
      }
      default:
        return send(socket, { t: 'error', code: 'bad_request', message: 'Unbekannte Aktion.' });
    }
  }

  const heartbeat = setInterval(() => {
    for (const raw of wss.clients) {
      const socket = raw as Client;
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, HEARTBEAT_MS);

  const sweeper = setInterval(() => {
    for (const session of engine.sweep()) broadcast(session.code);
  }, SWEEP_MS);

  wss.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(sweeper);
  });

  return wss;
}
