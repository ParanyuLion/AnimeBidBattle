'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ErrorPayload } from '@abb/shared';
import { getSocket } from '../lib/socket';
import { saveSession } from '../lib/session';
import { ErrorBanner } from '../components/ErrorBanner';

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<ErrorPayload | null>(null);

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const name = nickname.trim();

  function create() {
    getSocket().emit('room:create', { nickname: name }, (res) => {
      if (!res.ok) return setError(res.error);
      saveSession(res.roomCode, { playerId: res.playerId, rejoinToken: res.rejoinToken });
      router.push(`/room/${res.roomCode}`);
    });
  }

  function join() {
    getSocket().emit('room:join', { roomCode: roomCode.trim(), nickname: name }, (res) => {
      if (!res.ok) return setError(res.error);
      saveSession(res.roomCode, { playerId: res.playerId, rejoinToken: res.rejoinToken });
      router.push(`/room/${res.roomCode}`);
    });
  }

  return (
    <div className="stack">
      <header className="center">
        <h1>Anime Bid Battle</h1>
        <p className="muted">Bid on anime characters. Guess their strength. Build the strongest team.</p>
      </header>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {!connected && (
        <div className="banner info" role="status">
          Waking up the game server… the first visit can take up to a minute.
        </div>
      )}

      <section className="panel">
        <div className="field">
          <label htmlFor="nickname">Your nickname</label>
          <input id="nickname" value={nickname} maxLength={20} autoComplete="off" onChange={(e) => setNickname(e.target.value)} />
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <section className="panel">
          <h2>Create a room</h2>
          <p className="muted">You become the host and choose the settings.</p>
          <button className="primary big" onClick={create} disabled={!name || !connected}>
            Create room
          </button>
        </section>
        <section className="panel">
          <h2>Join a room</h2>
          <div className="row">
            <input
              aria-label="Room code"
              value={roomCode}
              maxLength={5}
              placeholder="ROOM CODE"
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              style={{ width: '9em' }}
            />
            <button className="primary" onClick={join} disabled={!name || !connected || roomCode.trim().length !== 5}>
              Join
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
