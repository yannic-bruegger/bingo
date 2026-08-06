import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { freeIndexFor } from '../lib/protocol.ts';
import { Engine, buildCard } from './engine.ts';
import { WORD_LISTS } from './wordlists.ts';

const LIST = WORD_LISTS[0].id;

function started(size = 5, players = ['Host', 'Gast']) {
  const engine = new Engine();
  const created = engine.createSession(players[0], LIST, size);
  assert.ok(created.ok);
  const { session } = created;
  for (const name of players.slice(1)) {
    const joined = engine.join(session.code, name);
    assert.ok(joined.ok);
  }
  assert.ok(engine.start(session, created.player.id).ok);
  return { engine, session, hostId: created.player.id };
}

describe('sessions', () => {
  it('creates a six digit code and seats the host', () => {
    const engine = new Engine();
    const result = engine.createSession(' Yannic ', LIST, 5);
    assert.ok(result.ok);
    assert.match(result.session.code, /^\d{6}$/);
    assert.equal(result.player.name, 'Yannic');
    assert.equal(result.session.hostId, result.player.id);
  });

  it('rejects unknown codes and duplicate names', () => {
    const engine = new Engine();
    const created = engine.createSession('Anna', LIST, 5);
    assert.ok(created.ok);

    const missing = engine.join('000000', 'Ben');
    assert.equal(missing.ok, false);
    assert.equal(missing.ok === false && missing.code, 'no_such_session');

    const clash = engine.join(created.session.code, 'anna');
    assert.equal(clash.ok, false);
    assert.equal(clash.ok === false && clash.code, 'name_taken');
  });

  it('lets a disconnected player reclaim their seat and card', () => {
    const { engine, session } = started();
    const player = [...session.players.values()][1];
    const cardBefore = player.card;

    engine.markDisconnected(session, player.id);
    assert.equal(player.connected, false);

    const back = engine.join(session.code, player.name, player.id);
    assert.ok(back.ok);
    assert.equal(back.rejoined, true);
    assert.equal(back.player.connected, true);
    assert.deepEqual(back.player.card, cardBefore);
  });

  it('hands the host role to someone who is still connected', () => {
    const { engine, session, hostId } = started();
    engine.markDisconnected(session, hostId);
    assert.notEqual(session.hostId, hostId);
    assert.equal(session.players.get(session.hostId)?.connected, true);
  });

  it('only lets the host start, stop and configure', () => {
    const engine = new Engine();
    const created = engine.createSession('Host', LIST, 5);
    assert.ok(created.ok);
    const guest = engine.join(created.session.code, 'Gast');
    assert.ok(guest.ok);

    const denied = engine.start(created.session, guest.player.id);
    assert.equal(denied.ok, false);
    assert.equal(denied.ok === false && denied.code, 'not_host');
    assert.ok(engine.configure(created.session, created.player.id, { size: 4 }).ok);
    assert.equal(created.session.size, 4);
  });
});

describe('cards', () => {
  it('fills the grid with unique words and a free centre on odd sizes', () => {
    for (const size of [3, 4, 5]) {
      const card = buildCard(WORD_LISTS[0].words, size);
      assert.equal(card.length, size * size);
      const free = freeIndexFor(size);
      const words = card.filter((_, index) => index !== free);
      assert.equal(new Set(words).size, words.length);
    }
  });

  it('deals a distinct card to every player and pre-stamps the free cell', () => {
    const { session } = started(5, ['A', 'B', 'C']);
    const cards = [...session.players.values()].map((p) => p.card!.join('|'));
    assert.equal(new Set(cards).size, 3);
    for (const player of session.players.values()) {
      assert.equal(player.stamps[freeIndexFor(5)], true);
      assert.equal(player.stamps.filter(Boolean).length, 1);
    }
  });

  it('deals to late joiners of a running game', () => {
    const { engine, session } = started();
    const late = engine.join(session.code, 'Spät');
    assert.ok(late.ok);
    assert.equal(late.player.card?.length, 25);
  });
});

describe('stamping', () => {
  it('reports bingo exactly once when a row completes', () => {
    const { engine, session, hostId } = started(5, ['Host']);
    let bingos = 0;
    for (const index of [0, 1, 2, 3]) {
      const result = engine.stamp(session, hostId, index, true);
      assert.ok(result.ok);
      if (result.bingo) bingos++;
    }
    assert.equal(bingos, 0);

    const last = engine.stamp(session, hostId, 4, true);
    assert.ok(last.ok);
    assert.equal(last.bingo, true);
    assert.deepEqual(session.winners, [hostId]);

    // Re-stamping an already stamped cell must not fire a second time.
    const again = engine.stamp(session, hostId, 4, true);
    assert.ok(again.ok);
    assert.equal(again.bingo, false);
  });

  it('counts the free cell towards the middle row and both diagonals', () => {
    const { engine, session, hostId } = started(5, ['Host']);
    // Middle row is 10..14 with 12 free.
    for (const index of [10, 11, 13]) engine.stamp(session, hostId, index, true);
    const result = engine.stamp(session, hostId, 14, true);
    assert.ok(result.ok);
    assert.equal(result.bingo, true);
  });

  it('withdraws a bingo when a cell is un-stamped', () => {
    const { engine, session, hostId } = started(5, ['Host']);
    for (const index of [0, 1, 2, 3, 4]) engine.stamp(session, hostId, index, true);
    assert.equal(session.players.get(hostId)?.hasBingo, true);

    engine.stamp(session, hostId, 2, false);
    assert.equal(session.players.get(hostId)?.hasBingo, false);
    assert.deepEqual(session.winners, []);
  });

  it('refuses stamps outside a running game', () => {
    const engine = new Engine();
    const created = engine.createSession('Host', LIST, 5);
    assert.ok(created.ok);
    const early = engine.stamp(created.session, created.player.id, 0, true);
    assert.equal(early.ok, false);
  });
});

describe('rounds', () => {
  it('reset clears cards and winners but keeps the players', () => {
    const { engine, session, hostId } = started(5, ['Host', 'Gast']);
    engine.stamp(session, hostId, 0, true);
    assert.ok(engine.reset(session, hostId).ok);

    assert.equal(session.status, 'lobby');
    assert.deepEqual(session.winners, []);
    assert.equal(session.order.length, 2);
    for (const player of session.players.values()) {
      assert.equal(player.card, null);
      assert.deepEqual(player.stamps, []);
    }
  });

  it('snapshots expose stamps but never other players’ words', () => {
    const { engine, session, hostId } = started();
    const snapshot = engine.snapshot(session);
    assert.equal(snapshot.players.length, 2);
    assert.equal(snapshot.players[0].isHost, true);
    assert.equal(JSON.stringify(snapshot).includes('Vorlesung'), false);

    const self = engine.selfState(session, session.players.get(hostId)!);
    assert.equal(self.card?.length, 25);
    assert.equal(self.freeIndex, 12);
  });

  it('sweeps players who never came back and then the empty session', () => {
    const { engine, session } = started(5, ['Host', 'Gast']);
    for (const player of [...session.players.values()]) engine.markDisconnected(session, player.id);

    engine.sweep(Date.now() + 6 * 60 * 1000);
    assert.equal(session.players.size, 0);

    engine.sweep(Date.now() + 20 * 60 * 1000);
    assert.equal(engine.get(session.code), undefined);
  });
});
