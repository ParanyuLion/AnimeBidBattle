'use client';

import { useState } from 'react';

export function JoinRoomForm({ title, onSubmit }: { title: string; onSubmit: (nickname: string) => void }) {
  const [nickname, setNickname] = useState('');
  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        if (nickname.trim()) onSubmit(nickname.trim());
      }}
    >
      <h2>{title}</h2>
      <div className="row">
        <input
          value={nickname}
          maxLength={20}
          placeholder="Your nickname"
          onChange={(event) => setNickname(event.target.value)}
          autoFocus
        />
        <button type="submit" disabled={!nickname.trim()}>
          Join
        </button>
      </div>
    </form>
  );
}
