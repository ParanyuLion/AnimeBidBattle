'use client';

import { useState } from 'react';

export function JoinRoomForm({ title, onSubmit }: { title: string; onSubmit: (nickname: string) => void }) {
  const [nickname, setNickname] = useState('');
  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (nickname.trim()) onSubmit(nickname.trim());
      }}
    >
      <h2>{title}</h2>
      <div className="row">
        <input
          aria-label="Your nickname"
          value={nickname}
          maxLength={20}
          placeholder="Your nickname"
          autoComplete="off"
          onChange={(event) => setNickname(event.target.value)}
          autoFocus
        />
        <button className="primary" type="submit" disabled={!nickname.trim()}>
          Join
        </button>
      </div>
    </form>
  );
}
