'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ErrorPayload, RoomView, UpdateSettingsPayload } from '@abb/shared';
import { getSocket } from '../lib/socket';
import { clearSession, loadSession, saveSession } from '../lib/session';

export type RoomStatus = 'connecting' | 'needs-join' | 'ready' | 'not-found';

const noop = () => undefined;

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<ErrorPayload | null>(null);
  const [clockOffset, setClockOffset] = useState(0);

  useEffect(() => {
    const socket = getSocket();

    const rejoin = () => {
      setConnected(true);
      const session = loadSession(code);
      if (!session) {
        setStatus((current) => (current === 'ready' ? current : 'needs-join'));
        return;
      }
      socket.emit('room:rejoin', { roomCode: code, rejoinToken: session.rejoinToken }, (res) => {
        if (!res.ok) {
          clearSession(code);
          setStatus(res.error.code === 'ROOM_NOT_FOUND' ? 'not-found' : 'needs-join');
        }
      });
    };
    const onState = (state: RoomView) => {
      if (state.code !== code) return;
      setRoom(state);
      setClockOffset(state.serverNow - Date.now());
      setStatus('ready');
    };
    const onError = (err: ErrorPayload) => setError(err);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', rejoin);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('error', onError);
    if (socket.connected) rejoin();
    else socket.connect();

    return () => {
      socket.off('connect', rejoin);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('error', onError);
    };
  }, [code]);

  const join = useCallback(
    (nickname: string) => {
      getSocket().emit('room:join', { roomCode: code, nickname }, (res) => {
        if (res.ok) saveSession(code, { playerId: res.playerId, rejoinToken: res.rejoinToken });
      });
    },
    [code],
  );

  const actions = {
    join,
    updateSettings: (patch: UpdateSettingsPayload) => getSocket().emit('room:updateSettings', patch, noop),
    start: () => getSocket().emit('game:start', {}, noop),
    bid: (amount: number) => getSocket().emit('auction:bid', { amount }, noop),
    playAgain: () => getSocket().emit('game:playAgain', {}, noop),
  };

  return { room, status, connected, error, clearError: () => setError(null), clockOffset, actions };
}
