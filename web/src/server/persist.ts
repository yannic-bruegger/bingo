/**
 * Keeps the rounds on disk so a restart (a deploy, a crash) doesn't end them.
 *
 * The engine stays purely in-memory; this only snapshots it: once at start-up
 * to restore, every few seconds while anything changed, and once more on the
 * way down. Clients already reconnect and re-take their seat on their own, so
 * a restart looks to them like any other dropped connection.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Engine } from './engine.ts';

const SAVE_EVERY_MS = 5_000;

export type Persistence = {
  /** Write now, synchronously — for shutdown. */
  flush(): void;
  stop(): void;
};

export function persistSessions(engine: Engine, file: string | undefined): Persistence {
  if (!file) return { flush() {}, stop() {} };

  try {
    const restored = engine.restore(JSON.parse(readFileSync(file, 'utf8')));
    console.log(`▪ restored ${restored} round(s) from ${file}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`could not restore rounds from ${file}`, error);
    }
  }

  let last = '';
  const flush = () => {
    // savedAt changes every time, so compare the sessions only.
    const state = engine.save();
    const sessions = JSON.stringify(state.sessions);
    if (sessions === last) return;
    try {
      mkdirSync(dirname(file), { recursive: true });
      // Write aside, then rename: a crash mid-write never leaves half a file.
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify(state));
      renameSync(tmp, file);
      last = sessions;
    } catch (error) {
      console.error(`could not save rounds to ${file}`, error);
    }
  };

  const timer = setInterval(flush, SAVE_EVERY_MS);
  timer.unref();
  return {
    flush,
    stop: () => clearInterval(timer),
  };
}
