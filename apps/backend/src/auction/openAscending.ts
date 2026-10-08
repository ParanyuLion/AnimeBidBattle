import type { AuctionBidView, Character } from '@abb/shared';
import type { AuctionMode, AuctionState, BidInput, BidResult } from './types';

export const START_PRICE = 1;
export const DEFAULT_SNIPE_WINDOW_MS = 5000;

export class OpenAscendingAuction implements AuctionMode {
  readonly name = 'open-ascending' as const;

  constructor(private readonly snipeWindowMs: number = DEFAULT_SNIPE_WINDOW_MS) {}

  start(character: Character, roundSeconds: number, now: number): AuctionState {
    return {
      character,
      price: 0,
      leaderId: null,
      endsAt: now + roundSeconds * 1000,
      status: 'OPEN',
    };
  }

  placeBid(state: AuctionState, bid: BidInput, now: number): BidResult {
    if (state.status !== 'OPEN' || now >= state.endsAt) {
      return { ok: false, code: 'AUCTION_CLOSED' };
    }
    if (state.leaderId === bid.playerId) {
      return { ok: false, code: 'ALREADY_LEADING' };
    }
    const minimum = state.leaderId === null ? START_PRICE : state.price + 1;
    if (!Number.isInteger(bid.amount) || bid.amount < minimum) {
      return { ok: false, code: 'BID_TOO_LOW' };
    }
    if (bid.amount > bid.coins) {
      return { ok: false, code: 'INSUFFICIENT_COINS' };
    }
    return {
      ok: true,
      state: {
        ...state,
        price: bid.amount,
        leaderId: bid.playerId,
        endsAt: Math.max(state.endsAt, now + this.snipeWindowMs),
      },
    };
  }

  onTimerExpired(state: AuctionState): AuctionState {
    if (state.status !== 'OPEN') return state;
    return { ...state, status: state.leaderId === null ? 'UNSOLD' : 'SOLD' };
  }

  getPublicView(state: AuctionState, _viewerId: string): AuctionBidView {
    return {
      character: state.character,
      price: state.price,
      leaderId: state.leaderId,
      endsAt: state.endsAt,
      status: state.status,
    };
  }
}
