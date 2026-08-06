'use client';

import { useState } from 'react';

import {
  SIZES,
  wordsNeeded,
  type GameMode,
  type SelfState,
  type SessionSnapshot,
} from '@/lib/protocol';
import { connection, useBingo } from '@/lib/useBingo';
import { ListPicker, SourceTag } from './ListPicker';
import { PlayerList } from './PlayerList';
import { RoomShell } from './Room';
import { Button, Field, Segmented } from './ui';

export function Lobby({ session, self }: { session: SessionSnapshot; self: SelfState }) {
  const { lists } = useBingo();
  const isHost = session.hostId === self.playerId;
  const [copied, setCopied] = useState(false);
  const enough = session.list.count >= wordsNeeded(session.size);

  const share = async () => {
    const url = `${window.location.origin}/s/${session.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Bingo', text: `Spiel-ID ${session.code}`, url });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  };

  return (
    <RoomShell code={session.code}>
      <div className="flex flex-col gap-6">
        <section className="animate-rise rounded-2xl border border-line bg-surface p-5">
          <span className="label-xs block">Spiel-ID</span>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="font-mono text-[2rem] leading-none tracking-[0.18em] tabular-nums">
              {session.code}
            </span>
            <Button variant="outline" size="sm" onClick={share}>
              {copied ? 'Kopiert' : 'Teilen'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Teile die ID — alle mit dieser Nummer spielen in derselben Runde.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <span className="label-xs">
            Mitspieler · {session.players.length}
          </span>
          <PlayerList session={session} meId={self.playerId} showProgress={false} />
        </section>

        {isHost ? (
          <section className="flex flex-col gap-5">
            <Field label="Wortliste">
              <ListPicker
                shared={lists}
                activeId={session.list.id}
                size={session.size}
                onPick={(list) => connection.configure({ list })}
              />
            </Field>

            <Field label="Modus">
              <Segmented<GameMode>
                columns={1}
                value={session.mode}
                onChange={(mode) => connection.configure({ mode })}
                options={[
                  {
                    value: 'race',
                    label: 'Wettlauf',
                    hint: 'Wer zuerst eine Reihe voll hat, steht oben',
                  },
                  {
                    value: 'endless',
                    label: 'Endlos',
                    hint: 'Bingo zählt einen Punkt und bringt sofort eine neue Karte',
                  },
                ]}
              />
            </Field>

            <Field label="Kartengröße">
              <Segmented
                value={session.size}
                onChange={(size) => connection.configure({ size })}
                options={SIZES.map((size) => ({
                  value: size,
                  label: `${size} × ${size}`,
                  hint: `${wordsNeeded(size)} Wörter`,
                }))}
              />
            </Field>

            <Button onClick={() => connection.start()} disabled={!enough}>
              Spiel starten
            </Button>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-line p-5 text-center">
            <p className="flex items-center justify-center gap-1.5 text-sm text-muted">
              <span>{session.list.name}</span>
              <SourceTag source={session.list.source} />
              <span>
                · {session.size} × {session.size} ·{' '}
                {session.mode === 'endless' ? 'Endlos' : 'Wettlauf'}
              </span>
            </p>
            <p className="mt-1 text-sm text-ink">Warten auf den Host …</p>
          </section>
        )}
      </div>
    </RoomShell>
  );
}
