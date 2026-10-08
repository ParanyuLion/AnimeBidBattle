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

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
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
    <div>
      <h1 className="center">Anime Bid Battle</h1>
      <p className="muted center">Bid on anime characters. Build the strongest team.</p>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="card">
        <div className="field">
          <label htmlFor="nickname">Nickname</label>
          <input id="nickname" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} />
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Create a room</h2>
          <p className="muted">You become the host and choose the settings.</p>
          <button onClick={create} disabled={!name}>
            Create room
          </button>
        </div>
        <div className="card">
          <h2>Join a room</h2>
          <div className="row">
            <input
              value={roomCode}
              maxLength={5}
              placeholder="ROOM CODE"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              style={{ width: '9em' }}
            />
            <button onClick={join} disabled={!name || roomCode.trim().length !== 5}>
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
