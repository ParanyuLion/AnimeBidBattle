# Power scaling anime characters: tier systems and a single-number score for a party game

Date accessed: 2026-10-11. Caveat: the VS Battles wiki page itself (vsbattles.fandom.com/wiki/Tiering_System) returned HTTP 402, and the community has moved to vsbattles.com forums. Findings come from search-result summaries and forum or mirror pages, not from the primary wiki page. Where sources disagree this is flagged.

## Q1. VS Battles tier ladder and stat categories: how are they ordered, and is there a numeric mapping?

### Takeaway
VS Battles ranks Attack Potency in lettered tiers (11-C weakest up to High 1-A), where lower number means stronger. Tier borders are defined as energy ranges in Joules or tons of TNT, so the ladder is already an ordered, roughly logarithmic energy scale. No official single-score formula was found.

### Cited Findings
- Low tiers by energy: 10-C is roughly 0 to 40-60 J, 10-B (Human) about 40-106 J, 10-A (Athlete) about 100-300 J, 9-C (Street) 300 J to 15 kJ, 9-B (Wall) 15 kJ to about 0.005 t TNT (~2.09e7 J), 9-A (Small Building/Room) 0.005 to 0.25 t TNT (~1.05e9 J). Mirrors differ on the 10-C to 10-A borders and agree from 9-C to 9-A. — [VS Battles forum, Attack Potency chart](https://vsbattles.com/threads/the-attack-potency-chart.186563/); mirror [Attack Potency, character-stats wiki](https://character-stats-and-profiles.fandom.com/wiki/Attack_Potency)
- Forum-listed midpoints: 9-A ~0.1275 t TNT, 8-C ~1.125 t, 8-B ~55.5 t, 7-C ~52.9 kt, 4-B ~10.04 TeraFoe. These are community working values, not the chart itself. Midpoint is the average of the tier's low and high ends. — [same thread](https://vsbattles.com/threads/the-attack-potency-chart.186563/)
- Tier borders are described as arbitrary and not matching the objects they are named after. Tiers 9-A to 3-B should be given only from accepted calculations or precise stated values. Lower borders of 5-B, 4-C, 4-B, 4-A, 3-C and 3-B serve as standard planet, star, solar system and galaxy calculations. — [same thread](https://vsbattles.com/threads/the-attack-potency-chart.186563/)
- Other fandoms copy this: Devastation Overdrive says its tiering is taken from VS Battles. — [Devastation Overdrive Wiki](https://devastation-overdrive.fandom.com/wiki/Tiering_System)
- Stat categories, the fixed set: Attack Potency (destructive energy), Speed (attack, combat, reaction, travel), Durability, Striking Strength, Lifting Strength, plus range, stamina, intelligence. Each has its own tier-style label. Names of the five come from the task brief; I did not retrieve a page listing all category definitions.
- A "universal energy system" page exists on the wiki and staff say it is often misapplied. — [staff thread](https://www.vsbattles.com/threads/staff-only-universal-energy-system-page-is-flawed.160541/)

### Inferences
- Tier letters ordered by number (11 < 10 < 9 ... < 1) make a clean ordinal list; with the borders in Joules, log10(Joules) is a ready numeric. Low tiers (human to building) span about 1e1 to 1e9 J, while high tiers (planet and up) are about 1e32+ J. Roughly 30+ orders of magnitude separate a human from a planet-buster.
- Most anime characters in a party game will sit between 10-B and about 2-A at the extreme, with a big cluster in 9-x to 7-x for shonen mains.

### Gaps
- Primary Tiering System page unreachable (HTTP 402); exact current borders for 8-x through 1-A and the High 1-A definition were not verified.
- No official numeric mapping per tier found.

## Q2. Typical failure modes when comparing characters across series

### Takeaway
The big failures: statements and hyperbole versus feats, hax or abstract powers that ignore stats, inconsistent scaling between energy and physical strength, and fan bias. VS Battles itself keeps rules on these but staff admit inconsistencies.

### Cited Findings
- Hyperbole: a claim far outside anything shown in that universe is most likely hyperbole, yet hyperbole is often used as evidence in debates. — [VS Battles Wiki: Hyperbole](https://vsbattles.fandom.com/wiki/Hyperbole)
- Layered hax: a stronger-sounding hax does not automatically bypass a weaker one; bypass needs a statement or strong implication. — [Layered hax thread](https://vsbattles.com/threads/regarding-how-we-treat-layered-hax.147686/latest)
- Energy-to-physicals scaling: staff argue it requires showing attacks draw the same energy and that more energy gives proportionally more power, with exceptions; another thread says magic should not scale to physicals without a consistent magic system. — [staff thread](https://www.vsbattles.com/threads/staff-only-universal-energy-system-page-is-flawed.160541/); [magic to physicals thread](https://vsbattles.com/threads/why-dont-we-scale-ice-creation-to-physicals.121883/post-4017038)
- Inconsistent justification: some listed feats fall well short of the tier they support. — [Non-concordance thread](https://vsbattles.com/threads/non-concordance-in-justification.91487/latest)
- Emanator / HSR downgrade controversy shows tiers being revised after community argument. — [vsbattles thread](https://vsbattles.com/threads/how-emanators-fooled-the-internet-hsr-emanator-downgrade-mods-needed.189022/post-7600718)
- Naruto databook stats are not accepted on the wiki because of inconsistencies and the authors' apparent unfamiliarity with their own characters. — [Naruto databook thread](https://vsbattles.com/threads/naruto-databook-skill-parameters.116957/latest)
- Tier borders partly "come from nowhere" per forum posters. — [Attack Potency thread](https://vsbattles.com/threads/the-attack-potency-chart.186563/)

### Inferences
- Reality warpers, time stoppers, sealing and instant-death abilities (e.g. JoJo, Gojo-style) break any stat-only ranking: AP tier says little about who wins. For a casual game, a "wins by hax" outlier needs a manual bump or a cap.
- Scaling chains (A beat B, B beat C) amplify errors. Fan bias shows up as inflated tiers for popular characters; use one person's or a fixed list's judgment instead of live debate.

### Gaps
- No quantitative study of tier-assignment inconsistency found.
- Plot armor is a commonly cited failure mode but I found no specific source in this search.

## Q3. Official in-universe numeric systems and comparability

### Takeaway
Each series' system is internally meaningful but not cross-comparable: DBZ numbers are an unbounded linear scale, JoJo is a 1-5 grade, JJK is an 8-step rank ladder, One Piece bounties are in-world money tied to threat and politics, Bleach Spirit Class is 1-20 (lower stronger). Only a normalization step per series makes them usable.

### Cited Findings
- JoJo: stats are Power, Speed, Range, Stamina (durability), Precision, Potential/Development, graded E to A, with the JoJo Wiki mapping to numbers ∞=6, A=5, B=4, C=3, D=2, E=1. Grades on fan wikis are interpretations; the series does not publish official grades for all. — [JoJo Wiki Stand Stats](https://jojowiki.com/Stand_Stats); [Template:Stats](https://jojowiki.com/Template:Stats)
- Dragon Ball: Frieza states a 530,000 power level; first-generation scouters explode above 24,000, second generation reaches at least 180,000. Guidebooks (Daizenshuu, Jump publications) gave numbers for characters never scouted on screen. In-series readings stopped once scouters were destroyed. A fan thread notes a later film's figure may conflict with the scouter idea (speculation). — [Dragon Ball Wiki: Scouter](https://dragonball.fandom.com/wiki/Scouter); [TV Tropes: Powerlevel](https://tvtropes.org/pmwiki/pmwiki.php/Main/Powerlevel); [Kanzenshuu thread](https://www.kanzenshuu.com/forum/viewtopic.php?p=1578313)
- Jujutsu Kaisen: ladder Grade 4, Grade 3, Semi-Grade 2, Grade 2, Semi-Grade 1, Grade 1, Special Grade 1, Special Grade (8 levels per one source). Grade is the sorcerer's rank, not strictly power: Maki is Grade 4 as a rank despite strength, Gojo and Yuta are Special Grade. Sources (fan and entertainment sites) differ on exact placement. — [WeGotThisCovered](https://wegotthiscovered.com/news/how-the-sorcerer-ranking-works-in-jujutsu-kaisen/); [Sportskeeda special grades](https://www.sportskeeda.com/anime/all-special-grade-sorcerers-jujutsu-kaisen-ranked)
- One Piece bounties (Berries), widely reported: Roger 5,564,800,000; Whitebeard 5,046,000,000; Kaido 4,611,100,000; Big Mom 4,388,000,000; Shanks 4,048,900,000; Blackbeard 3,996,000,000; Mihawk 3,590,000,000; Luffy, Law, Kid 3,000,000,000 each. Some sources are outdated (Luffy 1.5B). Bounty reflects threat to the Government, and fans argue Luffy's should be higher. — [Looper](https://looper.com/1378478/one-piece-highest-bounty-ever-achieved-in-series); [Sportskeeda](https://sportskeeda.com/anime/one-piece-top-10-highest-bounties)
- Naruto databooks 1-3: Ninjutsu, Taijutsu, Genjutsu, Intelligence, Strength, Speed, Stamina, Hand Seals, rated in half-points up to 5; no official total; stopped after databook 3. Examples: Kakashi sums to 34.5/40, Genma 27/40, Shippuden Naruto 26/40 (sums are the searcher's own). — [Naruto databook thread](https://vsbattles.com/threads/naruto-databook-skill-parameters.116957/post-3785421)
- Bleach: Spirit Class 1 to 20, lower is stronger/denser; captains 1-3, lieutenants 4-5, Kaien Shiba recorded at 6. Secondhand fan wiki. — [Bleach Wiki: Reiatsu](https://bleach.fandom.com/wiki/reiatsu)

### Inferences
- The simplest consistent normalization is "rank within own series" mapped to a shared 1-10 band; do not use raw numbers (530,000 vs 5 vs Berries).
- Bounty is the most usable raw number for a bidding game because it is a monetary figure; but it exists only for One Piece.

### Gaps
- Hunter x Hunter: no official numeric system found (Nen has six types and no ranking; Hunter licence stars and the Hunter Association's Beyond Net aren't power scales). Not searched in depth.
- Bleach Official Character Book stats and Fullbring not found. Naruto Bingo Book / ranks (Genin to Kage, S-rank) not retrieved.
- Wikipedia pages on DBZ power level and JoJo stats were not fetched.

## Q4. Known simple formulas for tiers to numbers, and Q5. Recommended conversion methods

### Takeaway
No community-standard formula was found. The practical way is to build it ourselves: map tier to a log-energy or rank value, then add a small stat term, then scale to a friendly range.

### Cited Findings
- A search for an official VS Battles tier-to-number formula found none; only joke "power level generator" threads and baseline-multiple notation. — [VS Battles Multipliers page](https://vsbattles.fandom.com/wiki/Multipliers); [vsbattles post](https://vsbattles.com/vsbattles/2692782)
- The wiki's own borders are in Joules/tons TNT, which supports a log mapping. — [Attack Potency thread](https://vsbattles.com/threads/the-attack-potency-chart.186563/)
- JoJo Wiki already uses 1-6 numeric grades. — [JoJo Wiki Template:Stats](https://jojowiki.com/Template:Stats)

### Inferences (my own proposals, not from sources)
1. Tier ordinal to points (rank-to-points table). Give each tier a fixed number (e.g. 10-B=10, 9-A=30, 8-B=40, 7-A=55, 5-B=70, 3-A=90, High 1-A=100), possibly after compressing to a handful of buckets (human, street, city, planet, universe, beyond). Pros: trivial, readable, easy to hand-tune. Cons: coarse, ties, still needs someone to assign tiers; relies on VS Battles tier labels per character.
2. Log-energy score. score = clamp((log10(Joules) - 1) / (max - 1)) x 100, using tier midpoints. Pros: principled, uses wiki borders. Cons: gaps are huge (30+ orders of magnitude), so most characters bunch at the top or the scale needs piecewise compression; hax characters fall outside it; lifting/durability need separate numbers.
3. Blend: base tier points (60-70%) + average of 3-4 stat grades converted 1-5 (speed, durability, striking, hax/versatility), JoJo-wiki style, plus a manual "hax bump" of 0-10 for reality warpers and instakillers. Pros: separates characters in the same tier, handles outliers explicitly, still one number. Cons: more data entry, subjective grades, fan bias creeps in.
4. Whichever is chosen: hardcode the final numbers in the character list (curated by a person) rather than computing live, add small random jitter or hidden fudge only if ties matter, and keep a "disputed" flag for known contested characters.

### Gaps
- No existing game or tier-list site's published formula was found; I did not search game-design blogs. The above are suggestions, not precedents.
