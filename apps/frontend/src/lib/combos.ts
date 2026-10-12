import { comboPercent, type CharacterView, type ComboView } from '@abb/shared';

/** The series combos a team currently has (same-anime groups of 2+), biggest first. */
export function teamCombosOf(team: readonly CharacterView[]): ComboView[] {
  const counts = new Map<string, number>();
  for (const character of team) counts.set(character.anime, (counts.get(character.anime) ?? 0) + 1);
  return [...counts]
    .filter(([, count]) => comboPercent(count) > 0)
    .map(([anime, count]) => ({ anime, count, percent: comboPercent(count) }))
    .sort((a, b) => b.count - a.count || a.anime.localeCompare(b.anime));
}
