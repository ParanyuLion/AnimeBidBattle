'use client';

import type { RoomView } from '@abb/shared';
import { useCountUp } from '../hooks/useCountUp';
import { CharacterCard } from './CharacterCard';
import { Readout } from './Readout';

function Total({ value, delayMs }: { value: number; delayMs: number }) {
  const shown = useCountUp(value, 1200, delayMs);
  return <Readout label="Total power" value={String(shown)} tone="gold" size="lg" />;
}

export function Battle({ room }: { room: RoomView }) {
  const results = room.results ?? [];
  return (
    <div className="stack">
      <header className="center">
        <h1>Battle!</h1>
        <p className="muted">Powers revealed — comparing teams…</p>
      </header>
      {results.map((result, index) => {
        const player = room.players.find((p) => p.id === result.playerId);
        // the strongest team is revealed last
        const delayMs = (results.length - 1 - index) * 500;
        return (
          <section key={result.playerId} className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{result.nickname}</strong>
              <Total value={result.totalPower} delayMs={delayMs} />
            </div>
            {player && player.team.length > 0 ? (
              <div className="cards-row" style={{ marginTop: 12 }}>
                {player.team.map((character) => (
                  <CharacterCard key={character.id} character={character} size="sm" />
                ))}
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>No characters</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
