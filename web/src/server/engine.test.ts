import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MIN_WORDS, freeIndexFor, type ListRef } from '../lib/protocol.ts';
import {
  EMPTY_SESSION_TTL_MS,
  Engine,
  GHOST_PLAYER_TTL_MS,
  buildCard,
  normalizeWords,
  resolveList,
} from './engine.ts';
import { WORD_LISTS } from './wordlists.ts';

const LIST: ListRef = { kind: 'shared', id: WORD_LISTS[0].id };

/** A throwaway custom list with `count` distinct words. */
function customList(count: number, name = 'Meine Liste'): ListRef {
  return {
    kind: 'custom',
    id: 'custom:test',
    name,
    words: Array.from({ length: count }, (_, i) => `Begriff ${i + 1}`),
  };
}

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

  it('lets a connected player stand in for an absent host, then hands it back', () => {
    const { engine, session, hostId } = started();
    const guest = [...session.players.values()].find((p) => p.id !== hostId)!;

    engine.markDisconnected(session, hostId);
    assert.equal(engine.snapshot(session).hostId, guest.id);
    assert.ok(engine.stop(session, guest.id).ok);

    const back = engine.join(session.code, 'Host', hostId);
    assert.ok(back.ok);
    assert.equal(engine.snapshot(session).hostId, hostId);
    assert.equal(engine.reset(session, guest.id).ok, false);
    assert.ok(engine.reset(session, hostId).ok);
  });

  it('keeps the host when both phones take turns going to sleep', () => {
    const { engine, session, hostId } = started();
    const guest = [...session.players.values()].find((p) => p.id !== hostId)!;

    engine.markDisconnected(session, hostId);
    engine.markDisconnected(session, guest.id);
    engine.join(session.code, guest.name, guest.id);
    engine.join(session.code, 'Host', hostId);
    engine.markDisconnected(session, guest.id);

    assert.equal(session.hostId, hostId);
    assert.equal(engine.snapshot(session).hostId, hostId);
  });

  it('passes the host role on for good only when the host leaves', () => {
    const { engine, session, hostId } = started();
    engine.remove(session, hostId);
    assert.notEqual(session.hostId, hostId);
    assert.equal(engine.snapshot(session).hostId, session.hostId);
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
    assert.equal(JSON.stringify(snapshot).includes('Polizei'), false);

    const self = engine.selfState(session, session.players.get(hostId)!);
    assert.equal(self.card?.length, 25);
    assert.equal(self.freeIndex, 12);
  });

  it('keeps card, stamps and host through a long idle phone', () => {
    const { engine, session, hostId } = started(5, ['Host', 'Gast']);
    engine.stamp(session, hostId, 0, true);
    const card = session.players.get(hostId)!.card;
    for (const player of [...session.players.values()]) engine.markDisconnected(session, player.id);

    engine.sweep(Date.now() + 45 * 60 * 1000);

    const back = engine.join(session.code, 'Host', hostId);
    assert.ok(back.ok);
    assert.equal(back.rejoined, true);
    assert.deepEqual(back.player.card, card);
    assert.equal(back.player.stamps[0], true);
    assert.equal(engine.snapshot(session).hostId, hostId);
  });

  it('sweeps players who never came back and then the empty session', () => {
    const { engine, session } = started(5, ['Host', 'Gast']);
    for (const player of [...session.players.values()]) engine.markDisconnected(session, player.id);

    engine.sweep(Date.now() + GHOST_PLAYER_TTL_MS + 60_000);
    assert.equal(session.players.size, 0);

    engine.sweep(Date.now() + EMPTY_SESSION_TTL_MS + 60_000);
    assert.equal(engine.get(session.code), undefined);
  });
});

