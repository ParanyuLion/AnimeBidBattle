import type { CharacterView, RoomView } from '@abb/shared';
import type { AuctionModeRegistry } from '../auction';
import type { Room } from './types';

/** Rebuilds a character field by field so nothing extra (like `power`) can slip through. */
function toCharacterView(character: CharacterView, revealed: boolean): CharacterView {
  const view: CharacterView = { id: character.id, name: character.name, anime: character.anime };
  if (revealed && character.power !== undefined) view.power = character.power;
  return view;
}

export function getRoomView(
  room: Room,
  viewerId: string,
  modes: AuctionModeRegistry,
  now: number,
): RoomView {
  const mode = modes[room.settings.auctionMode];
  // Players must guess how strong a character is: power is only revealed for the Battle.
  const revealed = room.phase === 'BATTLE' || room.phase === 'RESULTS';
  const auction = room.auction ? mode.getPublicView(room.auction, viewerId) : null;
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
      team: p.team.map((character) => toCharacterView(character, revealed)),
      connected: p.connected,
      isHost: p.id === room.hostId,
    })),
    auction: auction
      ? {
          character: toCharacterView(auction.character, revealed),
          price: auction.price,
          leaderId: auction.leaderId,
          endsAt: auction.endsAt,
          status: auction.status,
          roundIndex: room.roundIndex,
          totalRounds: room.deck.length,
        }
      : null,
    results: revealed ? room.results : null,
  };
}
