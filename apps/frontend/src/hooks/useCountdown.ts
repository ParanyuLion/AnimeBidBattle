'use client';

import { useEffect, useState } from 'react';

/** Milliseconds left until `endsAt` (server time), given clockOffset = serverNow - Date.now(). */
export function useCountdown(endsAt: number, clockOffset: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, endsAt - (now + clockOffset));
}
