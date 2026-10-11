// Looks up the VS Battles Wiki tier for every character in data/characters.json, to help a human set power values.
// Read-only: it never edits data/characters.json. Wiki text is CC BY-SA; this keeps only tier tokens and page links.
//   node scripts/fetch-vsb-tiers.mjs           prints a review table
//   node scripts/fetch-vsb-tiers.mjs --write   also saves data/vsb-tiers.json
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data', 'characters.json');
const OUT_FILE = path.join(ROOT, 'data', 'vsb-tiers.json');
const API = 'https://vsbattles.fandom.com/api.php';
const USER_AGENT = 'AnimeBidBattle-hobby/0.1 (non-commercial friends game)';
const REQUEST_GAP_MS = 1000;
const CANDIDATES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`VS Battles HTTP ${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(json.error.info);
  return json;
}

function normalize(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** The "Powers and Stats" section of a page's wikitext, or '' when absent. */
export function powersSection(wikitext) {
  const start = wikitext.search(/^==\s*Powers and Stats\s*==/m);
  if (start === -1) return '';
  const rest = wikitext.slice(start + 1);
  const next = rest.search(/^==[^=]/m);
  return next === -1 ? rest : rest.slice(0, next);
}

/** Tier tokens (e.g. "9-B", "High 7-C") from the section's Tier line, in the order listed. */
export function parseTiers(section) {
  const line = section.split('\n').find((l) => /Tier\]*:/.test(l) && /\{\{/.test(l));
  if (!line) return [];
  const tiers = [];
  for (const match of line.matchAll(/\{\{([^{}|]+)\}\}/g)) {
    const token = match[1].trim();
    if (/\d{1,2}-[A-C]/.test(token) || /^unknown$/i.test(token)) tiers.push(token);
  }
  return tiers;
}

/** The series named on the "Origin:" line, as plain text. */
export function parseOrigin(section) {
  const line = section.split('\n').find((l) => /Origin\W*:/.test(l));
  if (!line) return '';
  return line.replace(/^.*?Origin\W*:\W*/, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/[{}'[\]]/g, '').trim();
}

function originMatches(origin, anime) {
  // Compare without spaces so "JoJo" and "Jo Jo" (after punctuation stripping) still match.
  const a = normalize(origin).replace(/ /g, '');
  const b = normalize(anime).replace(/ /g, '');
  return a !== '' && (a.includes(b) || b.includes(a));
}

async function fetchPage(title) {
  const page = await api({ action: 'query', prop: 'revisions', titles: title, rvprop: 'content', rvslots: 'main', redirects: '1' });
  return page.query.pages[0]?.revisions?.[0]?.slots?.main?.content ?? '';
}

async function lookup(character, pageOverrides) {
  const pinned = pageOverrides[character.id];
  if (pinned) {
    const wikitext = await fetchPage(pinned);
    // Some pages have no "Powers and Stats" heading; read the Tier line from the whole text then.
    return { title: pinned, origin: character.anime, tiers: parseTiers(powersSection(wikitext) || wikitext), verified: true, pinned: true };
  }
  const firstName = normalize(character.name).split(' ')[0];
  const titles = [];
  for (const query of [character.name, `${character.name} ${character.anime}`]) {
    const found = await api({ action: 'query', list: 'search', srsearch: query, srlimit: String(CANDIDATES) });
    for (const hit of found.query.search) {
      if (!titles.includes(hit.title) && normalize(hit.title).split(' ').includes(firstName)) titles.push(hit.title);
    }
    await sleep(REQUEST_GAP_MS);
  }
  const tried = [];
  for (const title of titles) {
    await sleep(REQUEST_GAP_MS);
    const wikitext = await fetchPage(title);
    const section = powersSection(wikitext);
    const origin = parseOrigin(section);
    tried.push(title);
    if (originMatches(origin, character.anime)) {
      return { title, origin, tiers: parseTiers(section), verified: true };
    }
  }
  return { title: titles[0] ?? null, origin: '', tiers: [], verified: false, tried };
}

async function main() {
  const characters = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  const pageOverrides = JSON.parse(await readFile(path.join(ROOT, 'data', 'vsb-page-overrides.json'), 'utf8'));
  const rows = [];
  // --only-missing keeps earlier good results and retries the rest.
  const previous = process.argv.includes('--only-missing') ? JSON.parse(await readFile(OUT_FILE, 'utf8')) : [];
  const done = new Map(previous.filter((r) => r.verified && r.tiers.length).map((r) => [r.id, r]));
  for (const character of characters) {
    if (done.has(character.id)) {
      rows.push({ ...done.get(character.id), power: character.power });
      continue;
    }
    try {
      const result = await lookup(character, pageOverrides);
      rows.push({ id: character.id, name: character.name, anime: character.anime, power: character.power, ...result });
    } catch (error) {
      rows.push({ id: character.id, name: character.name, anime: character.anime, power: character.power, verified: false, tiers: [], error: error.message });
    }
    await sleep(REQUEST_GAP_MS);
  }

  console.log('| Character | Anime | Wiki page | Tiers listed | Status |');
  console.log('|---|---|---|---|---|');
  for (const row of rows) {
    const link = row.title ? `[${row.title}](https://vsbattles.fandom.com/wiki/${encodeURIComponent(row.title.replace(/ /g, '_'))})` : '-';
    const status = row.error ? `ERROR ${row.error}` : row.verified ? (row.tiers.length ? 'ok' : 'no tier line') : 'NO MATCH, check by hand';
    console.log(`| ${row.name} | ${row.anime} | ${link} | ${row.tiers.join(' / ') || '-'} | ${status} |`);
  }
  const good = rows.filter((r) => r.verified && r.tiers.length).length;
  console.log(`\n${good}/${rows.length} characters have a verified page with a tier line.`);

  if (process.argv.includes('--write')) {
    await writeFile(OUT_FILE, `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`Saved ${path.relative(ROOT, OUT_FILE)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
