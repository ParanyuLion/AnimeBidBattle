import type { RoomView } from '@abb/shared';

export function Results({ room, onPlayAgain }: { room: RoomView; onPlayAgain: () => void }) {
  const results = room.results ?? [];
  const winners = results.filter((r) => r.rank === 1);
  const isHost = room.youId === room.hostId;

  return (
    <div>
      <h1 className="center">🏆 {winners.map((w) => w.nickname).join(' & ')} {winners.length > 1 ? 'tie!' : 'wins!'}</h1>
      {results.map((result) => {
        const player = room.players.find((p) => p.id === result.playerId);
        return (
          <div key={result.playerId} className="card">
            <div className="row">
              <span className="rank">#{result.rank}</span>
              <strong style={{ flex: 1 }}>
                {result.nickname}
                {result.playerId === room.youId ? ' (you)' : ''}
              </strong>
              <span className="power">{result.totalPower} power</span>
            </div>
            <div className="muted">{player?.team.map((c) => `${c.name} (${c.power ?? '?'})`).join(', ') || 'No characters'}</div>
          </div>
        );
      })}
      <div className="center">
        {isHost ? (
          <button onClick={onPlayAgain}>Play again</button>
        ) : (
          <p className="muted">Waiting for the host to start another game…</p>
        )}
      </div>
    </div>
  );
}
