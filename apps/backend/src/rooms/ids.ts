import { randomBytes, randomUUID } from 'node:crypto';
import { ROOM_CODE_LENGTH } from '@abb/shared';

// No 0/O/1/I so codes are easy to read aloud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ATTEMPTS = 100;

export function generateRoomCode(isTaken: (code: string) => boolean, random: () => number): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ALPHABET[Math.floor(random() * ALPHABET.length)];
    }
    if (!isTaken(code)) return code;
  }
  throw new Error('Could not generate a free room code');
}

export const newId = (): string => randomUUID();
export const newToken = (): string => randomBytes(16).toString('hex');
