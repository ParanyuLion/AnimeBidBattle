import type { ComboView } from '@abb/shared';

/** The series combos a team has earned, e.g. "Jujutsu Kaisen ×3 +20%". */
export function ComboChips({ combos, label }: { combos: ComboView[]; label?: string }) {
  if (combos.length === 0) return null;
  return (
    <div className="combo-chips" aria-label={label ?? 'Series combos'}>
      {combos.map((combo) => (
        <span className="combo-chip" key={combo.anime}>
          {combo.anime} ×{combo.count} <b>+{combo.percent}%</b>
        </span>
      ))}
    </div>
  );
}
