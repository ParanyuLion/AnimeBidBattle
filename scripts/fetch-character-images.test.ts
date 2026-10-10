import { describe, expect, it } from 'vitest';
import { animeMatches, nameScore, normalize, pickMatch } from './fetch-character-images.mjs';

describe('normalize', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normalize('Monkey D. Luffy')).toBe('monkey d luffy');
    expect(normalize('  One Punch-Man ')).toBe('one punch man');
    expect(normalize('Éclair')).toBe('eclair');
  });
});

describe('nameScore', () => {
  it('scores exact names as 1', () => {
    expect(nameScore('Monkey D. Luffy', ['Monkey D. Luffy'])).toBe(1);
  });

  it('tolerates romanisation differences (Gojo / Gojou)', () => {
    expect(nameScore('Satoru Gojo', ['Satoru Gojou'])).toBe(1);
  });

  it('scores partial names lower and prefers the tighter candidate for a one-letter name', () => {
    expect(nameScore('Son Goku', ['Goku'])).toBe(0.5);
    expect(nameScore('L', ['L Lawliet'])).toBe(0.5);
    expect(nameScore('L', ['L Lawliet', 'L'])).toBe(1);
  });

  it('returns 0 for unrelated names and for empty input', () => {
    expect(nameScore('Naruto Uzumaki', ['Light Yagami'])).toBe(0);
    expect(nameScore('', ['Anything'])).toBe(0);
  });
});

describe('animeMatches', () => {
  it('matches when a title contains the anime name or the reverse', () => {
    expect(animeMatches('Demon Slayer', [{ title: { english: 'Demon Slayer: Kimetsu no Yaiba' } }])).toBe(true);
    expect(animeMatches('One Punch Man', [{ title: { romaji: 'One Punch-Man' } }])).toBe(true);
    expect(animeMatches('Attack on Titan', [{ title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan' } }])).toBe(true);
  });

  it('rejects other franchises and tolerates missing titles', () => {
    expect(animeMatches('Naruto', [{ title: { romaji: 'Bleach' } }])).toBe(false);
    expect(animeMatches('Naruto', [{ title: {} }, {}])).toBe(false);
    expect(animeMatches('Naruto', [])).toBe(false);
  });
});

const luffy = { id: 'monkey-d-luffy', name: 'Monkey D. Luffy', anime: 'One Piece', power: 90 };

function candidate(id: number, full: string, anime: string, image: string | null = 'https://example.test/x.jpg') {
  return {
    id,
    name: { full, alternative: [] as string[] },
    image: image ? { large: image } : { large: null },
    media: { nodes: [{ title: { romaji: anime, english: anime } }] },
  };
}

describe('pickMatch', () => {
  it('picks the candidate from the right anime and reports an exact match', () => {
    const picked = pickMatch(luffy, [
      candidate(1, 'Monkey D. Luffy', 'Some Parody'),
      candidate(2, 'Monkey D. Luffy', 'One Piece'),
    ]);
    expect(picked?.candidate.id).toBe(2);
    expect(picked?.confidence).toBe('exact');
  });

  it('marks a partial name match for review', () => {
    const picked = pickMatch({ ...luffy, name: 'Son Goku', anime: 'Dragon Ball' }, [candidate(7, 'Goku', 'Dragon Ball')]);
    expect(picked?.confidence).toBe('review');
  });

  it('returns null when nothing matches or the match has no image', () => {
    expect(pickMatch(luffy, [candidate(3, 'Light Yagami', 'Death Note')])).toBeNull();
    expect(pickMatch(luffy, [candidate(4, 'Monkey D. Luffy', 'One Piece', null)])).toBeNull();
    expect(pickMatch(luffy, [])).toBeNull();
  });
});
