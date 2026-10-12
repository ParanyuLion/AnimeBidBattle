// Background music shared by everyone in a room: the tracks in /music/playlist.json play in a loop, and the room's
// shared clock (seed + start time from the server) decides which track and position every player hears right now.
// Volume and mute are local and separate from the sound effects.

export interface Track {
  title: string;
  file: string;
  /** Length in seconds (written by scripts/music-durations.mjs); needed to work out the shared position. */
  seconds: number;
}

export interface MusicSync {
  seed: number;
  startedAt: number;
}

export interface MusicPosition {
  index: number;
  /** Seconds into that track. */
  offset: number;
  /** Seconds until that track ends. */
  remaining: number;
}

/** Which track and position the shared clock puts the room at, `serverNow` ms after the room's music started. */
export function musicPosition(tracks: readonly Track[], sync: MusicSync, serverNow: number): MusicPosition {
  const total = tracks.reduce((sum, t) => sum + t.seconds, 0);
  const first = tracks.length === 0 ? 0 : sync.seed % tracks.length;
  if (tracks.length === 0 || total <= 0) return { index: 0, offset: 0, remaining: 0 };
  let position = (Math.max(0, serverNow - sync.startedAt) / 1000) % total;
  for (let step = 0; step < tracks.length; step++) {
    const index = (first + step) % tracks.length;
    const length = tracks[index]!.seconds;
    if (position < length) return { index, offset: position, remaining: length - position };
    position -= length;
  }
  return { index: first, offset: 0, remaining: tracks[first]!.seconds };
}

const VOLUME_KEY = 'abb:music-volume';
const MUTED_KEY = 'abb:music-muted';
const DEFAULT_VOLUME = 0.4;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable; the choice just lasts for this visit
  }
}

let tracks: Track[] = [];
let index = 0;
let audio: HTMLAudioElement | null = null;
let loading: Promise<void> | null = null;
let playing = false;
let sync: MusicSync | null = null;
let serverNow: () => number = () => Date.now();
let retry: ReturnType<typeof setTimeout> | null = null;
let attempt = 0; // ignores stale load callbacks when resync runs again before a track finished loading
let driftCheck: ReturnType<typeof setInterval> | null = null;
let volume = (() => {
  const stored = read(VOLUME_KEY);
  const value = stored === null ? DEFAULT_VOLUME : Number(stored);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
})();
let muted = read(MUTED_KEY) === '1';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeMusic(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMusicVolume(): number {
  return volume;
}

export function isMusicMuted(): boolean {
  return muted;
}

export function isMusicPlaying(): boolean {
  return playing;
}

/** Title of the current track, or null when nothing is playing (no files, or not started yet). */
export function getNowPlaying(): string | null {
  return playing ? (tracks[index]?.title ?? null) : null;
}

function applyVolume() {
  if (audio) audio.volume = muted ? 0 : volume * volume; // squared so the slider feels even to the ear
}

export function setMusicVolume(value: number): void {
  volume = Math.min(1, Math.max(0, value));
  write(VOLUME_KEY, String(volume));
  applyVolume();
  emit();
}

export function setMusicMuted(value: boolean): void {
  muted = value;
  write(MUTED_KEY, value ? '1' : '0');
  applyVolume();
  emit();
}

async function loadPlaylist(): Promise<void> {
  try {
    const response = await fetch('/music/playlist.json');
    const list = (await response.json()) as Track[];
    tracks = Array.isArray(list)
      ? list.filter((t) => t && typeof t.file === 'string' && typeof t.title === 'string' && Number(t.seconds) > 0)
      : [];
  } catch {
    tracks = [];
  }
}

/** Jumps to wherever the shared clock says the room is now. */
function resync() {
  if (!audio || !sync || tracks.length === 0) return;
  if (retry) clearTimeout(retry);
  const here = musicPosition(tracks, sync, serverNow());
  const track = tracks[here.index]!;
  const url = `/music/${encodeURIComponent(track.file)}`;
  const changed = index !== here.index || !audio.src.endsWith(url);
  index = here.index;
  applyVolume();
  const mine = ++attempt;

  const seekAndPlay = () => {
    if (mine !== attempt) return;
    audio!.currentTime = here.offset;
    audio!.play().then(
      () => {
        playing = true;
        emit();
      },
      () => {
        // blocked by the browser (no user gesture yet): stay idle; the next click or key press retries
        playing = false;
        emit();
      },
    );
  };
  if (changed) {
    audio.src = url;
    audio.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    audio.load();
  } else {
    seekAndPlay();
  }
  // If this track never plays (missing file), try again when the shared clock reaches the next one.
  retry = setTimeout(resync, here.remaining * 1000 + 250);
}

/**
 * Starts the music for a room (needs a user gesture to be allowed by the browser). Safe to call repeatedly.
 * `getServerNow` returns the current server time in ms.
 */
export async function startMusic(roomSync: MusicSync, getServerNow: () => number): Promise<void> {
  if (typeof window === 'undefined') return;
  sync = roomSync;
  serverNow = getServerNow;
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('ended', resync);
    audio.addEventListener('error', () => {
      playing = false;
      emit();
    });
  }
  loading ??= loadPlaylist();
  await loading;
  if (tracks.length === 0) return;
  if (!driftCheck) {
    // Keep players together: if this one drifted more than 2 seconds from the shared clock, snap back.
    driftCheck = setInterval(() => {
      if (!audio || !sync || !playing || audio.paused) return;
      const here = musicPosition(tracks, sync, serverNow());
      if (here.index !== index || Math.abs(audio.currentTime - here.offset) > 2) resync();
    }, 10_000);
  }
  if (!playing || audio.paused) resync();
}
