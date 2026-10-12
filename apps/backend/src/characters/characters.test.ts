import { describe, expect, it } from 'vitest';
import type { Character } from '@abb/shared';
import { computePower, teamBreakdown, teamPower } from './power';
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

describe('teamBreakdown (series combo)', () => {
  const op = (id: string, power: number): Character => ({ id, name: id, anime: 'One Piece', power });
  const jjk = (id: string, power: number): Character => ({ id, name: id, anime: 'Jujutsu Kaisen', power });

  it('adds nothing when the setting is off', () => {
    expect(teamBreakdown([op('a', 50), op('b', 50)], false)).toEqual({
      basePower: 100,
      comboBonus: 0,
      totalPower: 100,
      combos: [],
      bonuses: {},
    });
  });

  it('gives no bonus for a single character per anime', () => {
    expect(teamBreakdown([op('a', 50), jjk('b', 50)], true).comboBonus).toBe(0);
  });

  it('adds 10% per extra same-anime character, applied to that anime only', () => {
    const two = teamBreakdown([op('a', 50), op('b', 50), jjk('c', 40)], true);
    expect(two).toMatchObject({ basePower: 140, comboBonus: 10, totalPower: 150 });
    expect(two.combos).toEqual([{ anime: 'One Piece', count: 2, percent: 10 }]);
    const three = teamBreakdown([op('a', 50), op('b', 50), op('c', 50)], true);
    expect(three).toMatchObject({ comboBonus: 30, totalPower: 180 }); // 150 * 20%
    expect(three.bonuses).toEqual({ a: 10, b: 10, c: 10 });
  });

  it('caps the bonus at 50% and combines several anime', () => {
    const six = Array.from({ length: 7 }, (_, i) => op(`o${i}`, 10)); // 7 chars => 60% capped to 50%
    expect(teamBreakdown(six, true)).toMatchObject({ basePower: 70, comboBonus: 35, totalPower: 105 });
    const both = teamBreakdown([op('a', 10), op('b', 10), jjk('c', 20), jjk('d', 20)], true);
    expect(both.combos).toHaveLength(2);
    expect(both.comboBonus).toBe(2 + 4);
  });

  it('lists the bonus per character and the per-character bonuses add up to the team bonus', () => {
    const team = [op('a', 47), op('b', 33), op('c', 20), jjk('d', 90)];
    const result = teamBreakdown(team, true); // 3 One Piece => +20% each; the lone jjk gets nothing
    expect(result.bonuses).toEqual({ a: 9, b: 7, c: 4 }); // 9.4, 6.6, 4.0 rounded
    expect(Object.values(result.bonuses).reduce((a, b) => a + b, 0)).toBe(result.comboBonus);
    expect(result.bonuses.d).toBeUndefined();
  });

  it('is 0 for an empty team', () => {
    expect(teamBreakdown([], true)).toEqual({ basePower: 0, comboBonus: 0, totalPower: 0, combos: [], bonuses: {} });
  });
});
