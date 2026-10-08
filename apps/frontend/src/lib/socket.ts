import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@abb/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | undefined;

/** One socket for the whole tab so client-side navigation keeps the same seat. */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000', {
      autoConnect: false,
    });
  }
  return socket;
}
