'use client';

import { useEffect, useState } from 'react';
import { getVolume, isMuted, playBid, setMuted, setVolume, unlockAudio } from '../lib/sound';

/** Mute button and volume slider for the sound effects. */
export function SoundControls() {
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(0.8);

  useEffect(() => {
    setMutedState(isMuted());
    setVolumeState(getVolume());
  }, []);

  // The browser only allows sound after a gesture: unlock it on the first click or key press.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const silent = muted || volume === 0;

  return (
    <div className="audio-row" role="group" aria-label="Sound effects">
      <button
        type="button"
        className="sound-toggle"
        aria-pressed={muted}
        aria-label={silent ? 'Sound off, turn on' : 'Sound on, turn off'}
        onClick={() => {
          setMuted(!muted);
          setMutedState(!muted);
          unlockAudio();
        }}
      >
        {silent ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        className="volume-slider"
        aria-label="Sound volume"
        min={0}
        max={100}
        step={5}
        value={Math.round(volume * 100)}
        onChange={(e) => {
          const next = Number(e.target.value) / 100;
          setVolume(next);
          setVolumeState(next);
          if (muted && next > 0) {
            setMuted(false);
            setMutedState(false);
          }
        }}
        onPointerUp={() => {
          unlockAudio();
          playBid(); // a sample blip at the new volume
        }}
        onKeyUp={() => playBid()}
      />
    </div>
  );
}
