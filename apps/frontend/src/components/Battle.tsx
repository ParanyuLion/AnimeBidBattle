import type { RoomView } from '@abb/shared';

export function Battle({ room }: { room: RoomView }) {
  const results = room.results ?? [];
  return (
    <div className="center">
      <h1>⚔️ Battle!</h1>
      <p className="muted">Comparing team power…</p>
      {results.map((result) => {
        const player = room.players.find((p) => p.id === result.playerId);
        return (
          <div key={result.playerId} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{result.nickname}</strong>
              <span className="power">{result.totalPower} power</span>
            </div>
            <div className="muted">{player?.team.map((c) => c.name).join(', ') || 'No characters'}</div>
          </div>
        );
      })}
    </div>
  );
}
