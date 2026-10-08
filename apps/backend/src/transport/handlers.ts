import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  GameError,
  bidSchema,
  createRoomSchema,
  emptySchema,
  joinRoomSchema,
  rejoinSchema,
  updateSettingsSchema,
  type ClientToServerEvents,
  type JoinResult,
  type ServerToClientEvents,
} from '@abb/shared';
import type { Player, Room } from '../game/types';
import type { RoomService } from '../rooms/service';
import { toErrorPayload } from './errors';

export interface SocketData {
  session?: { roomCode: string; playerId: string };
}

type NoServerEvents = Record<string, never>;
export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, NoServerEvents, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, NoServerEvents, SocketData>;

export const playerChannel = (playerId: string): string => `player:${playerId}`;

export function registerHandlers(io: AppServer, socket: AppSocket, service: RoomService): void {
  // The generic event typing cannot express a schema-driven helper, so use one narrow untyped view.
  const on = socket.on.bind(socket) as unknown as (
    event: string,
    listener: (raw: unknown, ack?: unknown) => void,
  ) => void;

  function handle<S extends z.ZodTypeAny>(
    event: keyof ClientToServerEvents,
    schema: S,
    fn: (payload: z.infer<S>) => object,
  ): void {
    on(event, (raw, ack) => {
      const reply = typeof ack === 'function' ? (ack as (res: unknown) => void) : () => undefined;
      try {
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          throw new GameError('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'Invalid request');
        }
        reply({ ok: true, ...fn(parsed.data) });
      } catch (err) {
        const error = toErrorPayload(err);
        reply({ ok: false, error });
        socket.emit('error', error);
      }
    });
  }

  function requireSession(): { roomCode: string; playerId: string } {
    const session = socket.data.session;
    if (!session) throw new GameError('NOT_IN_ROOM', 'Join or create a room first');
    return session;
  }

  /** Marks a player disconnected once none of their sockets remain. */
  function releaseIfOrphaned(session: { roomCode: string; playerId: string }): void {
    const members = io.sockets.adapter.rooms.get(playerChannel(session.playerId));
    if (!members || members.size === 0) service.disconnect(session.roomCode, session.playerId);
  }

  function bind(room: Room, player: Player): JoinResult {
    const previous = socket.data.session;
    socket.data.session = { roomCode: room.code, playerId: player.id };
    socket.join(playerChannel(player.id));
    if (previous && previous.playerId !== player.id) {
      socket.leave(playerChannel(previous.playerId));
      releaseIfOrphaned(previous);
    }
    socket.emit('room:state', service.viewFor(room, player.id));
    return { roomCode: room.code, playerId: player.id, rejoinToken: player.rejoinToken };
  }

  handle('room:create', createRoomSchema, ({ nickname, settings }) => {
    const { room, player } = service.createRoom(nickname, settings);
    return bind(room, player);
  });

  handle('room:join', joinRoomSchema, ({ roomCode, nickname }) => {
    const { room, player } = service.joinRoom(roomCode, nickname);
    return bind(room, player);
  });

  handle('room:rejoin', rejoinSchema, ({ roomCode, rejoinToken }) => {
    const { room, player } = service.rejoin(roomCode, rejoinToken);
    return bind(room, player);
  });

  handle('room:updateSettings', updateSettingsSchema, (patch) => {
    const { roomCode, playerId } = requireSession();
    service.updateSettings(roomCode, playerId, patch);
    return {};
  });

  handle('game:start', emptySchema, () => {
    const { roomCode, playerId } = requireSession();
    service.startGame(roomCode, playerId);
    return {};
  });

  handle('auction:bid', bidSchema, ({ amount }) => {
    const { roomCode, playerId } = requireSession();
    service.placeBid(roomCode, playerId, amount);
    return {};
  });

  handle('game:playAgain', emptySchema, () => {
    const { roomCode, playerId } = requireSession();
    service.playAgain(roomCode, playerId);
    return {};
  });

  socket.on('disconnect', () => {
    try {
      const session = socket.data.session;
      if (session) releaseIfOrphaned(session);
    } catch (err) {
      console.error('disconnect handler failed', err);
    }
  });
}
