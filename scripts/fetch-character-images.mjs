// Finds an AniList image for every character in data/characters.json.
// Run it with `node` (no shebang on purpose: a shebang line breaks Vitest's loader when Git checks the file out with CRLF).
//   node scripts/fetch-character-images.mjs              dry-run: prints a manifest, downloads nothing
//   node scripts/fetch-character-images.mjs --download   saves apps/frontend/public/characters/<id>.jpg
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data', 'characters.json');
const OUT_DIR = path.join(ROOT, 'apps', 'frontend', 'public', 'characters');
const ENDPOINT = 'https://graphql.anilist.co';
const MIN_BYTES = 5 * 1024;
const REQUEST_GAP_MS = 1200;

const QUERY = `query ($search: String) {
  Page(perPage: 8) {
    characters(search: $search) {
      id
      name { full alternative }
      image { large }
      media(perPage: 8) { nodes { title { romaji english } } }
    }
  }
}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensMatch(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 4 && longer.startsWith(shorter);
}

/** 0..1 — how well a candidate's names cover the wanted name (extra tokens lower the score). */
export function nameScore(wanted, candidateNames) {
  const wantedTokens = normalize(wanted).split(' ').filter(Boolean);
  if (wantedTokens.length === 0) return 0;
  let best = 0;
  for (const candidate of candidateNames) {
    const candidateTokens = normalize(candidate).split(' ').filter(Boolean);
    if (candidateTokens.length === 0) continue;
    const hits = wantedTokens.filter((w) => candidateTokens.some((c) => tokensMatch(w, c))).length;
    const score = hits / Math.max(wantedTokens.length, candidateTokens.length);
    if (score > best) best = score;
  }
  return best;
}

export function animeMatches(wantedAnime, mediaNodes) {
  const wanted = normalize(wantedAnime);
  return mediaNodes.some((node) =>
    [node?.title?.romaji, node?.title?.english].filter(Boolean).some((title) => {
      const normalized = normalize(title);
      return normalized.includes(wanted) || (normalized.length >= 4 && wanted.includes(normalized));
    }),
  );
}

/** Chooses the AniList candidate for a character, or null if none is trustworthy. */
export function pickMatch(character, candidates) {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      name: nameScore(character.name, [candidate.name?.full ?? '', ...(candidate.name?.alternative ?? [])]),
      anime: animeMatches(character.anime, candidate.media?.nodes ?? []),
    }))
    .filter((s) => s.anime && s.name >= 0.5 && s.candidate.image?.large)
    .sort((a, b) => b.name - a.name);
  if (scored.length === 0) return null;
  const best = scored[0];
  return { candidate: best.candidate, confidence: best.name === 1 ? 'exact' : 'review' };
}

async function searchAniList(search) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { search } }),
    });
    if (response.status === 429) {
      const waitSeconds = Number(response.headers.get('retry-after') ?? 60);
      console.error(`AniList rate limit hit; waiting ${waitSeconds}s`);
      await sleep(waitSeconds * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
    const json = await response.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data.Page.characters;
  }
  throw new Error('AniList rate limit did not clear');
}

async function downloadImage(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`not an image (${type}) for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < MIN_BYTES) throw new Error(`suspiciously small (${bytes.length} bytes) for ${url}`);
  await writeFile(destination, bytes);
  return bytes.length;
}

function sourcesMarkdown(rows) {
  const lines = [
    '# Character image sources',
    '',
    'Images are fetched from the AniList public API (https://anilist.co) by `scripts/fetch-character-images.mjs`.',
    'Character artwork belongs to its respective rights holders; this project is a non-commercial game for friends.',
    '',
    '| File | Character | Anime | AniList character | Image URL |',
    '|---|---|---|---|---|',
  ];
  for (const row of rows) {
    if (row.url) {
      lines.push(`| ${row.id}.jpg | ${row.name} | ${row.anime} | https://anilist.co/character/${row.anilistId} | ${row.url} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const shouldDownload = process.argv.includes('--download');
  const characters = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  const rows = [];

  for (const character of characters) {
    const destination = path.join(OUT_DIR, `${character.id}.jpg`);
    const row = { id: character.id, name: character.name, anime: character.anime, destination, exists: existsSync(destination) };
    try {
      const picked = pickMatch(character, await searchAniList(character.name));
      if (picked) {
        row.anilistId = picked.candidate.id;
        row.matchedName = picked.candidate.name.full;
        row.url = picked.candidate.image.large;
        row.confidence = picked.confidence;
      } else {
        row.problem = 'NO MATCH (a placeholder will be shown)';
      }
    } catch (error) {
      row.problem = `ERROR: ${error.message}`;
    }
    rows.push(row);
    await sleep(REQUEST_GAP_MS);
  }

  console.log(`\nManifest (${shouldDownload ? 'download' : 'dry-run'}):\n`);
  for (const row of rows) {
    const state = row.problem ?? `${row.confidence} -> ${row.matchedName}`;
    console.log(`${row.id.padEnd(22)} ${state}${row.exists ? ' [file exists]' : ''}`);
    if (row.url) console.log(`${' '.repeat(22)} ${row.url}`);
  }
  const matched = rows.filter((r) => r.url);
  const review = matched.filter((r) => r.confidence === 'review');
  console.log(
    `\n${matched.length}/${rows.length} matched, ${review.length} need review, ${rows.length - matched.length} unmatched.`,
  );

  if (!shouldDownload) {
    console.log('Dry-run only: nothing was downloaded. Re-run with --download to save the images.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  let totalBytes = 0;
  for (const row of matched) {
    if (row.exists) continue;
    try {
      totalBytes += await downloadImage(row.url, row.destination);
    } catch (error) {
      row.problem = `DOWNLOAD FAILED: ${error.message}`;
      row.url = undefined;
      console.error(`${row.id}: ${row.problem}`);
    }
    await sleep(300);
  }
  await writeFile(path.join(OUT_DIR, 'SOURCES.md'), sourcesMarkdown(rows));
  console.log(`\nDownloaded ${(totalBytes / 1024 / 1024).toFixed(2)} MB into ${OUT_DIR}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
