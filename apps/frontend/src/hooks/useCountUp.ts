'use client';

import { useEffect, useState } from 'react';

/** Animates 0 -> target after a delay; jumps straight to the target when reduced motion is requested. */
export function useCountUp(target: number, durationMs: number, delayMs: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || durationMs <= 0) {
      setValue(target);
      return;
    }
    let frame = 0;
    let start = 0;
    const tick = (time: number) => {
      if (start === 0) start = time;
      const progress = Math.min(1, (time - start) / durationMs);
      setValue(Math.round(target * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs, delayMs]);

  return value;
}
