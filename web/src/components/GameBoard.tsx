'use client';

import type { SelfState, SessionSnapshot } from '@/lib/protocol';
import { connection } from '@/lib/useBingo';
import { BingoCard } from './BingoCard';
import { PlayerList } from './PlayerList';
import { RoomShell } from './Room';
import { Button } from './ui';

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function GameBoard({ session, self }: { session: SessionSnapshot; self: SelfState }) {
  const isHost = session.hostId === self.playerId;
  const me = session.players.find((player) => player.id === self.playerId);
  const finished = session.status === 'finished';
  const place = session.winners.indexOf(self.playerId);

  const podium = session.winners
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
            <p className="mt-1 text-sm text-ink">
              {session.listName} · {session.size} × {session.size}
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
        {me?.hasBingo && (
          <div className="animate-rise flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3 text-accent-ink">
            <span className="font-mono text-sm tracking-[0.3em] uppercase">bingo</span>
            <span className="text-sm">
              {place >= 0 ? `Platz ${place + 1}` : ''}
              {me.bingoAt !== null ? ` · ${formatDuration(me.bingoAt)}` : ''}
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
                {podium.map((player, index) => (
                  <li key={player.id} className="flex items-baseline justify-between text-sm">
                    <span>
                      <span className="text-muted tabular-nums">{index + 1}.</span> {player.name}
                    </span>
                    <span className="text-muted tabular-nums">
                      {player.bingoAt !== null ? formatDuration(player.bingoAt) : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {!isHost && <p className="mt-3 text-xs text-muted">Der Host kann eine neue Runde starten.</p>}
          </div>
        )}

        {self.card ? (
          <BingoCard
            card={self.card}
            stamps={me?.stamps ?? []}
            size={session.size}
            freeIndex={self.freeIndex}
            disabled={finished}
            onToggle={(index, on) => connection.stamp(index, on)}
          />
        ) : (
          <p className="text-sm text-muted">Karte wird ausgeteilt …</p>
        )}

        <p className="text-center text-xs text-muted">
          {finished
            ? 'Die Runde ist beendet.'
            : me?.hasBingo
              ? 'Du hast eine volle Reihe. Weiter geht’s trotzdem.'
              : 'Tippe ein Feld an, sobald der Begriff fällt.'}
        </p>
      </div>
    </RoomShell>
  );
}
