'use client';

import { useState } from 'react';
import type { AuctionView, RoomView } from '@abb/shared';
import { useCountdown } from '../hooks/useCountdown';

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

  return (
    <div className="grid">
      <div>
        <div className="card lot">
          <div className="muted">
            Round {auction.roundIndex + 1} / {auction.totalRounds}
          </div>
          <div className="name">{auction.character.name}</div>
          <div className="muted">{auction.character.anime}</div>
          <div className="power">Power {auction.character.power}</div>

          {open ? (
            <div className={`timer ${closing ? 'closing' : ''}`}>{(remainingMs / 1000).toFixed(1)}s</div>
          ) : (
            <div className="timer">{auction.status === 'SOLD' ? 'SOLD!' : 'No bids'}</div>
          )}

          <div className="price">{auction.price > 0 ? `${auction.price} coins` : 'No bids yet'}</div>
          <div className="muted">
            {auction.status === 'SOLD' && leader && `Sold to ${leader.nickname}`}
            {auction.status === 'UNSOLD' && 'Nobody bid — this character is unsold'}
            {open && leader && `Leader: ${leader.nickname}${isLeader ? ' (you)' : ''}`}
            {closing && ' — going once!'}
          </div>
        </div>

        <div className="card">
          <h3>Your bid — you have {coins} coins</h3>
          <div className="row">
            {quick.map((amount) => (
              <button key={amount} disabled={!canBid} onClick={() => onBid(amount)}>
                Bid {amount}
              </button>
            ))}
            <input
              type="number"
              min={minBid}
              value={custom}
              placeholder={`min ${minBid}`}
              onChange={(e) => setCustom(e.target.value)}
              style={{ width: '8em' }}
            />
            <button
              className="secondary"
              disabled={!canBid || !Number.isInteger(customAmount) || customAmount < minBid || customAmount > coins}
              onClick={() => {
                onBid(customAmount);
                setCustom('');
              }}
            >
              Bid
            </button>
          </div>
          {isLeader && open && <p className="muted">You are the highest bidder.</p>}
        </div>
      </div>

      <div>
        <div className="card">
          <h3>Players</h3>
          {room.players.map((player) => (
            <div
              key={player.id}
              className={`player ${player.id === auction.leaderId ? 'leader' : ''} ${player.connected ? '' : 'offline'}`}
            >
              <span>
                {player.nickname}
                {player.id === room.youId ? ' (you)' : ''}
              </span>
              <span>
                {player.coins}¢ · {player.team.length} 🎴
              </span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Your team</h3>
          {me && me.team.length > 0 ? (
            me.team.map((character) => (
              <div key={character.id} className="player">
                <span>{character.name}</span>
                <span className="muted">{character.power}</span>
              </div>
            ))
          ) : (
            <p className="muted">No characters yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