describe('word lists', () => {
  it('puts the shared list\u2019s own label in the free centre', () => {
    const { session } = started(5, ['Host']);
    const card = [...session.players.values()][0].card!;
    assert.equal(card[freeIndexFor(5)], WORD_LISTS[0].freeLabel);
  });

  it('plays a round with a list the host supplied', () => {
    const engine = new Engine();
    const created = engine.createSession('Host', customList(30, ' Meine  Liste '), 5);
    assert.ok(created.ok);
    assert.equal(created.session.list.source, 'custom');
    assert.equal(created.session.list.name, 'Meine Liste');
    assert.equal(created.session.list.count, 30);

    assert.ok(engine.start(created.session, created.player.id).ok);
    const card = created.session.players.get(created.player.id)!.card!;
    assert.equal(card.length, 25);
    assert.ok(card.every((word, index) => index === 12 || word.startsWith('Begriff')));

    // Custom lists are private to their author, so the snapshot only names them.
    const snapshot = engine.snapshot(created.session);
    assert.equal(snapshot.list.name, 'Meine Liste');
    assert.equal(JSON.stringify(snapshot).includes('Begriff 1'), false);
  });

  it('keeps the words even after the round is reset', () => {
    const engine = new Engine();
    const created = engine.createSession('Host', customList(30), 5);
    assert.ok(created.ok);
    assert.ok(engine.start(created.session, created.player.id).ok);
    assert.ok(engine.reset(created.session, created.player.id).ok);
    assert.ok(engine.start(created.session, created.player.id).ok);
    assert.equal(created.session.players.get(created.player.id)!.card!.length, 25);
  });

  it('rejects lists that are too small, unnamed or unknown', () => {
    const engine = new Engine();
    const tooSmall = engine.createSession('Host', customList(MIN_WORDS - 1), 3);
    assert.equal(tooSmall.ok, false);
    assert.equal(tooSmall.ok === false && tooSmall.code, 'bad_list');

    const unnamed = engine.createSession('Host', customList(30, '   '), 5);
    assert.equal(unnamed.ok, false);

    const unknown = engine.createSession('Host', { kind: 'shared', id: 'nope' }, 5);
    assert.equal(unknown.ok, false);
    assert.equal(unknown.ok === false && unknown.code, 'bad_list');
  });

  it('shrinks the card when a shorter list is picked on its own', () => {
    const engine = new Engine();
    const created = engine.createSession('Host', LIST, 5);
    assert.ok(created.ok);

    assert.ok(engine.configure(created.session, created.player.id, { list: customList(10) }).ok);
    assert.equal(created.session.size, 3);
    assert.equal(created.session.list.count, 10);

    // Going back to a long list leaves the size alone — it already fits.
    assert.ok(engine.configure(created.session, created.player.id, { list: LIST }).ok);
    assert.equal(created.session.size, 3);
  });

  it('refuses a size the current list cannot fill, and the list stays put', () => {
    const engine = new Engine();
    const created = engine.createSession('Host', customList(10), 3);
    assert.ok(created.ok);

    const tooBig = engine.configure(created.session, created.player.id, { size: 5 });
    assert.equal(tooBig.ok, false);
    assert.equal(tooBig.ok === false && tooBig.code, 'bad_list');
    assert.equal(created.session.size, 3);

    // Swapping list and size together is fine when the pair works out.
    assert.ok(
      engine.configure(created.session, created.player.id, { list: customList(24), size: 5 }).ok,
    );
    assert.equal(created.session.size, 5);
    assert.equal(created.session.list.count, 24);
  });

  it('cleans up words: trims, drops blanks and duplicates, caps length', () => {
    const words = normalizeWords(['  Ein  Wort ', '', '   ', 'ein wort', 'Zwei', 'x'.repeat(100)]);
    assert.deepEqual(words.slice(0, 2), ['Ein Wort', 'Zwei']);
    assert.equal(words.length, 3);
    assert.equal(words[2].length, 60);
  });

  it('resolves shared lists without copying them into the session', () => {
    const shared = resolveList({ kind: 'shared', id: WORD_LISTS[0].id });
    assert.ok(shared.ok);
    assert.equal(shared.list.source, 'shared');
    assert.equal(shared.list.count, WORD_LISTS[0].words.length);
    assert.equal(shared.list.freeLabel, WORD_LISTS[0].freeLabel);
  });
});

