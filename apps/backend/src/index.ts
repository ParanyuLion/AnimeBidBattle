import { createApp } from './app';
import { JsonCharacterSource } from './characters/source';

const port = Number(process.env.PORT ?? 4000);
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const characters = JsonCharacterSource.fromDefaultFile().getAll();
const { httpServer } = createApp({ characters, corsOrigins });

httpServer.listen(port, () => {
  console.log(`Backend listening on :${port} (CORS: ${corsOrigins.join(', ')})`);
});
