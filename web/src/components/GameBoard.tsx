'use client';

import { useEffect, useRef, useState } from 'react';

import type { PublicPlayer, SelfState, SessionSnapshot } from '@/lib/protocol';
import { connection } from '@/lib/useBingo';
import { BingoCard } from './BingoCard';
import { SourceTag } from './ListPicker';
import { PlayerList } from './PlayerList';
import { RoomShell } from './Room';
import { Button } from './ui';

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** How long a completed card stays on screen before the next one takes over. */
const CELEBRATION_MS = 1900;

export function GameBoard({ session, self }: { session: SessionSnapshot; self: SelfState }) {
  const isHost = session.hostId === self.playerId;
  const me = session.players.find((player) => player.id === self.playerId);
  const finished = session.status === 'finished';
  const endless = session.mode === 'endless';
  const place = session.winners.indexOf(self.playerId);
  const wins = me?.wins ?? 0;

  const celebrating = useCelebration(wins, self.card, me?.stamps);
  const board = celebrating ?? { card: self.card, stamps: me?.stamps ?? [] };

  const podium = endless
    ? [...session.players].filter((p) => p.wins > 0).sort((a, b) => b.wins - a.wins)
    : session.winners
        .map((id) => session.players.find((player) => player.id === id))
        .filter((player) => player !== undefined);

  return (
    <RoomShell
      code={session.code}
      wide
      aside={
        <>
          <section className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="label-xs">Runde {session.code}</span>
              <span className="label-xs">{finished ? 'beendet' : 'läuft'}</span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink">
              <span>{session.list.name}</span>
              <SourceTag source={session.list.source} />
              <span className="text-muted">
                {session.size} × {session.size} · {endless ? 'Endlos' : 'Wettlauf'}
              </span>
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <span className="label-xs">Mitspieler · {session.players.length}</span>
            <PlayerList session={session} meId={self.playerId} showProgress />
          </section>

          {isHost && (
            <section className="flex flex-col gap-2">
              {!finished && (
                <Button variant="outline" size="sm" onClick={() => connection.stop()}>
                  Runde beenden
                </Button>
              )}
              <Button size="sm" onClick={() => connection.reset()}>
                Neue Runde
              </Button>
            </section>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {(endless ? Boolean(celebrating) : me?.hasBingo) && (
          <div className="animate-rise flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3 text-accent-ink">
            <span className="font-mono text-sm tracking-[0.3em] uppercase">bingo</span>
            <span className="text-sm">
              {endless
                ? `${wins}. Bingo · gleich kommt eine neue Karte`
                : [
                    place >= 0 ? `Platz ${place + 1}` : '',
                    me?.bingoAt !== null && me?.bingoAt !== undefined
                      ? formatDuration(me.bingoAt)
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          </div>
        )}

        {finished && (
          <div className="animate-rise rounded-xl border border-line bg-surface p-4">
            <span className="label-xs block">Ergebnis</span>
            {podium.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Niemand hat ein Bingo geschafft.</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1">
                {podium.map((player: PublicPlayer, index: number) => (
                  <li key={player.id} className="flex items-baseline justify-between text-sm">
                    <span>
                      <span className="text-muted tabular-nums">{index + 1}.</span> {player.name}
                    </span>
                    <span className="text-muted tabular-nums">
                      {endless
                        ? `${player.wins}×`
                        : player.bingoAt !== null
                          ? formatDuration(player.bingoAt)
                          : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {!isHost && <p className="mt-3 text-xs text-muted">Der Host kann eine neue Runde starten.</p>}
          </div>
        )}

        {board.card ? (
          <BingoCard
            card={board.card}
            stamps={board.stamps}
            size={session.size}
            freeIndex={self.freeIndex}
            disabled={finished || Boolean(celebrating)}
            onToggle={(index, on) => connection.stamp(index, on)}
          />
        ) : (
          <p className="text-sm text-muted">Karte wird ausgeteilt …</p>
        )}

        <p className="text-center text-xs text-muted">
          {finished
            ? 'Die Runde ist beendet.'
            : celebrating
              ? 'Volle Reihe! Deine nächste Karte ist schon unterwegs.'
              : endless
                ? `Tippe ein Feld an, sobald der Begriff fällt. ${wins === 0 ? 'Noch kein Bingo.' : `${wins} Bingo${wins === 1 ? '' : 's'} bisher.`}`
                : me?.hasBingo
                  ? 'Du hast eine volle Reihe. Weiter geht’s trotzdem.'
                  : 'Tippe ein Feld an, sobald der Begriff fällt.'}
        </p>
      </div>
    </RoomShell>
  );
}

/**
 * In endless mode the server swaps the card the instant a line completes, which
 * would make the winning card vanish before anyone saw it. So we hold on to the
 * finished board for a moment and show that instead.
 */
function useCelebration(
  wins: number,
  card: string[] | null,
  stamps: boolean[] | undefined,
): { card: string[]; stamps: boolean[] } | null {
  const [frozen, setFrozen] = useState<{ card: string[]; stamps: boolean[] } | null>(null);
  const previous = useRef<{ card: string[]; stamps: boolean[] } | null>(null);
  const seenWins = useRef(wins);

  useEffect(() => {
    if (wins > seenWins.current && previous.current) {
      setFrozen(previous.current);
      const timer = setTimeout(() => setFrozen(null), CELEBRATION_MS);
      seenWins.current = wins;
      return () => clearTimeout(timer);
    }
    seenWins.current = wins;
  }, [wins]);

  // Runs after the effect above, so a win still sees the pre-swap board.
  useEffect(() => {
    if (card) previous.current = { card, stamps: stamps ?? [] };
  });

  return frozen;
}
