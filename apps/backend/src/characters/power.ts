import type { Character } from '@abb/shared';

/** The single place that decides how strong a character is. Replace the body to change the formula. */
export function computePower(character: Character): number {
  return character.power;
}

export function teamPower(team: readonly Character[]): number {
  return team.reduce((sum, character) => sum + computePower(character), 0);
}
