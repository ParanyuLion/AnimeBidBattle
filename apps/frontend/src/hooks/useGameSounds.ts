'use client';

import { useEffect, useRef } from 'react';
import type { RoomView } from '@abb/shared';
import { playBattleStart, playGameOver, playVictory } from '../lib/sound';

/** Plays the battle and end-of-game sounds when the phase changes (not when you re-enter a finished game). */
export function useGameSounds(room: RoomView | null) {
  const previousPhase = useRef<string | null>(null);
  const phase = room?.phase ?? null;

  useEffect(() => {
    const before = previousPhase.current;
    previousPhase.current = phase;
    if (!room || before === null || before === phase) return;
    if (phase === 'BATTLE') playBattleStart();
    if (phase === 'RESULTS') {
      const mine = room.results?.find((r) => r.playerId === room.youId);
      if (mine?.rank === 1) playVictory();
      else playGameOver();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
}
