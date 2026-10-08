import { readFileSync } from 'node:fs';
import { characterSchema, type Character } from '@abb/shared';
import { z } from 'zod';

export interface CharacterSource {
  getAll(): Character[];
}

export class JsonCharacterSource implements CharacterSource {
  private readonly characters: Character[];

  constructor(raw: unknown) {
    const characters = z.array(characterSchema).parse(raw);
    const ids = new Set<string>();
    for (const character of characters) {
      if (ids.has(character.id)) {
        throw new Error(`Duplicate character id: ${character.id}`);
      }
      ids.add(character.id);
    }
    this.characters = characters;
  }

  static fromDefaultFile(): JsonCharacterSource {
    const url = new URL('../../../../data/characters.json', import.meta.url);
    return new JsonCharacterSource(JSON.parse(readFileSync(url, 'utf8')));
  }

  getAll(): Character[] {
    return [...this.characters];
  }
}
