'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { CodeInput } from '@/components/CodeInput';
import { ConnectionDot } from '@/components/Notices';
import { Button, Divider, TextField, Wordmark } from '@/components/ui';
import { readName } from '@/lib/connection';
import { CODE_LENGTH } from '@/lib/protocol';
import { connection, useBingo } from '@/lib/useBingo';

export default function HomePage() {
  const router = useRouter();
  const { pending, formError, lists, session } = useBingo();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    setName(readName());
  }, []);

  const ready = name.trim().length > 0;
  const enter = useCallback((joined: string) => router.push(`/s/${joined}`), [router]);

  const join = useCallback(
    (value: string) => {
      if (!ready || value.length !== CODE_LENGTH) return;
      connection.join(value, name.trim(), enter);
    },
    [ready, name, enter],
  );

  const create = () => {
    if (!ready) return;
    connection.create(name.trim(), lists[0]?.id ?? 'th-koeln', 5, enter);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <header className="flex items-baseline justify-between">
        <Wordmark />
        <ConnectionDot />
      </header>

      <div className="animate-rise flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
        <TextField
          label="Dein Name"
          value={name}
          maxLength={20}
          placeholder="z. B. Yannic"
          autoComplete="nickname"
          onChange={(event) => {
            setName(event.target.value);
            connection.clearFormError();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') join(code);
          }}
        />

        <div>
          <span className="label-xs mb-2 block">Spiel-ID</span>
          <CodeInput
            value={code}
            onChange={(value) => {
              setCode(value);
              connection.clearFormError();
            }}
            onComplete={join}
            disabled={pending}
          />
        </div>

        {formError && (
          <p className="animate-rise text-sm text-accent" role="alert">
            {formError}
          </p>
        )}

        <Button onClick={() => join(code)} disabled={!ready || code.length !== CODE_LENGTH || pending}>
          Runde beitreten
        </Button>

        <Divider>oder</Divider>

        <Button variant="outline" onClick={create} disabled={!ready || pending}>
          Neue Runde erstellen
        </Button>

        {!ready && <p className="text-center text-xs text-muted">Gib zuerst deinen Namen ein.</p>}
      </div>

      {session && (
        <button
          type="button"
          onClick={() => router.push(`/s/${session.code}`)}
          className="text-center text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          Zurück zu Runde {session.code}
        </button>
      )}

      <p className="text-center text-xs text-muted">
        Keine Anmeldung. Alles läuft live über eine offene Verbindung.
      </p>
    </main>
  );
}
