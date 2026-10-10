import type { RoomView } from '@abb/shared';
import { CharacterCard } from './CharacterCard';

export function Results({ room, onPlayAgain }: { room: RoomView; onPlayAgain: () => void }) {
  const results = room.results ?? [];
  const winners = results.filter((r) => r.rank === 1);
  const isHost = room.youId === room.hostId;

  return (
    <div className="stack">
      <header className="center">
        <h1>
          {winners.length > 0 ? `${winners.map((w) => w.nickname).join(' & ')} ${winners.length > 1 ? 'tie!' : 'wins!'}` : 'Game over'}
        </h1>
      </header>
      {results.map((result) => {
        const player = room.players.find((p) => p.id === result.playerId);
        return (
          <section key={result.playerId} className="panel">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <span className={`plate rank ${result.rank === 1 ? 'winner-plate' : ''}`}>#{result.rank}</span>
              <strong style={{ flex: 1, minWidth: 0 }}>
                {result.nickname}
                {result.playerId === room.youId ? ' (you)' : ''}
              </strong>
              <span className="plate">{result.totalPower} power</span>
            </div>
            {player && player.team.length > 0 ? (
              <div className="cards-row" style={{ marginTop: 12 }}>
                {player.team.map((character) => (
                  <CharacterCard key={character.id} character={character} size="sm" showPower />
                ))}
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>No characters</p>
            )}
          </section>
        );
      })}
      <div className="center">
        {isHost ? (
          <button className="primary big" onClick={onPlayAgain}>
            Play again
          </button>
        ) : (
          <p className="muted">Waiting for the host to start another game…</p>
        )}
      </div>
    </div>
  );
}
