import type { Room } from '../game/types';

export interface RoomStore {
  get(code: string): Room | undefined;
  set(room: Room): void;
  delete(code: string): void;
  has(code: string): boolean;
}

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  set(room: Room): void {
    this.rooms.set(room.code, room);
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }
}
