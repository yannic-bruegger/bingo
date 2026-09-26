'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { readName } from '@/lib/connection';
import { connection, useBingo } from '@/lib/useBingo';
import { GameBoard } from './GameBoard';
import { Lobby } from './Lobby';
import { ConnectionDot } from './Notices';
import { Button, TextField, Wordmark } from './ui';

export function Room({ code }: { code: string }) {
  const router = useRouter();
  const { session, self, pending, formError, status } = useBingo();
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const tried = useRef(false);

  // Deep link or reload: re-take the seat we stored for this room, if any.
  useEffect(() => {
    const stored = readName();
    setName(stored);
    if (tried.current) return;
    tried.current = true;
    if (connection.getSnapshot().session?.code === code) return;
    if (!connection.resume(code, stored)) setNeedName(true);
  }, [code]);

  const inRoom = session?.code === code && self;

  if (inRoom) {
    return session.status === 'lobby' ? (
      <Lobby session={session} self={self} />
    ) : (
      <GameBoard session={session} self={self} />
    );
  }

  const askForName = needName || Boolean(formError);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <header className="flex items-baseline justify-between">
        <Wordmark />
        <ConnectionDot />
      </header>

      <div className="animate-rise flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
        <div>
          <span className="label-xs block">Runde</span>
          <span className="font-mono text-2xl tracking-[0.2em] tabular-nums">{code}</span>
        </div>

        {askForName ? (
          <>
            <TextField
              label="Dein Name"
              value={name}
              maxLength={20}
              autoFocus
              placeholder="z. B. Yannic"
              onChange={(event) => {
                setName(event.target.value);
                connection.clearFormError();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && name.trim()) connection.join(code, name.trim());
              }}
            />
            {formError && (
              <p className="text-sm text-accent" role="alert">
                {formError}
              </p>
            )}
            <Button disabled={!name.trim() || pending} onClick={() => connection.join(code, name.trim())}>
              Beitreten
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">
            {status === 'offline' ? 'Verbindung unterbrochen — neuer Versuch läuft …' : 'Verbinde …'}
          </p>
        )}

        <button
          type="button"
          onClick={() => router.push('/')}
          className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          Zurück zum Start
        </button>
      </div>
    </main>
  );
}

/** Shared chrome for lobby and game. */
export function RoomShell({
  code,
  children,
  aside,
  wide,
}: {
  code: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();

  const leave = () => {
    connection.leave();
    router.push('/');
  };

  return (
    <main
      className={`mx-auto flex min-h-dvh w-full flex-col gap-6 px-5 py-6 ${wide ? 'max-w-5xl' : 'max-w-sm'}`}
    >
      <header className="flex items-center justify-between gap-4">
        <Wordmark />
        <div className="flex items-center gap-4">
          <ConnectionDot />
          <button
            type="button"
            onClick={leave}
            className="label-xs hover:text-ink"
            title={`Runde ${code} verlassen`}
          >
            verlassen
          </button>
        </div>
      </header>

      {aside ? (
        <div className="grid flex-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">{children}</div>
          <div className="flex flex-col gap-4">{aside}</div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center">{children}</div>
      )}
    </main>
  );
}
