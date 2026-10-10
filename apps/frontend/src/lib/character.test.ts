import { describe, expect, it } from 'vitest';
import { characterImageUrl, initialsOf } from './character';

describe('characterImageUrl', () => {
  it('points at the static file named by the character id', () => {
    expect(characterImageUrl('son-goku')).toBe('/characters/son-goku.jpg');
  });

  it('encodes unsafe characters', () => {
    expect(characterImageUrl('a b/c')).toBe('/characters/a%20b%2Fc.jpg');
  });
});

describe('initialsOf', () => {
  it('uses the first letter of the first and last word', () => {
    expect(initialsOf('Monkey D. Luffy')).toBe('ML');
    expect(initialsOf('Son Goku')).toBe('SG');
  });

  it('handles a single word and a single letter', () => {
    expect(initialsOf('Saitama')).toBe('S');
    expect(initialsOf('L')).toBe('L');
  });

  it('falls back to a question mark for empty or whitespace names', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });
});
