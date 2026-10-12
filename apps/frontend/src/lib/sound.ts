// Tiny synthesized sound effects (Web Audio), so the game needs no audio files.
// Browsers only allow audio after a user gesture, so sounds stay silent until the player has clicked or pressed a key.

const STORAGE_KEY = 'abb:muted';
const VOLUME_KEY = 'abb:volume';
let context: AudioContext | null = null;
let muted = readMuted();
let volume = readVolume();

function readVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const value = stored === null ? 0.8 : Number(stored);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.8;
  } catch {
    return 0.8;
  }
}

/** Master volume, 0 (silent) to 1 (full). */
export function getVolume(): number {
  return volume;
}

export function setVolume(value: number): void {
  volume = Math.min(1, Math.max(0, value));
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // storage unavailable; the choice just lasts for this visit
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // storage unavailable; the choice just lasts for this visit
  }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume();
    return context.state === 'running' || context.state === 'suspended' ? context : null;
  } catch {
    return null;
  }
}

function tone(frequency: number, durationMs: number, type: OscillatorType, volumeScale: number, startOffsetMs = 0, endFrequency?: number): void {
  const ctx = audio();
  if (!ctx || muted || volume === 0) return;
  const level = volume * volume * 1.5 * volumeScale; // squared so the slider feels even; the default 0.8 is about the original loudness and 1.0 is 1.5x louder
  const start = ctx.currentTime + startOffsetMs / 1000;
  const end = start + durationMs / 1000;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

/** Pressing a bid key: a short rising two-note blip. */
export function playBid(): void {
  tone(660, 90, 'square', 0.08);
  tone(990, 110, 'square', 0.08, 70);
}

/**
 * Countdown pressure for the last 5 seconds. Each second is louder, higher and denser than the one before:
 * a tick plus a low heartbeat thump, a double thump from 3s, and a soft rising siren with two alarm beeps on the last second.
 */
export function playTick(secondsLeft: number): void {
  const intensity = Math.min(0.8, (6 - Math.min(5, Math.max(1, secondsLeft))) / 5); // 5s -> 0.2 ... 2s -> 0.8, capped so the last second is not harsh
  tone(520 + 380 * intensity, 90, 'square', 0.05 + 0.07 * intensity);
  tone(95, 190, 'sine', 0.22 + 0.22 * intensity, 0, 42); // low thump
  if (secondsLeft <= 3) tone(95, 170, 'sine', 0.2 + 0.2 * intensity, 150, 42); // heartbeat double
  if (secondsLeft <= 2) tone(1100 + 300 * intensity, 70, 'sawtooth', 0.05 + 0.05 * intensity, 300);
  if (secondsLeft <= 1) {
    tone(600, 700, 'sawtooth', 0.05, 0, 1300); // softer rising siren
    for (const offset of [0, 300]) tone(1700, 90, 'square', 0.06, offset);
  }
}

/** The round just ended: a heavy hit, brighter and with a chime when sold, flat and falling when nobody bid. */
export function playTimeUp(sold: boolean): void {
  tone(110, 450, 'sine', 0.4, 0, 38); // impact
  tone(70, 300, 'triangle', 0.25, 0, 35);
  if (sold) {
    tone(784, 220, 'triangle', 0.1, 120);
    tone(1175, 420, 'triangle', 0.1, 260);
  } else {
    tone(330, 500, 'triangle', 0.1, 120, 150);
  }
}

/** Battle begins and powers are revealed: a rising swell with an accelerating pulse. */
export function playBattleStart(): void {
  tone(70, 2000, 'sawtooth', 0.1, 0, 420);
  [0, 420, 780, 1080, 1330, 1530, 1700, 1850].forEach((offset, i) => tone(600 + i * 40, 70, 'square', 0.05 + i * 0.006, offset));
}

/** You won (or tied for first): a rising major fanfare that ends on a held chord. */
export function playVictory(): void {
  [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, 200, 'triangle', 0.2, i * 150));
  [523, 659, 784, 1047].forEach((frequency) => tone(frequency, 1100, 'triangle', 0.14, 650));
  tone(262, 1100, 'sine', 0.2, 650);
  tone(1568, 700, 'sine', 0.08, 800);
}

/** The game is over and you did not win: a calm falling phrase. */
export function playGameOver(): void {
  [392, 349, 330, 262].forEach((frequency, i) => tone(frequency, 330, 'triangle', 0.16, i * 280));
  tone(131, 900, 'sine', 0.18, 1000);
}

/** Call from a click/keypress so the browser lets later sounds play. */
export function unlockAudio(): void {
  audio();
}
