'use client';

import { useState } from 'react';
import { MIN_PLAYERS_TO_START, SETTINGS_BOUNDS, type RoomSettings, type RoomView, type UpdateSettingsPayload } from '@abb/shared';

interface Props {
  room: RoomView;
  actions: { updateSettings(patch: UpdateSettingsPayload): void; start(): void };
}

const FIELDS = [
  { key: 'maxPlayers', label: 'Max players' },
  { key: 'startingCoins', label: 'Starting coins' },
  { key: 'rounds', label: 'Rounds (characters)' },
  { key: 'roundSeconds', label: 'Seconds per round' },
] as const;

export function Lobby({ room, actions }: Props) {
  const isHost = room.youId === room.hostId;
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(room.settings));
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; the code is shown on screen anyway
    }
  }

  function save() {
    const patch: UpdateSettingsPayload = {};
    for (const { key } of FIELDS) patch[key] = Number(draft[key]);
    actions.updateSettings(patch);
  }

  return (
    <div className="grid">
      <div>
        <div className="card center">
          <div className="muted">Room code</div>
          <div className="code">{room.code}</div>
          <button className="secondary" onClick={copyLink}>
            {copied ? 'Link copied!' : 'Copy invite link'}
          </button>
        </div>

        <div className="card">
          <h2>Settings</h2>
          <div className="row">
            {FIELDS.map(({ key, label }) => (
              <div className="field" key={key}>
                <label htmlFor={key}>
                  {label} ({SETTINGS_BOUNDS[key].min}–{SETTINGS_BOUNDS[key].max})
                </label>
                <input
                  id={key}
                  type="number"
                  value={isHost ? draft[key] : String(room.settings[key])}
                  disabled={!isHost}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  style={{ width: '9em' }}
                />
              </div>
            ))}
          </div>
          {isHost && (
            <div className="row" style={{ marginTop: 12 }}>
              <button className="secondary" onClick={save}>
                Save settings
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="card">
          <h2>
            Players ({room.players.length}/{room.settings.maxPlayers})
          </h2>
          {room.players.map((player) => (
            <div key={player.id} className={`player ${player.connected ? '' : 'offline'}`}>
              <span>
                {player.nickname}
                {player.id === room.youId ? ' (you)' : ''}
                {player.isHost ? ' 👑' : ''}
              </span>
              <span className="muted">{player.connected ? 'online' : 'offline'}</span>
            </div>
          ))}
        </div>

        {isHost ? (
          <button onClick={actions.start} disabled={room.players.length < MIN_PLAYERS_TO_START} style={{ width: '100%' }}>
            {room.players.length < MIN_PLAYERS_TO_START ? `Need ${MIN_PLAYERS_TO_START}+ players` : 'Start game'}
          </button>
        ) : (
          <p className="muted center">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}

function toDraft(settings: RoomSettings): Record<string, string> {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, String(settings[key])]));
}
