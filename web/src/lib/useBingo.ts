'use client';

import { useSyncExternalStore } from 'react';

import { connection, type BingoState } from './connection';

export function useBingo(): BingoState {
  return useSyncExternalStore(
    connection.subscribe,
    connection.getSnapshot,
    connection.getServerSnapshot,
  );
}

export { connection };
