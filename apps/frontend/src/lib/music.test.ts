import { describe, expect, it } from 'vitest';
import { musicPosition, type Track } from './music';

const tracks: Track[] = [
  { title: 'A', file: 'a.mp3', seconds: 100 },
  { title: 'B', file: 'b.mp3', seconds: 60 },
  { title: 'C', file: 'c.mp3', seconds: 40 },
];

describe('musicPosition (shared room music clock)', () => {
  it('starts at the track chosen by the seed, from its beginning', () => {
    expect(musicPosition(tracks, { seed: 0, startedAt: 1000 }, 1000)).toMatchObject({ index: 0, offset: 0 });
    expect(musicPosition(tracks, { seed: 4, startedAt: 1000 }, 1000)).toMatchObject({ index: 1, offset: 0 }); // 4 % 3
  });

  it('moves through the tracks in order and loops back, wrapping from the starting track', () => {
    const sync = { seed: 1, startedAt: 0 }; // order: B(60) C(40) A(100) then B again
    expect(musicPosition(tracks, sync, 30_000)).toMatchObject({ index: 1, offset: 30, remaining: 30 });
    expect(musicPosition(tracks, sync, 70_000)).toMatchObject({ index: 2, offset: 10, remaining: 30 });
    expect(musicPosition(tracks, sync, 150_000)).toMatchObject({ index: 0, offset: 50, remaining: 50 });
    expect(musicPosition(tracks, sync, 200_000)).toMatchObject({ index: 1, offset: 0 }); // full loop = 200s
    expect(musicPosition(tracks, sync, 230_000)).toMatchObject({ index: 1, offset: 30 });
  });

  it('gives every player the same answer for the same server time', () => {
    const sync = { seed: 7, startedAt: 5_000 };
    expect(musicPosition(tracks, sync, 123_456)).toEqual(musicPosition(tracks, sync, 123_456));
  });

  it('treats a time before the start as the start, and handles an empty playlist', () => {
    expect(musicPosition(tracks, { seed: 0, startedAt: 9_000 }, 1_000)).toMatchObject({ index: 0, offset: 0 });
    expect(musicPosition([], { seed: 3, startedAt: 0 }, 50_000)).toEqual({ index: 0, offset: 0, remaining: 0 });
  });
});
