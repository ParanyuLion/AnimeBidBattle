import type { PlayerView } from '@abb/shared';
import { characterImageUrl } from '../lib/character';
import { teamCombosOf } from '../lib/combos';
import { ComboChips } from './ComboChips';

/** A friend's team, shown while hovering (or focusing/tapping) their name. Power stays hidden until the Battle. */
export function TeamPopover({ player, showCombos }: { player: PlayerView; showCombos: boolean }) {
  return (
    <div className="team-pop" role="tooltip">
      <div className="team-pop-title">
        {player.nickname}&apos;s team ({player.team.length})
      </div>
      {player.team.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No characters yet.</p>
      ) : (
        <>
          {showCombos && <ComboChips combos={teamCombosOf(player.team)} />}
          <ul className="team-pop-list">
            {player.team.map((character) => (
              <li key={character.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={characterImageUrl(character.id)} alt="" loading="lazy" width={28} height={42} />
                <span>
                  <strong>{character.name}</strong>
                  <small className="muted">{character.anime}</small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
