// Writes each track's length (seconds) into apps/frontend/public/music/playlist.json, using ffprobe.
// The room's shared music clock needs the lengths so every player can work out the same track and position.
// Any .mp3 in the folder that is not listed yet is added too (title taken from the file name; edit it afterwards if you like).
//   node scripts/music-durations.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'apps', 'frontend', 'public', 'music');
const FILE = path.join(DIR, 'playlist.json');

const tracks = JSON.parse(readFileSync(FILE, 'utf8'));
const listed = new Set(tracks.map((t) => t.file));
for (const file of readdirSync(DIR).filter((f) => /\.mp3$/i.test(f) && !listed.has(f)).sort()) {
  const title = file.replace(/\.mp3$/i, '').replace(/^.* - /, '').replace(/[-_]+/g, ' ').trim();
  tracks.push({ title, file });
  console.log(`added ${file} as "${title}"`);
}
for (const track of tracks) {
  if (!readdirSync(DIR).includes(track.file)) console.warn(`WARNING: ${track.file} is listed but not in the folder`);
}
for (const track of tracks) {
  const output = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path.join(DIR, track.file)],
    { encoding: 'utf8' },
  );
  const seconds = Math.round(Number(output.trim()) * 10) / 10;
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`could not read the length of ${track.file}`);
  track.seconds = seconds;
  console.log(`${track.title}: ${seconds}s`);
}
writeFileSync(FILE, `${JSON.stringify(tracks, null, 2)}\n`);
