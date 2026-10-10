'use client';

import { useState } from 'react';
import type { AuctionView, RoomView } from '@abb/shared';
import { useCountdown } from '../hooks/useCountdown';
import { CharacterCard } from './CharacterCard';
import { LedBar } from './LedBar';
import { Readout } from './Readout';

interface Props {
  room: RoomView;
  auction: AuctionView;
  clockOffset: number;
  onBid: (amount: number) => void;
}

export function Auction({ room, auction, clockOffset, onBid }: Props) {
  const me = room.players.find((p) => p.id === room.youId);
  const remainingMs = useCountdown(auction.endsAt, clockOffset);
  const [custom, setCustom] = useState('');

  const open = auction.status === 'OPEN';
  const closing = open && remainingMs < 5000;
  const minBid = auction.leaderId === null ? 1 : auction.price + 1;
  const coins = me?.coins ?? 0;
  const isLeader = auction.leaderId === room.youId;
  const canBid = open && !isLeader && coins >= minBid;
  const leader = room.players.find((p) => p.id === auction.leaderId);

  const quick = [...new Set([minBid, auction.price + 5, auction.price + 10])].filter(
    (amount) => amount >= minBid && amount <= coins,
  );
  const customAmount = Number(custom);
  const roundMs = room.settings.roundSeconds * 1000;

  const timeText = open ? (remainingMs / 1000).toFixed(1) : auction.status === 'SOLD' ? 'SOLD' : 'NONE';
  const status = (() => {
    if (auction.status === 'SOLD' && leader) return `Sold to ${leader.nickname}`;
    if (auction.status === 'UNSOLD') return 'Nobody bid — unsold';
    if (leader) return `Leader: ${leader.nickname}${isLeader ? ' (you)' : ''}${closing ? ' — going once!' : ''}`;
    return 'No bids yet';
  })();

  return (
    <div className="grid">
      <div className="stack">
        <section className="panel center stage">
          <div className="row stage-head" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <span className="plate">
              Round {auction.roundIndex + 1}/{auction.totalRounds}
            </span>
            <Readout label="Time" value={timeText} tone={closing ? 'warn' : 'cyan'} flicker={closing} />
          </div>

          <div className="stage-card">
            <CharacterCard character={auction.character} />
          </div>

          <div className="stage-led">
            <LedBar fraction={open ? remainingMs / roundMs : 0} danger={closing} />
          </div>

        </section>

        <section className="panel bid-dock">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'nowrap',
              marginBottom: 10,
            }}
          >
            <Readout label="Current bid" value={auction.price > 0 ? String(auction.price) : '--'} tone="good" />
            <div aria-live="polite" style={{ minWidth: 0, textAlign: 'right' }}>
              <div className="muted">{status}</div>
              <div className="muted">Your coins: {coins}</div>
            </div>
          </div>
          <div className="row">
            {quick.map((amount) => (
              <button key={amount} disabled={!canBid} onClick={() => onBid(amount)}>
                {amount}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }}>
            <input
              aria-label="Custom bid"
              type="number"
              inputMode="numeric"
              min={minBid}
              value={custom}
              placeholder={`min ${minBid}`}
              onChange={(e) => setCustom(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="primary big"
              disabled={!canBid || !Number.isInteger(customAmount) || customAmount < minBid || customAmount > coins}
              onClick={() => {
                onBid(customAmount);
                setCustom('');
              }}
            >
              Bid
            </button>
          </div>
        </section>
      </div>

      <div className="stack">
        <section className="panel">
          <h3>Players</h3>
          {room.players.map((player) => (
            <div
              key={player.id}
              className={`player ${player.id === auction.leaderId ? 'leader' : ''} ${player.connected ? '' : 'offline'}`}
            >
              <span className="who">
                <span role="img" className={`led ${player.connected ? 'on' : ''}`} aria-label={player.connected ? 'online' : 'offline'} />
                <span>
                  {player.nickname}
                  {player.id === room.youId ? ' (you)' : ''}
                </span>
              </span>
              <span>
                {player.coins}¢ · {player.team.length} 🎴
              </span>
            </div>
          ))}
        </section>

        <section className="panel">
          <h3>Your team</h3>
          {me && me.team.length > 0 ? (
            <div className="cards-row">
              {me.team.map((character) => (
                <CharacterCard key={character.id} character={character} size="sm" />
              ))}
            </div>
          ) : (
            <p className="muted">No characters yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
