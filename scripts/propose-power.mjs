// Turns data/vsb-tiers.json into a review table with a proposed S-D bucket and power for each character.
// Rule: convert every listed tier to a ladder rank, take the strongest listed form's rank, bucket it.
//   node scripts/propose-power.mjs           prints the table
//   node scripts/propose-power.mjs --write   saves data/power-review.md
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LADDER = ['11-C', '11-B', '11-A', '10-C', '10-B', '10-A', '9-C', '9-B', '9-A', '8-C', '8-B', '8-A', '7-C', '7-B', '7-A', '6-C', '6-B', '6-A', '5-C', '5-B', '5-A', '4-C', '4-B', '4-A', '3-C', '3-B', '3-A', '2-C', '2-B', '2-A', '1-C', '1-B', '1-A'];
// Minimum ladder rank for each bucket, strongest first.
export const BUCKETS = [
  { name: 'S', base: 95, min: LADDER.indexOf('2-C') },
  { name: 'A', base: 60, min: LADDER.indexOf('5-B') },
  { name: 'B', base: 35, min: LADDER.indexOf('6-B') },
  { name: 'C', base: 20, min: LADDER.indexOf('8-A') },
  { name: 'D', base: 10, min: -Infinity },
];

/** Ladder rank of a tier token like "High 7-C"; Low/High shift it by a third of a step. */
export function tierRank(token) {
  const match = /^(Low|High)?\s*(\d{1,2}-[A-C])$/i.exec(token.trim());
  if (!match) return null;
  const index = LADDER.indexOf(match[2].toUpperCase());
  if (index === -1) return null;
  const shift = match[1] ? (match[1].toLowerCase() === 'high' ? 1 / 3 : -1 / 3) : 0;
  return index + shift;
}

export function bestRank(tokens) {
  const ranks = tokens.map(tierRank).filter((r) => r !== null);
  return ranks.length === 0 ? null : Math.max(...ranks);
}

export function bucketFor(rank) {
  return BUCKETS.find((b) => rank >= b.min);
}

async function main() {
  const rows = JSON.parse(await readFile(path.join(ROOT, 'data', 'vsb-tiers.json'), 'utf8'));
  const lines = [
    '# Power review table',
    '',
    'Proposed from VS Battles tiers (strongest listed form). Edit the Override column, then apply. Lowest-effort rule: S >= 2-C, A >= 5-B, B >= 6-B, C >= 8-A, otherwise D. Hand overrides live in `data/power-overrides.json`.',
    'Tier data: VS Battles Wiki (CC BY-SA). Page links are in `data/vsb-tiers.json`.',
    '',
    '| Character | Anime | Best tier | Bucket | Proposed power | Current power | Override |',
    '|---|---|---|---|---|---|---|',
  ];
  const counts = {};
  const overrides = JSON.parse(await readFile(path.join(ROOT, 'data', 'power-overrides.json'), 'utf8'));
  for (const row of rows) {
    const rank = bestRank(row.tiers ?? []);
    const forced = overrides[row.id];
    if (forced) {
      const bucket = BUCKETS.find((b) => b.name === forced.bucket);
      counts[bucket.name] = (counts[bucket.name] ?? 0) + 1;
      const label = rank === null ? '?' : LADDER[Math.round(rank)];
      lines.push(`| ${row.name} | ${row.anime} | ${label} | ${bucket.name} (override) | ${bucket.base} | ${row.power} | ${forced.reason} |`);
      continue;
    }
    if (rank === null) {
      lines.push(`| ${row.name} | ${row.anime} | ? | ? | ? | ${row.power} | **set by hand** |`);
      continue;
    }
    const bucket = bucketFor(rank);
    counts[bucket.name] = (counts[bucket.name] ?? 0) + 1;
    const label = LADDER[Math.round(rank)] ?? '?';
    lines.push(`| ${row.name} | ${row.anime} | ${label} | ${bucket.name} | ${bucket.base} | ${row.power} |  |`);
  }
  lines.push('', `Bucket counts: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  const text = `${lines.join('\n')}\n`;
  console.log(text);
  if (process.argv.includes('--write')) {
    await writeFile(path.join(ROOT, 'data', 'power-review.md'), text);
    console.log('Saved data/power-review.md');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
