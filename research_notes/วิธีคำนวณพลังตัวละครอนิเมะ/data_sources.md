# Data sources for estimating anime character "power" (hobby, non-commercial)

Research date: 2026-10-11. Items marked "tested" were verified by me with small live requests from this machine.

## 1. AniList GraphQL: character fields, combat data, rate limits

### Takeaway
AniList exposes popularity-style and biographical fields only (favourites, description, gender, age, media list with popularity/score). It has no combat or power data. Its documented limit is 90 req/min, but the docs currently say a degraded 30/min applies. A ~32-character game is far below either.

### Cited Findings
- Tested (introspection of type `Character` against https://graphql.anilist.co): fields are `id, name, image, description, gender, dateOfBirth, age, bloodType, isFavourite, isFavouriteBlocked, siteUrl, media, favourites, modNotes`. There is no stat, ability or tier field. — [AniList GraphQL endpoint](https://graphql.anilist.co) (introspection result)
- `description` is free text (often fan-written markdown/spoiler tags) and could feed an LLM, but is not structured combat data. — same introspection
- `media` is a MediaConnection. In my test, per-media `popularity` and `averageScore` were returned (e.g. Jujutsu Kaisen popularity 982445, score 84). Role (MAIN/SUPPORTING/BACKGROUND) is on the connection edge `characterRole` (from my knowledge of the schema; not tested). — [AniList GraphQL endpoint](https://graphql.anilist.co)
- Tested: `Page{characters(sort:FAVOURITES_DESC)}` works. Top by favourites at test time: Satoru Gojou 39205, Levi 38186, Luffy 35976, Killua 34706, Eren 31767, Zoro 28830, Lelouch 28314, Emilia 27727, L 26496, Kaneki 26002. This list is dominated by charisma and looks, not strength (Emilia, L, Reigen, Mikasa appear next to Gojo). — [AniList GraphQL endpoint](https://graphql.anilist.co)
- Tested response headers: `X-RateLimit-Limit: 30`, `X-RateLimit-Remaining: 29`. — [AniList GraphQL endpoint](https://graphql.anilist.co)
- Docs (via search summary): normal limit 90 requests/min; the rate-limiting page says the API is in a temporary degraded state of 30/min, "not currently reflected in the headers" (but my test header showed 30). Exceeding the limit gives a one-minute timeout with `Retry-After` / `X-RateLimit-Reset`. During outages limits may be lowered or access suspended. — [AniList rate limiting](https://docs.anilist.co/guide/rate-limiting), [AniList considerations](https://docs.anilist.co/guide/considerations)
- Terms (via search summary): non-commercial use is free; the terms prohibit using the API as a backup/data store and bulk collection or hoarding of data; apps using "AniList" in their name must say they are unofficial; commercial use under $150/month revenue is free, above that requires a license (contact@anilist.co). — [AniList terms of use](https://docs.anilist.co/guide/terms-of-use)
- I could not open the docs pages directly with the fetch tool (HTTP 403), so the terms and limit text above comes from a search summary; verify it by hand.

### Inferences
- Fetching ~32 characters in one batched query (or a few queries) is well within limits. The stored JSON should hold only the handful of fields the game needs, with a link to the AniList page, to stay clear of the "no data store / hoarding" clause. Saving a small curated set for a hobby game is probably fine, but it is a grey area, so keep it minimal.
- AniList can supply only a popularity proxy (favourites, media popularity), never a strength measure.

### Gaps
- Exact current wording of the AniList terms regarding caching a small number of characters; the pages were not directly readable.
- Whether the 30/min degraded state is still in effect in Oct 2026 (the header suggests yes at test time).

## 2. MyAnimeList / Jikan, Kitsu and other APIs

### Takeaway
Jikan (unofficial MAL scraper API) and Kitsu offer character popularity-type data only (favorites count / rank on MAL), no power data. I could not verify Jikan's numeric rate limit or Kitsu's character fields from primary sources.

### Cited Findings
- Jikan is an unofficial REST API for MyAnimeList.net that scrapes the site; it is not affiliated with MAL and does not support authenticated requests. — [jikan-me/jikan-rest](https://github.com/jikan-me/jikan-rest)
- Jikan docs say they cover rate limits, character endpoints and character fields such as favorites, but the fetched text gave no numbers. — [Jikan v4 docs](https://docs.api.jikan.moe/)
- Kitsu: the community JSON:API docs mention character attributes (favorites, rank) and rate limits/terms, but the fetch gave no details. — [Kitsu API docs](https://hummingbird-me.github.io/api-docs/)
- A Kaggle dataset snapshot of the MyAnimeList character database (July 2025, 200,000+ characters) exists. It is popularity and biography oriented, not combat stats. — [Baselight listing of the Kaggle dataset](https://baselight.app/u/kaggle/dataset/sazzadsiddiquelikhon_anime_character_database_july_2025)
- Search found no Kitsu official rate-limit statement; a wrapper library applies its own 10 req/s client ceiling and says the limit is not formally published. Treat that as a wrapper choice only. — [askitsu / animedex docs via search](https://animedex.readthedocs.io/en/latest/tutorials/backends/kitsu.html)
- My attempt to call `api.jikan.moe` from this machine timed out (no response in 20 s), so I could not test response shape. Kitsu test failed on my own curl URL globbing, not verified.

### Inferences
- From memory (not verified here), Jikan v4 documents about 3 req/s and 60 req/min and MAL character data includes a `favorites` count. Verify before relying on it.
- MAL favorites and AniList favourites are two views of the same popularity signal; combining them reduces noise a little but does not add strength information.

### Gaps
- Jikan's exact rate limit and terms, Kitsu's exact character attribute list and terms: not confirmed. MAL's official API terms for hobby use were not researched.

## 3. Structured power datasets / VS Battles Wiki API

### Takeaway
No ready-made open dataset of anime character power levels was found. The best structured source is VS Battles Wiki (Fandom, MediaWiki API, CC BY-SA text), where the tier is in wikitext templates like `{{High 7-C}}` that can be regex-parsed. It is fan-curated and often contested, with multiple forms per character.

### Cited Findings
- Search found no GitHub/Kaggle dataset of power levels; results were game tier lists and the MAL character dataset. The closest thing is the VS Battles Wiki itself. — search results incl. [Baselight Kaggle listing](https://baselight.app/u/kaggle/dataset/sazzadsiddiquelikhon_anime_character_database_july_2025), [VS Battles forum](https://vsbattles.com/threads/stone-walls-and-glass-cannons.185514/latest)
- Tested: the wiki exposes the standard MediaWiki API at `https://vsbattles.fandom.com/api.php` (no key required).
- Tested search: `https://vsbattles.fandom.com/api.php?action=query&list=search&srsearch=Saitama&srlimit=1&format=json` returned the page "Saitama" (pageid 11706, 6328 words, last edit 2026-09-27). Note that the page title can differ from the character name or have disambiguation (e.g. `Saitama_(One-Punch_Man)` title does not exist), so search first.
- Tested sections: `https://vsbattles.fandom.com/api.php?action=parse&page=Satoru_Gojo&prop=sections&format=json` lists sections: Summary, Powers and Stats, Notable Matchups, References.
- Tested content: `https://vsbattles.fandom.com/api.php?action=query&titles=Satoru_Gojo&prop=revisions&rvprop=content&rvslots=main&format=json&rvsection=2` returns the "Powers and Stats" wikitext. The first line is, for Gojo: `'''Tier:''' '''Unknown''' physically, at least {{High 7-C}} with Cursed Technique Reversal: Red, ... | {{High 7-C}} physically, {{Low 7-B}} with ... Red, {{7-B}} with ... Purple`. Then Key (Past | Present), Name, Origin, Gender, Age, Classification, Powers and Abilities, and further down Attack Potency, Speed, Lifting Strength, Striking Strength, Durability, Stamina, Range, etc. (the later fields were not displayed in my truncated test output, but are standard on the wiki).
- The Gojo page carries an `{{Outdated}}` banner, and the tier line shows several values per form/era. A parser must pick one rule (for example, take the highest tier in the last `|` segment, i.e. "Present").
- Tier scale: the wiki uses tiers from 11-C (below human) up to 0, defined by destructive-output ranges; a forum member says the boundaries below tier 2 and above 11 are number ranges tied to destroyed object sizes and "a good chunk of our attack potency borders come from nowhere". — [VS Battles forum thread](https://vsbattles.com/threads/stone-walls-and-glass-cannons.185514/latest). (The primary page, https://vsbattles.fandom.com/wiki/Tiering_System , could not be fetched directly, HTTP 402.)
- `meta=siteinfo&siprop=rightsinfo` returned `{"url":"https://www.fandom.com/licensing","text":"CC-BY-SA"}`: the wiki text is CC BY-SA. — tested at https://vsbattles.fandom.com/api.php, and [Fandom licensing](https://www.fandom.com/Licensing) (via search: CC BY-SA 3.0 unless a wiki says otherwise; attribution via a link to the article or the author list is acceptable; CC licensing usually covers text, not copyrighted images) ; see also [Community Central: Help:Licensing](https://community.fandom.com/wiki/Help:Licensing)
- Practical note: Fandom's own page is not directly fetchable by simple tools, but the plain `api.php` worked with a custom User-Agent.

### Inferences
- Storing only a derived number and a `source: "VS Battles Wiki (CC BY-SA)"` link per character is likely adequate attribution for a hobby game; derived numbers are not copied text. Do not copy wiki prose.
- Query recipe: (1) `list=search` to get the page title; (2) `action=parse&prop=sections` to find "Powers and Stats"; (3) `prop=revisions&rvsection=N` for the wikitext; (4) regex `\{\{(Low |High |Unknown )?[0-9]-?[A-C]?\}\}` / `Tier:` line to get tier tokens. Only ~32 characters x 3 requests, so a handful of small requests is enough; use a descriptive User-Agent and a delay.
- Tier is a coarse order-of-magnitude scale on destructive output (attack potency); it ignores skills, abilities, and "feats vs concept" powers (e.g. Gojo's "Unknown physically"). Tiers up to the thousands of characters on the wiki give low resolution at the top and are heavily "outlier" - convert with caution (the scale is roughly logarithmic, so mapping tier to a score should be piecewise/log, not linear).

### Gaps
- Primary wiki rules on the tier scale and the wiki's per-statistic definitions (Attack Potency vs Speed vs Durability) could not be fetched. Wikidata has no power-level property that I found (not searched deeply). Other power-scaling wikis (Character Stats and Profiles, Powerlisting) were not checked.
- Full licensing check that Fandom's API ToU allows automated access for this volume was not done.

## 4. Popularity vs in-universe strength

### Takeaway
Popularity (favourites) is a poor proxy for strength. It reflects design, personality, fandom size and series reach, so using it as the power score would make a game feel wrong to knowledgeable fans.

### Cited Findings
- Tested: the top-10 characters by AniList favourites include Emilia, L Lawliet, Mikasa, Arataka Reigen (a con-man who is weak by his series' standards) next to Gojo, Luffy and Eren, so popularity visibly does not track power. — [AniList GraphQL endpoint](https://graphql.anilist.co)
- Per-title `popularity` varies by series audience size (JJK ~982k vs Code Geass ~506k), so favourites also carry a series-reach bias. — same query
- I found no published study quantifying the correlation between favourites and in-universe strength.

### Inferences
- The correlation is likely weak to moderate and mainly via protagonists/main roles in action series (author-intended "strength" and popularity are partly linked in shonen). Support characters, strategists and fan favourites (L, Reigen, Emilia) break it.
- Useful role: popularity is better as a "bid price/hype" factor or a tiebreaker/small fraction (<=10-20 % weight) than as the power score. A game about bidding on characters may actually want both: hidden power plus a visible popularity signal.

### Gaps
- No empirical correlation figure; could be computed once on the ~32 characters by joining AniList favourites with VS Battles tiers.

## 5. LLM-assisted, human-reviewed one-time scoring

### Takeaway
A one-time offline LLM pass that reads a short, supplied wiki excerpt and outputs structured stats is practical for 32 characters, provided the model is given the source text (not asked from memory), outputs are stored with a rationale, and a human reviews every row.

### Cited Findings
- General LLM weaknesses: fabricating plausible but unsupported facts and misattributing sources. — [Yale AI hallucinations resource](https://ai.yale.edu/hallucinations)
- Memorization grows with model size, and training data includes subjective fiction/opinion content. — [Survey on Hallucination in LLMs](https://arxiv.org/pdf/2311.05232), [LangChain course note](https://langchain.super.site/training-fine-tuning-llms-course/understanding-hallucinations-and-bias)
- I found no study testing LLMs on fictional power-level or tier estimation specifically.

### Inferences
- Pros: cheap, consistent rubric across series, handles multi-form characters, can compress wikitext to a 0-100 score and a one-line justification; one-time cost, no runtime API.
- Cons/risks: hallucinated feats; bias toward whichever fan consensus (e.g. shonen protagonists, "Gojo is strongest") was most common online; inconsistent scale between series if the model is run per-character without anchors; opaque reasoning; wiki text itself is contested.
- Mitigations: pass the actual wiki "Powers and Stats" text; use fixed anchor characters (e.g. a weak human = 10, Saitama = 90) in the prompt; demand JSON with tier, 1-5 sub-scores (offence, defence, speed, versatility), confidence, and a quote from the source; run twice and flag disagreements; human review and override; store `source`, `method`, `reviewed: true`.
- Licensing: LLM output derived from CC BY-SA text should carry the attribution regardless.

### Gaps
- No empirical accuracy measure; the only check available is comparing with the wiki tier and human opinion.

## 6. Recommended pipeline

### Takeaway
Use VS Battles tier as the backbone, an LLM or hand rubric to fill gaps and handle versatility, AniList only for IDs/images/popularity, and a human-edited JSON as the single source of truth.

### Cited Findings
- AniList for images/popularity (already integrated), 30-90 req/min — [AniList rate limiting](https://docs.anilist.co/guide/rate-limiting)
- VS Battles `api.php` plus CC BY-SA text — see section 3.

### Inferences (proposed pipeline)
1. Seed: `data/characters.json` (id, name, anime). Resolve each to an AniList id (already done for images) and pull `favourites` + media `popularity` once (1-2 queries).
2. Fetch (script, run once, 1 req/s, custom User-Agent): `list=search` -> pick page -> `parse&prop=sections` -> `rvsection` wikitext for "Powers and Stats". Cache raw wikitext in a gitignored `research_cache/` folder.
3. Parse: extract the `Tier:` line, take a tier token per form; record all forms plus the chosen "reference form" (e.g. the highest canonical present-day form, applied consistently).
4. Normalize: map tier to a log-like score. A starting table: 11-C -> 5, 9-C -> 20, 8-A -> 35, 7-C -> 45, 6-C -> 55, 5-B -> 65, 4-B -> 75, 2-C -> 85, 1-A/0 -> 95-100 (illustrative values, tune by hand). Then adjust +/- for speed/durability/abilities (versatility) from a rubric, or from the LLM sub-scores, capped at +/- 10. Use popularity only as a minor tie-break (<=10 %) or keep it as a separate displayed field.
5. LLM pass (optional, offline): input wikitext excerpt + anchor characters; output JSON {tier, offence, defence, speed, versatility, confidence, rationale, evidence_quote}. Run twice; flag rows where they disagree by >10 or where the wiki tier is "Unknown".
6. Human-in-the-loop: generate a review table (name, wiki tier, computed score, LLM score, rationale, link). Edit an `overrides` block by hand; keep `power`, `powerSource` ("vsbattles+manual"), `powerNotes`, `reviewed` fields in `characters.json`; a lint script checks range, duplicates and ordering sanity (e.g. known matchups like Saitama > Naruto per your taste).
7. Attribution: a credits line "Power estimates derived from VS Battles Wiki (CC BY-SA 3.0), adjusted by the game author" plus the AniList credit.

### Gaps
- The tier-to-score numbers above are my illustrative proposal, not from any source.
- Whether the game wants "canonical strength" or "fan-perceived value" (popularity) is a design decision; the data sources can supply either but not both from one place.
