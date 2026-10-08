import { describe, expect, it } from 'vitest';
import type { Character } from '@abb/shared';
import { OpenAscendingAuction } from './openAscending';
import type { AuctionState, BidResult } from './types';

const character: Character = { id: 'a', name: 'A', anime: 'X', power: 10 };
const mode = new OpenAscendingAuction(5000);

function started(now = 0): AuctionState {
  return mode.start(character, 10, now);
}

function accepted(result: BidResult): AuctionState {
  if (!result.ok) throw new Error(`expected accepted bid, got ${result.code}`);
  return result.state;
}

function rejectedCode(result: BidResult): string {
  if (result.ok) throw new Error('expected rejected bid');
  return result.code;
}

describe('OpenAscendingAuction', () => {
  it('starts open with no leader and the timer set', () => {
    const state = started(1000);
    expect(state).toMatchObject({ price: 0, leaderId: null, endsAt: 11000, status: 'OPEN' });
  });

  it('accepts a first bid of 1 and rejects 0', () => {
    expect(accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 1 }, 100)).price).toBe(1);
    expect(rejectedCode(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 0 }, 100))).toBe('BID_TOO_LOW');
  });

  it('requires later bids to beat the price by at least 1', () => {
    const afterFirst = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 10 }, 100));
    expect(rejectedCode(mode.placeBid(afterFirst, { playerId: 'p2', coins: 100, amount: 10 }, 200))).toBe('BID_TOO_LOW');
    expect(rejectedCode(mode.placeBid(afterFirst, { playerId: 'p2', coins: 100, amount: 9 }, 200))).toBe('BID_TOO_LOW');
    const afterSecond = accepted(mode.placeBid(afterFirst, { playerId: 'p2', coins: 100, amount: 11 }, 200));
    expect(afterSecond).toMatchObject({ price: 11, leaderId: 'p2' });
  });

  it('accepts only the first of two same-price bids', () => {
    const base = started();
    const first = accepted(mode.placeBid(base, { playerId: 'p1', coins: 100, amount: 20 }, 100));
    expect(rejectedCode(mode.placeBid(first, { playerId: 'p2', coins: 100, amount: 20 }, 100))).toBe('BID_TOO_LOW');
    expect(first.leaderId).toBe('p1');
  });

  it('rejects a bid above the bidder coins', () => {
    expect(rejectedCode(mode.placeBid(started(), { playerId: 'p1', coins: 50, amount: 51 }, 100))).toBe('INSUFFICIENT_COINS');
  });

  it('does not let the leader outbid themselves', () => {
    const led = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 100));
    expect(rejectedCode(mode.placeBid(led, { playerId: 'p1', coins: 100, amount: 6 }, 200))).toBe('ALREADY_LEADING');
  });

  it('rejects bids at or after endsAt and after resolution', () => {
    expect(rejectedCode(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 10000))).toBe('AUCTION_CLOSED');
    const resolved = mode.onTimerExpired(started());
    expect(rejectedCode(mode.placeBid(resolved, { playerId: 'p1', coins: 100, amount: 5 }, 1))).toBe('AUCTION_CLOSED');
  });

  it('extends the timer to the snipe window when under 5 seconds remain', () => {
    const state = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 8000));
    expect(state.endsAt).toBe(13000);
  });

  it('leaves the timer alone when plenty of time remains', () => {
    const state = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 1000));
    expect(state.endsAt).toBe(10000);
  });

  it('resolves to SOLD with a leader and UNSOLD without', () => {
    const led = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 100));
    expect(mode.onTimerExpired(led)).toMatchObject({ status: 'SOLD', leaderId: 'p1', price: 5 });
    expect(mode.onTimerExpired(started())).toMatchObject({ status: 'UNSOLD', leaderId: null });
  });

  it('exposes a public view with the bid fields', () => {
    expect(mode.getPublicView(started(), 'p1')).toMatchObject({ character, price: 0, status: 'OPEN' });
  });
});
