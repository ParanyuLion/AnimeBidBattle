# Game and rating-system formulas for turning attributes into one "power" number

Scope note: about 12 tool calls. Many searches returned weak or spam pages. Official publisher formulas are mostly NOT public, and this is flagged below. Items marked "(model knowledge)" have no fetched citation.

## Q1. How do games compute a single rating or "combat power", and what concrete formulas or weights are public?

### Takeaway
Almost every public example is a weighted sum (FIFA-style, normalised to 100%) or a product with dampening (Pokemon GO: Attack linear, DEF and HP under square roots). Cost-based games (Hearthstone, Marvel Snap, TFT) instead fix a price and then check that stats match it (e.g. the "vanilla test"). Official weights from EA, miHoYo and similar are unpublished; only community reverse-engineering exists.

### Cited Findings
- FIFA/FC overall is reportedly a position-specific weighted average of attributes whose weights sum to 100%. No official EA source was found. One anonymous forum reverse-engineering claims 99.6% exact matches on FC 27 data (self-reported, unverified) — [Sortitoutsi comment](https://sortitoutsi.net/comments/get/899617)
- Unofficial weights from that post. Striker: finishing 18, positioning 13, ball control/heading/shot power 10 each, reactions 8, dribbling 7, sprint speed/strength/short passing 5 each, acceleration 4, long shots 3, volleys 2. Centre-back: standing tackle 17, defensive awareness 14, interceptions 13, strength/heading/sliding tackle 10 each, aggression 7, etc. Central midfielder: short passing 17, ball control 14, vision and long passing 13 each, etc. — [Sortitoutsi comment](https://sortitoutsi.net/comments/get/899617)
- The same post claims flat position bonuses (+2 full-backs, +1 keepers/DMs/wide mids) and +1 at mid-80s. Treat as unverified — [Sortitoutsi comment](https://sortitoutsi.net/comments/get/899617)
- Another community page documents a "Player Rating Calculation" for a different football game, in the same weighted-position style — [Soccerverse wiki](https://wiki.soccerverse.com/index.php/Player_Rating_Calculation)
- Pokemon GO CP: Attack enters linearly, while Defense and HP enter only under square roots, so Attack dominates. A GamePress-style generic CP calculator (base + level + stat CP, times rarity/ascension multipliers) exists but its numbers are unsourced and not tied to any real game — [Bulbapedia Combat Power](https://bulbapedia.bulbagarden.net/wiki/Combat_Power) (page returned 403 to my fetch; the description came via search summary), [everycalculators](https://everycalculators.com/cp-calculator-gamepress.html)
- Pokemon GO CP exact formula (model knowledge, not fetched): CP ≈ Attack × sqrt(Defense) × sqrt(Stamina) × CPM² / 10, so geometric-mean style.
- Hearthstone "vanilla test": community rule of about 2 stat points (attack + health) per 1 mana. A 3-mana minion should total about 6 stats; a 1/4 for 3 mana fails. It ignores card text and stat distribution, and some passing cards are still weak — [Dot Esports on stat distribution](https://dotesports.com/hearthstone/news/understanding-card-value-and-stat-distribution-29647) and [Hearthstone Stats wiki](https://hearthstone.wiki.gg/wiki/Stats). The search summary attributed this ratio to the first source and I did not open the page. It is not an official Blizzard formula.
- Custom-card community systems use "1 mana = 2 points" and each effect is priced in points — [r/customhearthstone balance wiki mirror](https://lr.in.psf.lt/r/customhearthstone/wiki/balance)
- Marvel Snap: separate Cost (energy) and Power. The general rule is that higher cost means higher power, but many cards break it deliberately. Energy gives one per turn up to six, with no cap on cards per turn — [Marvel Snap Zone](https://marvelsnapzone.com/how-to-play-marvel-snap-for-beginners/), [Charlie INTEL card list](https://www.charlieintel.com/games/every-card-in-marvel-snap-power-cost-abilities-222833/). No official Second Dinner curve formula found.
- TFT (Set 18 data from one site): pool copies per cost tier 1/2/3/4/5 = 30/25/18/10/9. Shop odds depend on player level (e.g. level 8 = 15/20/32/30/3 %, level 10 = 5/10/20/40/25 %). Cost tiers control availability and scarcity as well as strength — [EsportsTales](https://esportstales.com/teamfight-tactics/champion-pool-size-and-draw-chances)
- TFT tier lists (S through 5) measure unit strength separately from gold cost, and low-cost units can rank high — [EsportsTales tier list](https://www.esportstales.com/teamfight-tactics/best-champion-units-tier-list)
- Gacha games: damage formulas are public (Epic Seven divides damage by Defense + 300, so DEF has diminishing returns; HSR/Genshin scale from ATK, HP or DEF per skill). I found no sourced official CP weights — [Prydwen HSR damage formula](https://www.prydwen.gg/star-rail/guides/damage-formula), [Keqing Mains](https://library.keqingmains.com/combat-mechanics/damage/damage-formula)
- Fantasy-sports auctions use Value Over Replacement: price factor = (league budget after $1 minimums) / (total surplus over replacement), and price = factor × surplus. Example: 1840/7032 ≈ 0.26 — [PFF Art of the Auction](https://www.pff.com/news/fantasy-the-art-of-the-auction-part-1)

### Inferences
- For anime characters, the FIFA-style form (weights normalised to 100%, optionally role-specific) is the simplest transparent method. Pokemon GO's dampened product shows how to stop a single dominant stat from being everything, or conversely how to reward balance.
- "Points per cost" checks (vanilla test) suggest the inverse design for an auction game: derive power first, then check bids against it.
- Hearthstone, Marvel Snap and TFT balance mostly by playtesting and patching, not by formula. A hobby game should expect to tune by feel and playtest.

### Gaps
- Official CP formulas for Genshin, FGO and Dokkan not found (no reliable source).
- Official EA FC overall formula not found; only the unverified reverse-engineering above.
- Yu-Gi-Oh and MTG point costs were not researched (budget). MTG has no official formula; Yu-Gi-Oh uses level and tribute rules, not a point system.
- Marvel Snap power curve numbers: no official source.

## Q2. How do rating systems and crowd-sourced tier lists convert pairwise or ordinal opinions into numbers, and which suits a hobby project with no match data?

### Takeaway
Elo, Bradley-Terry and TrueSkill need match outcomes. Borda and tier-list averaging need only rankings or tier labels, so with no match data the practical choice is tier-label averaging or Borda, optionally refined with pairwise votes via Bradley-Terry.

### Cited Findings
- Elo: E_A = 1 / (1 + 10^((R_B − R_A)/400)); update R' = R + K(S − E). K is the max adjustment per game (Elo: 16 or 32; FIDE 40/20/10; USCF ≈ 800/(N_e+m)). A 100-point edge ≈ 64% expected score, 200 points ≈ 76% — [Wikipedia Elo](https://en.wikipedia.org/wiki/Elo_rating_system)
- Bradley-Terry: P(i beats j) = p_i / (p_i + p_j); with p_i = e^β_i, logit P = β_i − β_j; with scale 400 and base 10 it equals Elo. Fit by iterating p_i = Σ_j w_ij / Σ_j [(w_ij + w_ji)/(p_i + p_j)], normalising by geometric mean — [Wikipedia Bradley-Terry](https://en.wikipedia.org/wiki/Bradley%E2%80%93Terry_model)
- TrueSkill: each player has μ (skill) and σ (uncertainty); the display value is μ − 3σ; the prior is μ0=25, σ0=25/3. The original needs only match rankings, TrueSkill2 adds stats. No minimum sample size is given — [Wikipedia TrueSkill](https://en.wikipedia.org/wiki/TrueSkill)
- Borda: with n candidates, rank r gets n − r points (0-based); highest total wins. Weaknesses: tactical voting, clone/spoiler effects, dependence on irrelevant candidates, no guaranteed Condorcet winner — [Wikipedia Borda count](https://en.wikipedia.org/wiki/Borda_count)

### Inferences
- With no matches, Elo/TrueSkill have nothing to update on. A usable shortcut: collect pairwise "who wins?" votes (e.g. a swipe tool from friends or Discord), then fit Bradley-Terry once and convert to Elo-like points with 400·log10(p). This is my suggestion, not a sourced practice.
- Tier-list averaging (map S..F to numbers, average across voters) is the cheapest. Borda is a rank-only equivalent but suffers from clone effects, e.g. many characters from one series inflating that cluster, and from pool-size dependence.
- Rating-system numbers are relative; a hobby game must rescale them (e.g. to 1 to 100).

### Gaps
- No source found on crowd tier-list averaging methodology; the tier-to-number mapping is my own design.
- No evidence on how many votes a small group needs for stable Bradley-Terry fits.

## Q3. What makes sums of values fair in team-building games, and what causes degenerate strategies?

### Takeaway
Auction budgets already work as a value constraint, and the standard fantasy-sports analysis shows "stars and scrubs" (concentrate money in a few elites) is a viable but high-variance strategy whose strength depends on replacement level. Linear sums reward it whenever the top character is worth more than its price; convexity, caps and scarcity change this.

### Cited Findings
- Stars-and-scrubs concentrates a large budget share in elite players and fills the rest cheaply, giving a high ceiling but low depth. Where replacement value is low, it is attractive; a hybrid with mid-priced bench is common — [RotoWire](https://www.rotowire.com/baseball/article/fantasy-baseball-auction-balancing-stars-scrubs-108918), [Icehockeyman](https://icehockeyman.com/tag/stars-and-scrubs/)
- Auction advice: players overbid stars, so those who hold to their own valuations get bargains later — [Razzball](https://razzball.com/auction-draft-strategy-how-to-survive-overbidding/)
- Value over replacement shows that price should follow surplus above a free alternative, not raw points — [PFF](https://www.pff.com/news/fantasy-the-art-of-the-auction-part-1)
- TFT limits supply through shared pools: higher-cost units have fewer copies (10 and 9 versus 30), and contested copies reduce others' odds — [EsportsTales](https://esportstales.com/teamfight-tactics/champion-pool-size-and-draw-chances), [Tacter](https://www.tacter.com/tft/guides/how-to-get-6-cost-3-star-champions-in-tft-challenger-guide-cfdbfbbd)
- Marvel Snap energy: all plays are limited by energy, with a loose cost/power relation, which is the budget analogue — [Marvel Snap Zone](https://marvelsnapzone.com/how-to-play-marvel-snap-for-beginners/)

### Inferences
- With score = sum of power and a fixed budget, the key quantity is power per price. If power is linear in an intrinsic "value" and bidding is rational, nobody has an edge; edge comes from hidden or mispriced power. Hence reveal-vs-hidden info is a design lever. This reasoning is mine.
- To discourage "always buy the single top card": (a) make top power sublinear/capped relative to price, (b) use a fixed roster size so empty slots cost points (replacement level above zero, i.e. a floor), (c) a budget small relative to top-end price, (d) team-size minimum so scrubs are forced.
- To discourage hoarding money: unspent money gives 0 points (or a small conversion rate below the average points per currency).
- Synergy bonuses (same series, same role) add depth but are hard to balance; keep them small (e.g. +5 to 10%) or skip in a v1. This is my judgment; no source tested.
- Rarity tiers with exponential spacing (below) create a small number of "whale" characters; limit duplicates by scarcity as TFT does.
- Variance: mix of known and hidden power, or small random bonus at reveal, keeps the game fun for non-experts. Judgment, not sourced.

### Gaps
- No published postmortem found on sum-of-values balance in an auction party game specifically.
- No empirical data on degenerate strategies in this genre.

## Q4. Three candidate formulas with worked examples for 5 hypothetical characters

### Takeaway
Weighted stat sum is transparent; tier lookup with an exponential curve is the easiest to explain and tune; percentile mapping guarantees a fixed spread regardless of how scores were produced. A hybrid (tier base times within-tier stat adjustment) is probably best for a party game.

### Cited Findings
Formula shapes are adapted from the FIFA-style weighted average and the Elo/Borda definitions cited in Q1 and Q2; the numeric examples are my own illustration, not sourced.

Hypothetical stats (0 to 100): ATK, DEF, SPD, INT, ABILITY (special powers). Tier assigned by a human.

| Char | Archetype | ATK | DEF | SPD | INT | ABL | Tier |
|---|---|---|---|---|---|---|---|
| A | god-tier fighter | 98 | 90 | 92 | 70 | 99 | S |
| B | genius strategist | 30 | 40 | 45 | 98 | 70 | A |
| C | shounen hero | 75 | 70 | 75 | 60 | 80 | A |
| D | healer/support | 20 | 50 | 40 | 75 | 65 | B |
| E | comic relief | 10 | 20 | 25 | 30 | 15 | D |

**Formula 1: weighted stat sum**
P = 0.30·ATK + 0.15·DEF + 0.15·SPD + 0.15·INT + 0.25·ABL (weights sum to 1.0, as in the FIFA-style normalised weights).
- A = 29.4 + 13.5 + 13.8 + 10.5 + 24.75 = 91.95
- B = 9 + 6 + 6.75 + 14.7 + 17.5 = 53.95
- C = 22.5 + 10.5 + 11.25 + 9 + 20 = 73.25
- D = 6 + 7.5 + 6 + 11.25 + 16.25 = 47.00
- E = 3 + 3 + 3.75 + 4.5 + 3.75 = 18.00
Team sum for all five = 284.15. Optional convex transform power = (P/10)² makes elites matter more: A 84.6, B 29.1, C 53.7, D 22.1, E 3.2. A concave one (sqrt) would do the opposite and fight "buy the top card".
Variant (Pokemon GO style): P = ATK^0.5 · (DEF·SPD·INT·ABL)^(0.125) etc. is possible, but not needed.

**Formula 2: tier lookup on an exponential curve**
power = 100 × r^k, k = steps below S, r = 0.6. Table: S 100, A 60, B 36, C 22, D 13, F 8.
- A (S) = 100; B (A) = 60; C (A) = 60; D (B) = 36; E (D) = 13. Sum = 269.
Weakness: B and C tie. Fix: within-tier adjustment, power = tier_base × (1 + 0.2·(P − P_tier_mean)/50), or use half-tiers (S+, S, S−). With r closer to 1 (e.g. 0.75) top-heavy buying is weaker.

**Formula 3: rank-percentile mapping**
Rank by P from formula 1 (A, C, B, D, E); p = (n − rank)/(n − 1); power = 10 + 90·p^γ, γ = 1.5.
- A p=1 → 100; C p=0.75 → 10 + 90·0.6495 = 68.5; B p=0.5 → 10 + 90·0.3536 = 41.8; D p=0.25 → 10 + 90·0.125 = 21.3; E p=0 → 10. Sum = 241.6.
With γ = 1 it is linear (Borda-like); γ > 1 rewards the top. Strength: the whole pool always spans 10..100 whatever the inputs, so pool-wide sums are predictable. Weakness: a character's power changes when others are added (the Borda irrelevant-candidates issue) and a huge gap (A vs. B) is hidden.

### Inferences
- Pool-wide budget design: set each team's budget so that an average roster of k slots costs about the pool mean power × k; choose bid increments so top characters cost no more than about 30 to 40% of a budget.
- Suggested hybrid: tier base (Formula 2, r≈0.7) with ±15% from weighted stat sum, a floor of 5 for any character, and a rounded integer for display.
- Check balance by simulation: draw random 5-character teams and compare the spread (SD) of sums against the budget's purchasing power; tune r or γ until a "top-heavy" greedy team and a "balanced" team have similar expected totals.

### Gaps
- No public formulas for anime power-scaling (e.g. Dragon Ball power levels); community "power scaling" is subjective. Not researched.
- Numeric parameters (r, γ, weights) are illustrative and untested.
