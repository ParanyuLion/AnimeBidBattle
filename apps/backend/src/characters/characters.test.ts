import { describe, expect, it } from 'vitest';
import type { Character } from '@abb/shared';
import { computePower, teamPower } from './power';
import { JsonCharacterSource } from './source';

const a: Character = { id: 'a', name: 'A', anime: 'X', power: 10 };
const b: Character = { id: 'b', name: 'B', anime: 'X', power: 25 };

describe('power', () => {
  it('computePower returns the character power', () => {
    expect(computePower(a)).toBe(10);
  });

  it('teamPower sums computePower over the team and is 0 for an empty team', () => {
    expect(teamPower([a, b])).toBe(35);
    expect(teamPower([])).toBe(0);
  });
});

describe('JsonCharacterSource', () => {
  it('loads and validates the default data file', () => {
    const all = JsonCharacterSource.fromDefaultFile().getAll();
    expect(all.length).toBeGreaterThanOrEqual(30);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });

  it('rejects duplicate ids', () => {
    expect(() => new JsonCharacterSource([a, a])).toThrow(/duplicate/i);
  });

  it('rejects invalid entries', () => {
    expect(() => new JsonCharacterSource([{ id: 'x' }])).toThrow();
    expect(() => new JsonCharacterSource('nope')).toThrow();
  });

  it('getAll returns a copy', () => {
    const source = new JsonCharacterSource([a, b]);
    source.getAll().pop();
    expect(source.getAll()).toHaveLength(2);
  });
});
