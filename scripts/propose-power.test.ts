import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script without type declarations
import { bucketFor, bestRank, tierRank } from './propose-power.mjs';

describe('propose-power', () => {
  it('ranks tiers on the ladder with Low/High shifts', () => {
    expect(tierRank('9-B')).toBeLessThan(tierRank('9-A'));
    expect(tierRank('High 7-C')).toBeGreaterThan(tierRank('7-C'));
    expect(tierRank('Low 7-C')).toBeLessThan(tierRank('7-C'));
    expect(tierRank('Unknown')).toBeNull();
  });

  it('takes the strongest listed form', () => {
    expect(bestRank(['9-B', '9-B', '9-B', '3-C'])).toBe(tierRank('3-C'));
    expect(bestRank(['Unknown'])).toBeNull();
  });

  it('buckets by threshold', () => {
    expect(bucketFor(tierRank('2-C')).name).toBe('S');
    expect(bucketFor(tierRank('6-B')).name).toBe('B');
    expect(bucketFor(tierRank('9-C')).name).toBe('D');
  });
});
