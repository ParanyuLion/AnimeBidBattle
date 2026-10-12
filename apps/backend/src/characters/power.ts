import { comboPercent, type Character, type ComboView } from '@abb/shared';

/** The single place that decides how strong a character is. Replace the body to change the formula. */
export function computePower(character: Character): number {
  return character.power;
}

export function teamPower(team: readonly Character[]): number {
  return team.reduce((sum, character) => sum + computePower(character), 0);
}

export interface TeamBreakdown {
  basePower: number;
  comboBonus: number;
  totalPower: number;
  combos: ComboView[];
  /** Combo power added to each character, by character id (only characters that got a bonus). */
  bonuses: Record<string, number>;
}

/** Team power with the optional series combo: each anime with 2+ characters gets a percent bonus on its own power. */
export function teamBreakdown(team: readonly Character[], seriesCombo: boolean): TeamBreakdown {
  const basePower = teamPower(team);
  if (!seriesCombo) return { basePower, comboBonus: 0, totalPower: basePower, combos: [], bonuses: {} };

  const byAnime = new Map<string, Character[]>();
  for (const character of team) {
    byAnime.set(character.anime, [...(byAnime.get(character.anime) ?? []), character]);
  }
  const combos: ComboView[] = [];
  const bonuses: Record<string, number> = {};
  let comboBonus = 0;
  for (const [anime, members] of byAnime) {
    const percent = comboPercent(members.length);
    if (percent === 0) continue;
    combos.push({ anime, count: members.length, percent });
    // rounded per character so the numbers shown on each card add up exactly to the team's bonus
    for (const member of members) {
      const bonus = Math.round((computePower(member) * percent) / 100);
      if (bonus > 0) bonuses[member.id] = bonus;
      comboBonus += bonus;
    }
  }
  combos.sort((a, b) => b.count - a.count || a.anime.localeCompare(b.anime));
  return { basePower, comboBonus, totalPower: basePower + comboBonus, combos, bonuses };
}
