'use client';

import { useEffect, useState } from 'react';
import { MIN_PLAYERS_TO_START, SETTINGS_BOUNDS, type RoomSettings, type RoomView, type UpdateSettingsPayload } from '@abb/shared';

interface Props {
  room: RoomView;
  actions: { updateSettings(patch: UpdateSettingsPayload): void; start(): void };
}

const FIELDS = [
  { key: 'maxPlayers', label: 'Max players' },
  { key: 'startingCoins', label: 'Starting coins' },
  { key: 'rounds', label: 'Rounds' },
  { key: 'roundSeconds', label: 'Seconds per round' },
] as const;

export function Lobby({ room, actions }: Props) {
  const isHost = room.youId === room.hostId;
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(room.settings));
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const { maxPlayers, startingCoins, rounds, roundSeconds } = room.settings;

  // Resync from the server unless the user has pending edits.
  useEffect(() => {
    if (!dirty) setDraft(toDraft({ maxPlayers, startingCoins, rounds, roundSeconds }));
  }, [dirty, maxPlayers, startingCoins, rounds, roundSeconds, room.hostId, isHost]);

  const draftValid = FIELDS.every(({ key }) => draft[key] !== '' && Number.isInteger(Number(draft[key])));

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
    setDirty(false);
  }

  const needsPlayers = room.players.length < MIN_PLAYERS_TO_START;

  return (
    <div className="grid">
      <div className="stack">
        <section className="panel center">
          <div className="muted" style={{ marginBottom: 8 }}>Room code</div>
          <div className="plate code-plate">{room.code}</div>
          <div style={{ marginTop: 14 }}>
            <button className="secondary" onClick={copyLink}>
              {copied ? 'Link copied!' : 'Copy invite link'}
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Settings</h2>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            {FIELDS.map(({ key, label }) => (
              <div className="field" key={key} style={{ flex: '1 1 140px' }}>
                <label htmlFor={key}>
                  {label} ({SETTINGS_BOUNDS[key].min}–{SETTINGS_BOUNDS[key].max})
                </label>
                <input
                  id={key}
                  type="number"
                  inputMode="numeric"
                  value={isHost ? draft[key] : String(room.settings[key])}
                  disabled={!isHost}
                  onChange={(e) => {
                    setDraft({ ...draft, [key]: e.target.value });
                    setDirty(true);
                  }}
                />
              </div>
            ))}
          </div>
          {isHost && (
            <div className="row" style={{ marginTop: 14 }}>
              <button className="secondary" onClick={save} disabled={!draftValid}>
                Save settings
              </button>
              {dirty && <span className="muted">Unsaved changes</span>}
            </div>
          )}
        </section>
      </div>

      <div className="stack">
        <section className="panel">
          <h2>
            Players ({room.players.length}/{room.settings.maxPlayers})
          </h2>
          {room.players.map((player) => (
            <div key={player.id} className={`player ${player.connected ? '' : 'offline'}`}>
              <span className="who">
                <span className={`led ${player.connected ? 'on' : ''}`} aria-label={player.connected ? 'online' : 'offline'} />
                <span>
                  {player.nickname}
                  {player.id === room.youId ? ' (you)' : ''}
                  {player.isHost ? ' 👑' : ''}
                </span>
              </span>
            </div>
          ))}
        </section>

        {isHost ? (
          <button className="primary big" onClick={actions.start} disabled={needsPlayers || dirty}>
            {needsPlayers ? `Need ${MIN_PLAYERS_TO_START}+ players` : 'Start game'}
          </button>
        ) : (
          <p className="muted center">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}

function toDraft(settings: Pick<RoomSettings, (typeof FIELDS)[number]['key']>): Record<string, string> {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, String(settings[key])]));
}
