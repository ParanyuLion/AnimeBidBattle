'use client';

import { useEffect, useRef, useState } from 'react';
import type { MusicSync } from '@abb/shared';
import {
  getMusicVolume,
  getNowPlaying,
  isMusicMuted,
  setMusicMuted,
  setMusicVolume,
  startMusic,
  subscribeMusic,
} from '../lib/music';

interface Props {
  /** The room's shared music clock, so everyone hears the same track at the same point. */
  sync: MusicSync;
  /** serverNow - Date.now(), to turn this device's clock into server time. */
  clockOffset: number;
}

/** Music mute button and volume slider. Music starts on the first click or key press. */
export function MusicControls({ sync, clockOffset }: Props) {
  const [, refresh] = useState(0);
  const offsetRef = useRef(clockOffset);
  offsetRef.current = clockOffset;
  const play = () => void startMusic(sync, () => Date.now() + offsetRef.current);
  const muted = isMusicMuted();
  const volume = getMusicVolume();
  const title = getNowPlaying();

  useEffect(() => subscribeMusic(() => refresh((n) => n + 1)), []);

  // Browsers only allow audio after a gesture, so start on the first click or key press.
  useEffect(() => {
    const start = () => play();
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [sync.seed, sync.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const silent = muted || volume === 0;

  return (
    <div className="audio-row" role="group" aria-label="Music">
      <button
        type="button"
        className="sound-toggle"
        aria-pressed={muted}
        aria-label={silent ? 'Music off, turn on' : 'Music on, turn off'}
        onClick={() => {
          setMusicMuted(!muted);
          play();
        }}
      >
        {silent ? '🔇' : '🎵'}
      </button>
      <input
        type="range"
        className="volume-slider"
        aria-label="Music volume"
        min={0}
        max={100}
        step={5}
        value={Math.round(volume * 100)}
        onChange={(e) => {
          const next = Number(e.target.value) / 100;
          setMusicVolume(next);
          if (muted && next > 0) setMusicMuted(false);
          play();
        }}
      />
      {title && (
        <span className="now-playing" title={title}>
          {title}
        </span>
      )}
    </div>
  );
}
