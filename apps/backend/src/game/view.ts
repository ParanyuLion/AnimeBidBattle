import type { RoomView } from '@abb/shared';
import type { AuctionModeRegistry } from '../auction';
import type { Room } from './types';

export function getRoomView(
  room: Room,
  viewerId: string,
  modes: AuctionModeRegistry,
  now: number,
): RoomView {
  const mode = modes[room.settings.auctionMode];
  return {
    code: room.code,
    phase: room.phase,
    settings: room.settings,
    hostId: room.hostId,
    youId: viewerId,
    serverNow: now,
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      coins: p.coins,
      team: p.team,
      connected: p.connected,
      isHost: p.id === room.hostId,
    })),
    auction: room.auction
      ? {
          ...mode.getPublicView(room.auction, viewerId),
          roundIndex: room.roundIndex,
          totalRounds: room.deck.length,
        }
      : null,
    results: room.results,
  };
}
