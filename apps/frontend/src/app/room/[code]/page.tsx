'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRoom } from '../../../hooks/useRoom';
import { Auction } from '../../../components/Auction';
import { Battle } from '../../../components/Battle';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { JoinRoomForm } from '../../../components/JoinRoomForm';
import { Lobby } from '../../../components/Lobby';
import { Results } from '../../../components/Results';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const { room, status, connected, error, clearError, clockOffset, actions } = useRoom(code);

  if (status === 'not-found') {
    return (
      <div className="card center">
        <h2>Room {code} not found</h2>
        <p className="muted">It may have ended or the code is wrong.</p>
        <Link href="/">Back to home</Link>
      </div>
    );
  }

  if (status === 'needs-join') {
    return (
      <div>
        <ErrorBanner error={error} onDismiss={clearError} />
        <JoinRoomForm title={`Join room ${code}`} onSubmit={actions.join} />
      </div>
    );
  }

  if (!room) return <div className="banner info" role="status">Connecting to the game server… the first visit can take up to a minute.</div>;

  return (
    <div>
      {!connected && <div className="banner info">Connection lost — reconnecting…</div>}
      <ErrorBanner error={error} onDismiss={clearError} />
      {room.phase === 'LOBBY' && <Lobby room={room} actions={actions} />}
      {room.phase === 'AUCTION' && room.auction && (
        <Auction room={room} auction={room.auction} clockOffset={clockOffset} onBid={actions.bid} />
      )}
      {room.phase === 'BATTLE' && <Battle room={room} />}
      {room.phase === 'RESULTS' && <Results room={room} onPlayAgain={actions.playAgain} />}
    </div>
  );
}
