import { describe, expect, it } from 'vitest';
import {
  bidSchema,
  characterSchema,
  createRoomSchema,
  joinRoomSchema,
  nicknameSchema,
} from './schemas';

describe('nicknameSchema', () => {
  it('trims surrounding whitespace', () => {
    expect(nicknameSchema.parse('  Bob  ')).toBe('Bob');
  });

  it('rejects whitespace-only and over-long nicknames', () => {
    expect(nicknameSchema.safeParse('   ').success).toBe(false);
    expect(nicknameSchema.safeParse('').success).toBe(false);
    expect(nicknameSchema.safeParse('x'.repeat(21)).success).toBe(false);
  });
});

describe('joinRoomSchema', () => {
  it('normalizes a lowercase, padded room code', () => {
    const parsed = joinRoomSchema.parse({ roomCode: ' ab12c ', nickname: 'Bob' });
    expect(parsed.roomCode).toBe('AB12C');
  });

  it('rejects a room code of the wrong length', () => {
    expect(joinRoomSchema.safeParse({ roomCode: 'ABC', nickname: 'Bob' }).success).toBe(false);
  });
});

describe('createRoomSchema', () => {
  it('accepts a partial settings patch', () => {
    const parsed = createRoomSchema.parse({ nickname: 'Al', settings: { rounds: 5 } });
    expect(parsed.settings).toEqual({ rounds: 5 });
  });

  it('rejects non-integer settings', () => {
    expect(
      createRoomSchema.safeParse({ nickname: 'Al', settings: { rounds: 2.5 } }).success,
    ).toBe(false);
  });
});

describe('bidSchema', () => {
  it('accepts positive integers only', () => {
    expect(bidSchema.safeParse({ amount: 10 }).success).toBe(true);
    expect(bidSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(bidSchema.safeParse({ amount: -5 }).success).toBe(false);
    expect(bidSchema.safeParse({ amount: 1.5 }).success).toBe(false);
    expect(bidSchema.safeParse({ amount: '10' }).success).toBe(false);
    expect(bidSchema.safeParse({}).success).toBe(false);
  });
});

describe('characterSchema', () => {
  it('rejects negative power', () => {
    expect(
      characterSchema.safeParse({ id: 'a', name: 'A', anime: 'X', power: -1 }).success,
    ).toBe(false);
  });
});
