'use client';

import type { PublicPlayer, SessionSnapshot } from '@/lib/protocol';
import { MiniCard } from './BingoCard';
import { cx } from './ui';

function Tag({ children, tone = 'plain' }: { children: string; tone?: 'plain' | 'accent' }) {
  return (
    <span
      className={cx(
        'rounded px-1.5 py-px text-[0.625rem] tracking-wide uppercase',
        tone === 'accent' ? 'bg-accent text-accent-ink' : 'bg-faint text-muted',
      )}
    >
      {children}
    </span>
  );
}

/** Leaderboard while playing, plain join order in the lobby. */
function order(session: SessionSnapshot): PublicPlayer[] {
  if (session.status === 'lobby') return session.players;
  if (session.mode === 'endless') {
    return [...session.players].sort((a, b) => b.wins - a.wins || b.lines - a.lines);
  }
  const rank = (player: PublicPlayer) => {
    const won = session.winners.indexOf(player.id);
    return won >= 0 ? won : 1000 - player.lines;
  };
  return [...session.players].sort((a, b) => rank(a) - rank(b));
}

function progressOf(session: SessionSnapshot, player: PublicPlayer): string {
  if (session.mode === 'endless') {
    const lines = `${player.lines} ${player.lines === 1 ? 'Reihe' : 'Reihen'}`;
    return player.wins > 0
      ? `${player.wins} ${player.wins === 1 ? 'Bingo' : 'Bingos'} · ${lines}`
      : lines;
  }
  const place = session.winners.indexOf(player.id);
  return player.hasBingo
    ? `Bingo${place >= 0 ? ` · Platz ${place + 1}` : ''}`
    : `${player.lines} ${player.lines === 1 ? 'Reihe' : 'Reihen'}`;
}

export function PlayerList({
  session,
  meId,
  showProgress,
}: {
  session: SessionSnapshot;
  meId?: string;
  showProgress: boolean;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {order(session).map((player) => {
        const scored = session.mode === 'endless' ? player.wins > 0 : player.hasBingo;
        return (
          <li key={player.id} className="flex items-center gap-3 px-3 py-2.5">
            {showProgress && (
              <MiniCard stamps={player.stamps} size={session.size} highlight={scored} />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cx(
                    'truncate text-[0.95rem]',
                    player.connected ? 'text-ink' : 'text-muted line-through decoration-1',
                  )}
                >
                  {player.name}
                </span>
                {player.id === meId && <Tag>du</Tag>}
                {player.isHost && <Tag>host</Tag>}
              </div>
              {showProgress ? (
                <span className="label-xs">{progressOf(session, player)}</span>
              ) : (
                !player.connected && <span className="label-xs">offline</span>
              )}
            </div>
            {showProgress && scored && (
              <Tag tone="accent">
                {session.mode === 'endless' ? `${player.wins}×` : 'bingo'}
              </Tag>
            )}
          </li>
        );
      })}
    </ul>
  );
}
