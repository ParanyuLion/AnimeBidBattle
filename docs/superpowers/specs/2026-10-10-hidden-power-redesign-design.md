# Hidden Power and Dark Skeuomorphic Redesign — Design Spec

Date: 2026-10-10
Amends: `2026-10-08-anime-bid-battle-design.md` (the original spec showed each character's power during the auction; this spec removes that).

## 1. Overview

Three linked changes to the shipped game:

1. **Hidden power.** Players must guess how strong a character is. The backend never sends any character's power to any client until the Battle phase, when every team and power is revealed at once.
2. **Real character images** stored in the repo.
3. **A new look:** a dark "neon cyber arena" in a skeuomorphic style — a black hardware bidding console with brushed-metal panels, physical keys, LED readouts and neon edge lights. Mobile-first.

**Success criteria:** (a) no `power` value appears in any `room:state` payload during `LOBBY` or `AUCTION`, proven by tests; (b) all five screens (Home, Lobby, Auction, Battle, Results) use the new look and are comfortable on a ~390 px wide phone and on desktop; (c) every character shows its image, falling back to a styled placeholder if a file is missing; (d) game logic and the rest of the protocol are unchanged and the existing 74 tests still pass.

## 2. Decisions

| Topic | Decision |
|---|---|
| Hiding method | Server-side redaction in the single view-building function; not UI-only |
| Reveal moment | `BATTLE` and `RESULTS` phases, for everyone's teams, including your own |
| Own team | Also hidden until Battle |
| Images | Files in `apps/frontend/public/characters/<id>.jpg`, named by character id; no change to `data/characters.json` or the `Character` type |
| Image source | AniList public API via a script; download only after the user confirms the dry-run manifest |
| Visual direction | Neon cyber arena (violet/cyan neon on near-black), skeuomorphic hardware console |
| Layout | Mobile-first, single column, sticky bid dock |
| Tech | Plain CSS tokens in `globals.css`, `next/font`, no UI library, no new frontend dependencies |

## 3. Hidden power (backend + shared)

- `Character` (with `power`) stays the server-internal type and `data/characters.json` is unchanged. `computePower`, `teamPower` and all game logic still use `power`.
- Add to `@abb/shared`: `CharacterView = { id: string; name: string; anime: string; power?: number }`.
- `AuctionBidView.character` and `PlayerView.team` use `CharacterView`. `BattleResult` and `RoomView.results` are unchanged.
- `game/view.ts` `getRoomView` is the single redaction point and runs last, after the auction mode's `getPublicView`, so a future mode cannot leak:
  - `revealed = room.phase === 'BATTLE' || room.phase === 'RESULTS'`.
  - Every character in the view is rebuilt by an explicit field list (`toCharacterView(character, revealed)`); no object spread. `power` is included only when `revealed`.
  - `results` is `null` unless `revealed`.
- No other server output carries power (`room.deck` is never sent; error messages never include it).
- Out of scope: hints about strength, tiers, rarity colours derived from power (they would leak it).

## 4. Images

- Script `scripts/fetch-character-images.mjs` (Node, built-in `fetch`, no dependencies):
  1. Reads `data/characters.json`.
  2. For each character queries AniList GraphQL `Character(search: name)`, and matches the result against the anime title to avoid wrong characters (for example "L" or "Light"). Ambiguous matches are reported for manual review, never guessed.
  3. **Dry-run (default)** prints a manifest — character id, matched name, matched anime, source URL, destination path — and downloads nothing.
  4. With `--download` it saves the `large` image (about 230×345, roughly 1–3 MB total for 32) to `apps/frontend/public/characters/<id>.jpg`, skips files that already exist, throttles requests to stay within AniList limits, verifies each response is an image of non-trivial size, and writes `apps/frontend/public/characters/SOURCES.md` crediting AniList and listing every source URL.
- Process rule: the controller shows the dry-run manifest, states file count, source and approximate size, and runs `--download` only after the user explicitly confirms. The user has been told the GitHub repo is public and that committing these images may invite a takedown request.
- Frontend `CharacterCard` loads `/characters/${id}.jpg` and, on error or when missing, shows a styled placeholder silhouette with the character's initials.

## 5. Visual design (frontend)

- **Surfaces:** dark brushed-metal/carbon panels with bevelled edges, inner shadows, faint noise and corner screws, instead of flat boxes.
- **Controls:** raised physical keys that sink when pressed, with a neon LED rim when active; a large BID key; chunky +1/+5/+10 quick-bid keys.
- **Readouts:** time and price on LED-style displays in a recessed glass window with a digital-style numeric font; below 5 seconds the display flickers red; the time bar is a row of LED segments that go dark one by one.
- **Character card:** metal frame, glass-reflection overlay, embossed name plate (name and anime), the image in the window. The power slot is a sealed plate reading `???` until Battle, when the seal breaks.
- **Lobby:** room code on an embossed plate; players as slots with an LED online indicator.
- **Battle / Results:** each team's cards flip to reveal power, totals count up, the winner gets a gold plate; ties share the gold plate.
- **Palette:** base `#0a0a14`, metals `#1b1c28` / `#2a2c3a`, neon violet and cyan, hot pink for warnings, gold for winners.
- **Mobile-first:** one column; bid keys sit in a sticky bottom dock; touch targets at least 44 px; animations respect `prefers-reduced-motion`.
- **Fonts:** a display face for readouts and a body face via `next/font/google`, with a Thai-capable fallback so Thai nicknames render.
- **Code shape:** CSS tokens and a few shared classes (`.panel`, `.key`, `.readout`, `.led`) in `globals.css`; new small components (`CharacterCard`, `Readout`, `LedBar`) used by the existing screens. No game logic moves into the frontend.
- Existing behaviours stay as they are: the lobby draft/dirty logic, rejoin, error banner, countdown from `endsAt`.

## 6. Testing

- Backend unit tests (`game/view`): with teams filled, the `AUCTION`-phase view contains no `power` key anywhere (assert on `JSON.stringify`); the `LOBBY` view likewise; `BATTLE` and `RESULTS` views include `power` on every team character; `results` is `null` before `BATTLE`.
- Integration test (real sockets, two players): across a whole game every `room:state` received before the Battle phase has no `power`; at Results the teams and results carry power. All existing tests must keep passing.
- Frontend: `npm run typecheck`, `npm run build`, and a real-browser check at about 390 px and at desktop width covering all five screens, a missing-image fallback, a Thai nickname, and the sealed-power reveal. No frontend unit tests (unchanged from the original spec).

## 7. Deployment

- `vercel.json` and the `.gitignore` update are already committed (`811931d`), so a push to `main` builds correctly on Vercel.
- Pushing to `main` redeploys both Vercel (frontend) and Render (backend). Mixed versions are harmless: an old frontend against the new backend shows missing power values instead of crashing; a new frontend tolerates an old backend (`power` is optional).
- The Render `CORS_ORIGIN` must list `https://animebidbattle.vercel.app` (a user action in Render's dashboard, already requested earlier).

## 8. Out of scope

Sound effects, a second theme, character rarity/tiers, strength hints, an image uploader, changes to auction rules, accounts, any backend rule change other than hiding power.
