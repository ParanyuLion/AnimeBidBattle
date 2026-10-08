import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { SETTINGS_BOUNDS, type Character, type SettingsBounds } from '@abb/shared';
import { createAuctionModes, type AuctionModeRegistry } from './auction';
import { InMemoryRoomStore } from './rooms/store';
import { RoomService } from './rooms/service';
import { registerHandlers, playerChannel, type AppServer } from './transport/handlers';

export interface AppConfig {
  characters: Character[];
  corsOrigins: string[];
  bounds?: SettingsBounds;
  auctionModes?: AuctionModeRegistry;
  soldPauseMs?: number;
  battlePauseMs?: number;
  emptyRoomTtlMs?: number;
  hostGraceMs?: number;
}

export function createApp(config: AppConfig) {
  const app = express();
  app.use(cors({ origin: config.corsOrigins }));
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = http.createServer(app);
  const io: AppServer = new Server(httpServer, { cors: { origin: config.corsOrigins } });

  const service: RoomService = new RoomService({
    characters: config.characters,
    store: new InMemoryRoomStore(),
    auctionModes: config.auctionModes ?? createAuctionModes(),
    bounds: config.bounds ?? SETTINGS_BOUNDS,
    soldPauseMs: config.soldPauseMs ?? 3000,
    battlePauseMs: config.battlePauseMs ?? 4000,
    emptyRoomTtlMs: config.emptyRoomTtlMs ?? 10 * 60 * 1000,
    hostGraceMs: config.hostGraceMs ?? 8000,
    now: () => Date.now(),
    random: Math.random,
    onRoomChanged: (room) => {
      for (const player of room.players) {
        io.to(playerChannel(player.id)).emit('room:state', service.viewFor(room, player.id));
      }
    },
  });

  io.on('connection', (socket) => registerHandlers(io, socket, service));

  return {
    httpServer,
    io,
    service,
    close: () =>
      new Promise<void>((resolve) => {
        service.dispose();
        io.close(() => resolve());
      }),
  };
}
