'use client';

import { useEffect } from 'react';
import { comboPercent, type AuctionView, type ComboView, type RoomView } from '@abb/shared';
import { useCountdown } from '../hooks/useCountdown';
import { CharacterCard } from './CharacterCard';
import { ComboChips } from './ComboChips';
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

  const open = auction.status === 'OPEN';
  const closing = open && remainingMs < 5000;
  const minBid = auction.leaderId === null ? 1 : auction.price + 1;
  const coins = me?.coins ?? 0;
  const isLeader = auction.leaderId === room.youId;
  const canBid = open && !isLeader && coins >= minBid;
  const leader = room.players.find((p) => p.id === auction.leaderId);

  // Enter bids the minimum (+1 over the current price, or 1 if nobody has bid).
  useEffect(() => {
    if (!canBid) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      event.preventDefault(); // also stops Enter from re-clicking a focused quick-bid button
      onBid(minBid);
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [canBid, minBid, onBid]);

  const quick = [
    ...[1, 5, 10, 25, 50, 100].map((step) => ({ label: `+${step}`, amount: auction.price + step })),
    { label: 'All in', amount: coins },
  ];
  const nameOf = (playerId: string) => {
    const player = room.players.find((p) => p.id === playerId);
    return player ? `${player.nickname}${player.id === room.youId ? ' (you)' : ''}` : 'Someone';
  };
  const bidLog = [...auction.bids].reverse();
  const teamCombos: ComboView[] = (() => {
    if (!room.settings.seriesCombo || !me) return [];
    const counts = new Map<string, number>();
    for (const character of me.team) counts.set(character.anime, (counts.get(character.anime) ?? 0) + 1);
    return [...counts]
      .filter(([, count]) => comboPercent(count) > 0)
      .map(([anime, count]) => ({ anime, count, percent: comboPercent(count) }))
      .sort((a, b) => b.count - a.count || a.anime.localeCompare(b.anime));
  })();
  const roundMs = room.settings.roundSeconds * 1000;

  const currentBid = auction.price > 0 ? String(auction.price) : '--';
  const timeText = open ? (remainingMs / 1000).toFixed(1) : auction.status === 'SOLD' ? 'SOLD' : 'NONE';
  const status = (() => {
    if (auction.status === 'SOLD' && leader) return `Sold to ${leader.nickname}`;
    if (auction.status === 'UNSOLD') return 'Nobody bid — unsold';
    if (leader) return `Leader: ${leader.nickname}${isLeader ? ' (you)' : ''}${closing ? ' — going once!' : ''}`;
    return 'No bids yet';
  })();

  return (
    <div className="grid auction-grid">
      <div className="stack stage-col">
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

          <div className="stage-bid">
            <Readout label="Current bid" value={currentBid} tone="good" size="xl" pulseKey={currentBid} />
            <div className="stage-status muted" aria-live="polite">{status}</div>
          </div>

          <div className="stage-led">
            <LedBar fraction={open ? remainingMs / roundMs : 0} danger={closing} />
          </div>

        </section>

        <section className="panel bid-dock">
          <div
            className="dock-bid"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'nowrap',
              marginBottom: 10,
            }}
          >
            <Readout label="Current bid" value={currentBid} tone="good" />
            <div aria-live="polite" style={{ minWidth: 0, textAlign: 'right' }}>
              <div className="muted">{status}</div>
              <div className="muted">Your coins: {coins}</div>
            </div>
          </div>
          <p className="muted enter-hint">Press Enter to bid {minBid}</p>
          <div className="row quick-keys">
            {quick.map(({ label, amount }) => (
              <button
                key={label}
                disabled={!canBid || amount < minBid || amount > coins}
                onClick={() => onBid(amount)}
                aria-label={`${label}, bid ${amount}`}
                title={`Bid ${amount}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="panel bid-log-panel">
        <h3>Bid log</h3>
        <div className="bid-log-body">
          {bidLog.length > 0 ? (
            <ol className="bid-log" aria-label="Bids this round, newest first">
              {bidLog.map((bid, index) => (
                <li key={bidLog.length - index} className={bid.playerId === room.youId ? 'mine' : ''}>
                  <span>{nameOf(bid.playerId)}</span>
                  <b>{bid.amount}¢</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No bids yet.</p>
          )}
        </div>
      </section>

      <div className="stack side-col">
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
          {room.settings.seriesCombo && (
            <p className="muted" style={{ marginTop: 0 }}>Series combo is on: same-anime characters add power.</p>
          )}
          <ComboChips combos={teamCombos} />
          {me && me.team.length > 0 ? (
            <div className="cards-row scroll">
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
