# Auction balance and power-value distribution for a hidden-information anime bidding party game

Scope: design principles and numeric recommendations for character power values in a game with an open ascending auction, hidden power revealed only at the Battle phase, a fixed coin budget (e.g. 1000), no team-size cap, and team score = sum of power. Sources checked 2026-10. Search tools returned mostly summaries; items marked (secondary) were not verified in the primary text. Items labelled "Own simulation" come from a quick Monte Carlo I ran (code in the scratchpad `sim.py`; crude, see caveats).

## 1. What do value spread and budgets teach in auction games? Which power distribution (linear, exponential, long-tailed, tiered) fits?

### Takeaway
Auction games and fantasy auction drafts show that a hidden or uncertain value plus a fixed budget produces overpaying at the top, since winners are the most optimistic estimators (winner's curse). The distribution matters less for "fairness" than for how often one item decides the game. A tiered, mildly top-heavy curve (top item roughly 2.5-3x the median item, top 3 items under about 15% of total pool) keeps knowledge rewarded without making any one character decisive.

### Cited Findings
- Modern Art: an item's worth depends on what the table does, with only the top three artists paying out each round, so some players are stuck with worthless purchases. This is hidden/emergent value with built-in risk. — [Modern Art Review (Roll to Review)](https://rolltoreview.com/modern-art-review-auction-strategy-game/); [Wikipedia: Modern Art](https://en.wikipedia.org/wiki/Modern_Art_(game))
- Modern Art strategy guidance: a buy at $19 resold at $20 looks like a win but success depends on predicting the outcome, not margins. — [My Board Game Guides: Modern Art strategy](https://www.myboardgameguides.com/game-strategy/game-specific-strategy/modern-art-game-strategy-guide)
- Ra: the sun-disc distribution is fixed and public so that bidding power is balanced, unspent suns are wasted when the epoch ends, and tile values depend on context/sets. The bid currency is deliberately constrained and visible. — [Wikipedia: Ra](https://en.wikipedia.org/wiki/Ra_(board_game)); [Roll to Review: Ra](https://rolltoreview.com/ra-board-game-review/) (source discrepancy on sun counts by player count)
- Power Grid: the leader bids first and the last-place player last, a catch-up mechanism; reviewers note someone always overpays by holding out one bid too long. Plant price must be weighed against ongoing cost (efficiency) rather than sticker value. — [Wikipedia: Power Grid](https://en.wikipedia.org/wiki/Power_Grid); [There Will Be Games review](https://www.therewillbe.games/articles-boardgame-reviews/1874-power-grid-a-calculated-assessment)
- Winner's curse: in common-value auctions with noisy private estimates, the highest bidder is usually the most upward-biased estimator; experiments (Kagel and Levin, 1980s) show systematic overbidding that persists with repetition; the remedy is bid shading. — [Wikipedia: Winner's curse](https://en.wikipedia.org/wiki/Winner%27s_curse); [UCLA Anderson Review](https://anderson-review.ucla.edu/what-causes-overbidding-in-auctions/)
- Fantasy auction drafts: "stars and scrubs" (70-80% of budget on 2-3 elite players) maximizes upside but costs depth. — [Fantasy Full Time](https://fulltimefantasy.com/?p=199918); [RotoWire](https://www.rotowire.com/baseball/article/fantasy-baseball-auction-balancing-stars-scrubs-108918)
- No clear winner between stars-and-scrubs and balanced builds: BaseballHQ found the gap small; PFF commentary says managers tend to overspend on the elite tier, and the second tier can be inflated when the elite tier is not. — [BaseballHQ Master Notes](https://www.baseballhq.com/articles/archives/master-notes-ss-or-str); [PFF Art of the Auction Part 3](https://www.profootballfocus.com/fantasy-the-art-of-the-auction-part-3/); [Fangraphs retrospective](https://fantasy.fangraphs.com/stars-and-scrubs-vs-balancing-a-retrospective)
- Inflation in auction drafts is computed as remaining budget divided by remaining projected value; this is the standard way players estimate "price per point". — [RotoWire keeper auction tips](https://www.rotowire.com/baseball/article/the-long-game-keeper-auction-strategy-tips-44535)
- Pokemon draft leagues: budget of 100 points for 10 Pokemon (Wolfey), 90 points for exactly 8 (ADV draft), prices from 1 to 19-20, and no reward for saving points. BST-based default pricing: S 12, A 10, B 8, C 6, D 4, E 2 (ratio top:bottom = 6:1). Smogon advises "top-heavier" drafts tend to do better in most settings. — [Wolfey Draft League](https://wolfeydraftleague.com/about); [Smogon ADV Draft guide](https://www.smogon.com/forums/posts/10899152); [PokeTools draft assistant](https://www.poketools.com/draft-assistant); [Smogon Beginner's Guide to Draft League 2](https://www.smogon.com/articles/beginners-guide-draft-2)
- Schreiber/Romero, Game Balance: in transitive (cost-for-power) systems, cost and benefit may be equal or follow a non-linear ratio where price rises faster as power grows; everything depends on finding the right cost curve, usually by playtesting; AI players repeatedly playing a game can test whether any strategy wins too often (secondary summaries, not the primary text). — [Game Balancing Notes (Mechanics of Magic)](https://mechanicsofmagic.com/2023/11/29/game-balancing-notes/); [Routledge: Game Balance](https://www.routledge.com/Game-Balance/Schreiber-Romero/p/book/9781498799577)
- Linear curves are predictable; uncapped exponential values become hard to comprehend (secondary). — [Game Economy (UserWise)](https://blog.userwise.io/blog/the-mathematics-of-game-balance)

### Own simulation (4 players, 60 characters, 1000 coins each, sequential ascending auction approximated as second-highest max bid +1; bidders see power * lognormal noise and bid est * (remaining budget / fair-share remaining pool))
Pool shapes (power values in parentheses): tier5 = 3x100, 7x60, 15x35, 20x20, 15x10 (total 1795); linear 100 to 10 (total 3300); exp = 100*exp(-0.06 i) (total 1670); pareto = 100/(i+1)^0.9 (total 564); flat = all 40.
- With four equal bidders (noise sigma 0.5), winner's share of total pool is 28-29% for tier5, linear, exp and flat; 31.5% for pareto. Win rates stay near 25% each in all five pools (tier5 27/27/25/21 within noise).
- Skill reward: a bidder with sigma 0.15 against 0.5, 0.5, 1.0 wins 90% (tier5), 97% (linear), 86% (exp), 65% (pareto), 99% (flat). Heavy long tail (pareto) dilutes skill reward because luck on 2-3 items dominates; flat/linear reward precision most, but a flat pool means knowledge barely matters for what to buy, only for not overpaying. The tiered pool gives a strong but not total skill edge (~90%).
- Pareto is the only shape where the winner's total share rises noticeably (31.5%) and skill edge falls (65%): evidence that a heavy tail makes the top 1-2 characters decisive.
- Strategies (own sim): a naive "spam cheap" bidder (caps bids at 12 coins) ended with 14 to 54 power on average versus ~450 for fair bidders in tier5; "star hunter" (1.8x bids on est > 55% of top, 0.3x otherwise) trailed fair bidders by a modest margin (464 vs 643 in tier5); a "shade 0.85" bidder beat a "fair 1.0" bidder in every pool (tier5 56% vs 43% win share; linear 65% vs 34%). Interpretation: bid shading (winner's curse correction) pays; hoarding coins and buying cheap does not, because unspent coins score nothing.
- Caveat: bots are crude, play was symmetric, noise was i.i.d. per bidder (real fandom noise is correlated: everyone thinks Goku is strong), no bluffing/denial. Treat as directional only.

### Inferences
- Because the sum-of-power win condition is linear and purchases are additive, the pool shape matters mainly via (a) variance contributed by top items and (b) how correlated knowledge is. Tiered with a modest top (about 10:1 top:bottom, not 100:1) is the safest.
- Fantasy and Pokemon-draft evidence suggests that a moderately top-heavy curve is acceptable and even desirable (players like owning a "star"), but should not exceed ~3% of total pool per top character.
- The winner's curse is the central dynamic: the fun of the game is largely "who overpaid for the hyped character". Keeping noise high enough around top characters preserves this.

### Gaps
- No primary-source numeric analysis of Power Grid or Modern Art value spreads (price vs. value regressions) was found.
- No published study of party-style hidden-value auctions (e.g. Price is Right) fitting this exact format.
- Schreiber's original Game Balance Concepts blog posts were not opened; only secondary summaries.

## 2. Should price paid relate to power? Fixed budget, no team cap, and total power vs total budget

### Takeaway
Price should correlate with power through player estimation only; do not hard-link it. With a fixed budget and no cap, unspent coins are worth nothing, so the budget forces spending and "buy many cheap" is not dominant if the lowest-tier characters have meaningfully positive power and prices cannot go below a minimum increment. Calibrate total pool power so the average coin buys a roughly constant amount (e.g. 1 power point per ~15-25 coins) and set a minimum bid so the count of items a player can buy is finite.

### Cited Findings
- Pokemon draft leagues explicitly use fixed budgets with exact roster sizes and no reward for saving points; this closes the "hoard" and "take-many" loopholes. — [Smogon ADV Draft guide](https://www.smogon.com/forums/posts/10899152); [Wolfey Draft League](https://wolfeydraftleague.com/about)
- In auction drafts, reserving $1-$2 per roster spot is standard because the minimum bid fixes the cost of filling a roster; stars-and-scrubs players are "stuck with $1 players." — [Fantasy Full Time](https://fulltimefantasy.com/?p=199918); [RotoWire](https://www.rotowire.com/baseball/article/fantasy-baseball-auction-balancing-stars-scrubs-108918)
- Auction inflation is remaining budget / remaining projected value; markets overpay stars early and bargains appear later. — [RotoWire keeper auction tips](https://www.rotowire.com/baseball/article/the-long-game-keeper-auction-strategy-tips-44535); [Razzball](https://razzball.com/?p=35028)
- Ra: unspent suns are wasted, forcing spending pressure. — [Wikipedia: Ra](https://en.wikipedia.org/wiki/Ra_(board_game))

### Inferences
- With no team cap, the "cheap spam" worry is real only if (a) min bid is ~0 and (b) low characters have power > 0 and almost no one competes for them. Fixes: min opening bid (e.g. 10 coins, increment 5) and a pool where a D-tier averages ~10 power, so 1000 coins / 10 = max 100 purchases of 10 power = 1000 power, which would be absurd. So ensure number of characters (60) caps this: with 60 characters and 4 players, the pool, not the budget, is the limiting factor; each player cannot buy all.
- Own simulation: spam strategy fails mostly because rivals bid fair on all the good characters and the spammer wins only what nobody wants; spamming could become strong in a large game with many players, where lower tiers get ignored. Playtest with 6-8 players.
- Budget rule of thumb (design): set budget so that fair share of the pool costs about the full budget, i.e. average price per power point p = (players x budget) / total pool power. Tier5 pool (1795 power) with 4 players x 1000 = 4000 coins gives ~2.2 coins per power point; with 8 players, ~4.5. This price level implies a fair-share team of ~450 power at 4 players.
- Minimum bid should be roughly the price of the cheapest tier: e.g. D-tier (10 power) at ~22 coins; set min bid 10-20.

### Gaps
- No sourced evidence on "cheap spam" in uncapped team auction party games specifically; conclusions here are own reasoning plus a crude sim.

## 3. Keeping fun when power is guessable but not known: noise, hidden traits, surprises, tiers vs exact numbers

### Takeaway
Use hidden tiers with in-tier exact values, plus a bounded random "form" roll at Battle and optional hidden traits. Keep the noise small enough that anime knowledge wins most of the time (about 10-25% of a tier's value) but large enough that an S-tier can occasionally underperform a high A.

### Cited Findings
- Tiered lists are the norm in Pokemon draft leagues (Elite/High/Low/Budget by price cutoffs, or S to E by BST) and are expected to be re-cut as formats change. — [Smogon Beginner's Guide](https://www.smogon.com/articles/beginners-guide-draft-2); [PokeTools](https://www.poketools.com/draft-assistant)
- Modern Art: value emerges from table behavior and only the top three artists pay, creating dramatic reveals. — [Roll to Review](https://rolltoreview.com/modern-art-review-auction-strategy-game/)
- Winner's curse literature: bidders do not learn from repetition, so surprises stay repeatedly dramatic. — [UCLA Anderson Review](https://anderson-review.ucla.edu/what-causes-overbidding-in-auctions/)

### Inferences
- Exact numbers (1-100) invite spreadsheet-style arguments; tiers signal "approximate" and stop disputes about 87 vs 89. Recommended: store hidden exact power internally but show only the tier name after Battle.
- Variance recommendations (own design judgement, not from sources): Battle "form roll" of +/-10% per character (uniform), independent. With ~10 characters per team the sum noise is about +/-3-4% of team total, so skill still decides but ties are broken by luck.
- Hidden bonus trait (e.g. 10% of characters get a +15% "Plot Armor" or -15% "Overhyped" label revealed at Battle) gives surprise reveals. Cap at one trait per character, symmetric distribution so the expected value stays unchanged.
- Info seeding: optionally show a "series" and a vague "hype" icon (public popularity) but not power; this makes hype-vs-true-power decisions the core skill.

### Gaps
- No empirical data found on how much noise casual players tolerate; thresholds above must be playtested.

## 4. Fandom disputes: transparent method vs hidden numbers, canon tier label, house rules, per-series balance

### Takeaway
Publish the method (what is scored and how) but keep per-character values hidden until reveal; pick one fixed, simple, canonically-sourced rubric, and state that results are "game rules, not canon truth." Balance series by quota in the pool, not by adjusting character values.

### Cited Findings
- VS Battles Wiki scales characters by verified feats not statements, tiers based on Attack Potency, with durability/speed/abilities rated separately; staff themselves argue many tier boundaries are unsourced and the system is actively debated. — [VS Battles: Creation Feats](https://vsbattles.fandom.com/wiki/Creation_Feats); [VS Battles forum: tier borders](https://vsbattles.com/vsbattles/3437287); [VS Battles forum: calculation group](https://vsbattles.com/goto/post?id=7304641)
- Pokemon draft leagues: prices are set by each league's commissioner and differ league to league; Smogon notes the same Pokemon can cost 9 or 12-13 depending on the league. — [Smogon Beginner's Guide](https://www.smogon.com/articles/beginners-guide-draft-2)

### Inferences
- Even a dedicated power-scaling community cannot agree; do not claim accuracy. Frame the numbers as "Arena Power" (a fictional match score) rather than "who would win." Add an in-game line: "Power reflects the game's formula; not a debate."
- A simple rubric (e.g. 4 axes at 0-5: raw power, speed/reach, durability, versatility, with a feats-in-canon rule) keeps the method defensible; publish the rubric, not the table.
- Per-series balance: limit each series to at most 4-5 characters of the pool of 60 (about 8%), and no more than one S per series. Avoid series bonuses that make owning one franchise decisive.
- House-rule levers: host can toggle "no crossover-lore arguments", "ban list", "tier swap" before the lobby starts.

### Gaps
- No existing sources on party-game-specific "canon tier" labelling; design recommendation only.
- Could not confirm the full VS Battles tier range; one spam-like page listed "0 to 11-C" and was not trusted.

## 5. Concrete recommended design with worked example

### Takeaway
Use a 5-tier scheme with exact hidden values in 10-100, S top about 100 and bottom 10, shaped so that the top 3 are about 17% of pool but the top character alone is about 5.5% of pool, plus a +/-10% Battle form roll.

### Cited Findings
- Pokemon draft precedent: 6 tiers priced 12/10/8/6/4/2 with a 100-point budget and 12 picks (BST scale), top:bottom 6:1. — [PokeTools](https://www.poketools.com/draft-assistant)
- Wolfey/ADV: 100 or 90 budget with 8-10 picks and top prices ~19-20. — [Smogon ADV Draft guide](https://www.smogon.com/forums/posts/10899152); [Wolfey](https://wolfeydraftleague.com/about)

### Recommended parameters (design proposal; derived from the above and own simulation)
60-character pool (scale proportionally for 30 or 100):

| Tier | Count | Base power band | Tier mean | Pool contribution |
|---|---|---|---|---|
| S | 3 | 95-100 | 100 (use 100/95/90 spread: avg 95) | 285 |
| A | 7 | 55-70 | 60 | 420 |
| B | 15 | 30-40 | 35 | 525 |
| C | 20 | 17-23 | 20 | 400 |
| D | 15 | 8-12 | 10 | 150 |
| Total | 60 | | | 1780 (avg 29.7) |

(The sim used exactly 100/60/35/20/10, pool 1795. Top-3 share = 300/1795 = 16.7%; top-1 = 5.6%.)

- Scale: use 1-100 hidden internal numbers, display tiers only. Alternative of tier points (S5, A4, B3, C2, D1) is too flat (5:1) and over-rewards buying many D; keep roughly 10:1 for S:D.
- Exact top:bottom 10:1, top:median(B) about 3:1. Since sum scoring dilutes any one character, the top-3 share 17% means owning all three S gives about 17% pool (about 300 of a 4-player fair 450), which is strong but not game-winning alone.
- Budget: 1000 coins; min bid 10, increment 5. Implied fair price per power point = (players x 1000) / 1795: 2.2 (4 players), 3.3 (6), 4.5 (8). S fair price at 4 players about 220 coins (22% of budget), B about 78, D about 22. Nobody can afford more than ~4 S-tier at fair price; ownership of 2 S-tier at fair price consumes 44% of budget.
- Worked example, 4 players, fair prices, all play "fair share": each ends with about 450 power. Suppose A (star-heavy) buys 1 S + 2 A + 3 B + 4 C + 2 D = 100 + 120 + 105 + 80 + 20 = 425 power, costing about 425 x 2.23 = 950 coins. B (balanced) buys 0 S + 3 A + 4 B + 4 C + 3 D = 180 + 140 + 80 + 30 = 430 power, costing about 960 coins. Interpretation: at a constant fair price per point, all builds converge to ~450 power. Differences arise only from mispricing, i.e. from estimate errors. Expected team totals per sim: 450 each in the symmetric case; skilled player (sigma .15) vs noisy (0.5) about 558 vs 435.
- With +/-10% uniform Battle form roll: team of 10 characters averaging 45 power (450 total) has sd approx 0.058 x sqrt(sum p^2); for sum p^2 about 10 x 2300 = 23000, sd about 0.058 x 152 = 8.8 power (about 2% of team). Derivation: uniform +/-10% has sd 5.8% of value. This is tiny versus mispricing swings (~100 power in the sim), so luck is minor; if more tension is wanted use +/-20% (about 4% of team) or add surprise traits.
- Synergy/series bonus (optional): flat +5% team total per "complete trio" of the same series, capped at one bonus per series, adds a combo fantasy but increases knowledge load; I would defer until base game playtests. Role bonuses (tank/healer/speedster) likewise optional.
- Sanity-check simulations to run: (1) bot archetypes (fair, shaded 0.85, star-hunter, spam, copycat, last-minute sniper) across 4/6/8 players and 30/60/100 pools; (2) measure win-rate spread of a seat by turn order (nomination order), share of winners who held an S, correlation of paid-coins vs power (target R^2 ~ 0.5-0.7: knowledge matters, noise too); (3) Gini of final team power; (4) sensitivity to tier mix (S count 1/3/5; top:bottom 5:1/10:1/20:1); (5) vary noise sigma of bidders (0.15/0.3/0.5/1.0) to calibrate the skill reward; (6) test hoard-coins vs min-bid rules. Metrics: probability that holder of top-1 wins (target below 40%), skill-vs-novice win rate (target 60-75%, own judgement), spread of final scores.

### Inferences
- The 5-tier proportions (5% S, 12% A, 25% B, 33% C, 25% D) follow a pyramid; the key knob is S count, as each S adds about 5% of pool.
- Seat/nomination order effects: use random nomination or rotating nominator, and let the nominator choose item order? Power Grid's catch-up bidding order is a precedent (leader bids first).

### Gaps
- All numeric targets in this section are design proposals validated only by my crude simulation; no external playtest data.
- The "fair share" bidding policy in my sim assumes each bidder knows the pool's total; real players will not, so inflation dynamics (early overbidding) may differ.