describe('shared stamp hints', () => {
  /** Two players, 3×3 from an eight-word list: both cards hold the same words. */
  function sharedRound(shareStamps: boolean) {
    const engine = new Engine();
    const created = engine.createSession('Anna', customList(MIN_WORDS), 3);
    assert.ok(created.ok);
    const { session } = created;
    const joined = engine.join(session.code, 'Ben');
    assert.ok(joined.ok);
    const anna = created.player;
    const ben = joined.player;
    assert.ok(engine.configure(session, anna.id, { shareStamps }).ok);
    assert.ok(engine.start(session, anna.id).ok);
    const free = freeIndexFor(3);
    const pick = anna.card!.findIndex((_, i) => i !== free);
    const word = anna.card![pick];
    const onBen = ben.card!.indexOf(word);
    return { engine, session, anna, ben, pick, onBen };
  }

  it('stays quiet unless the round has hints on', () => {
    const { engine, session, anna, ben, pick } = sharedRound(false);
    engine.stamp(session, anna.id, pick, true);
    assert.deepEqual(engine.selfState(session, ben).hints, []);
  });

  it('points others to the word someone stamped until they stamp it too', () => {
    const { engine, session, anna, ben, pick, onBen } = sharedRound(true);
    assert.deepEqual(engine.selfState(session, ben).hints, []);

    engine.stamp(session, anna.id, pick, true);
    assert.deepEqual(engine.selfState(session, ben).hints, [onBen]);
    assert.deepEqual(engine.selfState(session, anna).hints, [], 'no hint for your own stamp');

    engine.stamp(session, ben.id, onBen, true);
    assert.deepEqual(engine.selfState(session, ben).hints, []);
  });

  it('drops the hint when the stamp is taken back', () => {
    const { engine, session, anna, ben, pick } = sharedRound(true);
    engine.stamp(session, anna.id, pick, true);
    engine.stamp(session, anna.id, pick, false);
    assert.deepEqual(engine.selfState(session, ben).hints, []);
  });

  it('can be switched mid-game, unlike anything that changes the cards', () => {
    const { engine, session, anna, ben, pick, onBen } = sharedRound(false);
    engine.stamp(session, anna.id, pick, true);

    assert.ok(engine.configure(session, anna.id, { shareStamps: true }).ok);
    assert.deepEqual(engine.selfState(session, ben).hints, [onBen]);
    assert.equal(engine.snapshot(session).shareStamps, true);

    const denied = engine.configure(session, anna.id, { size: 4 });
    assert.equal(denied.ok === false && denied.code, 'already_running');
    assert.equal(engine.configure(session, ben.id, { shareStamps: false }).ok, false);
  });
});

describe('numbered lists', () => {
  it('labels Winglbingo cells with the numbers from the original card', () => {
    const { engine, session, hostId } = started(5, ['Host']);
    const self = engine.selfState(session, session.players.get(hostId)!);
    assert.ok(self.card && self.numbers);

    const free = freeIndexFor(5);
    assert.equal(self.numbers[free], null);
    self.card.forEach((word, i) => {
      if (i !== free) assert.equal(self.numbers![i], WORD_LISTS[0].words.indexOf(word) + 1);
    });

    // Spot checks read off cards at mfbc.us/m/bcwgsjb.
    const numberOf = (word: string) => WORD_LISTS[0].words.indexOf(word) + 1;
    assert.equal(numberOf('schnauf / ßo'), 1);
    assert.equal(numberOf('Polizei'), 20);
    assert.equal(numberOf('Lets plays'), 46);
    assert.equal(numberOf('Paranoia / alarmanlage'), 60);
  });

  it('leaves custom lists unnumbered', () => {
    const engine = new Engine();
    const created = engine.createSession('Host', customList(30), 5);
    assert.ok(created.ok);
    assert.ok(engine.start(created.session, created.player.id).ok);
    assert.equal(engine.selfState(created.session, created.player).numbers, null);
  });
});

describe('free cell counter', () => {
  function counting(size = 5, on = true) {
    const engine = new Engine();
    const created = engine.createSession('Host', LIST, size);
    assert.ok(created.ok);
    assert.ok(engine.configure(created.session, created.player.id, { freeCounter: on }).ok);
    assert.ok(engine.start(created.session, created.player.id).ok);
    return { engine, session: created.session, player: created.player };
  }

  it('counts taps up and back down, never below zero', () => {
    const { engine, session, player } = counting();
    for (let i = 0; i < 3; i++) assert.ok(engine.count(session, player.id, 1).ok);
    assert.ok(engine.count(session, player.id, -1).ok);
    assert.equal(engine.snapshot(session).players[0].freeCount, 2);

    engine.count(session, player.id, -1);
    engine.count(session, player.id, -1);
    engine.count(session, player.id, -1);
    assert.equal(player.freeCount, 0);
  });

  it('keeps the free cell stamped while counting', () => {
    const { engine, session, player } = counting();
    engine.count(session, player.id, 1);
    assert.equal(player.stamps[freeIndexFor(5)], true);
  });

  it('only counts when the round has it on and the card has a centre', () => {
    const off = counting(5, false);
    assert.equal(off.engine.count(off.session, off.player.id, 1).ok, false);

    const even = counting(4, true);
    assert.equal(even.engine.count(even.session, even.player.id, 1).ok, false);

    const odd = counting();
    assert.equal(odd.engine.count(odd.session, odd.player.id, 5).ok, false);
  });

  it('starts every round from zero', () => {
    const { engine, session, player } = counting();
    engine.count(session, player.id, 1);
    assert.ok(engine.reset(session, player.id).ok);
    assert.equal(player.freeCount, 0);
    assert.ok(engine.start(session, player.id).ok);
    assert.equal(player.freeCount, 0);
  });
});
