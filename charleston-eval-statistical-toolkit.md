# Part 2 — Validation Analysis & Statistical Toolkit
## Will Monte-Carlo + the calibration harness give meaningful data? And what else do we need?

Companion to `charleston-and-hand-ranking-spec.md`. Same provenance legend ([EMP]/[ACAD]/[XFER]/[DERIV]/[HEUR]/[FOLK?]). This document (a) judges whether the proposed simulator and harness actually produce trustworthy data, and (b) specifies the additional statistical machinery needed for **data-backed pass suggestions** and **post-choice evaluation/ranking of Charleston selections** (the mahjong analog of a chess engine's blunder analysis or a poker solver's EV-loss).

---

## A. Verdict: meaningful, but only under four conditions

The Monte-Carlo engine (§3.4) and calibration harness (§6) **will** produce meaningful, decision-grade data — *conditional* on fixing four things that, left naive, quietly invalidate the numbers. Each is a real failure mode, not a nicety.

### A.1 The incoming-tile model cannot be uniform-random — **[ACAD]/[DERIV]**

The Charleston is **not** a random tile source. You systematically receive what three opponents chose to *discard from their plans* — disproportionately isolated tiles, off-suit singletons, and lone honors. A simulator that samples Charleston incoming uniformly from the unseen pool will **overstate** the quality of incoming tiles and therefore **overstate** completion probabilities for hands that depend on Charleston help.

Fix (and it's a genuine game-theory result, which the project asked for): model incoming tiles as the **marginal discard distribution of an opponent running the same pass policy**, then solve for the **fixed point** via iterated best response / fictitious play — opponents pass against *your* policy, you pass against *theirs*, iterate until passing policies stop changing. This converges the Charleston to a self-consistent equilibrium and gives a realistic incoming distribution. Until that exists, use a **junk-biased empirical proxy** (sample incoming weighted toward isolated/low-keepValue tiles) rather than uniform. Either way: **validate the simulated incoming distribution against the real one** if/when you log live Charleston passes.

### A.2 Estimates are policy-conditional — say so, and close the loop — **[ACAD]**

`P_complete` from rollouts is *"probability of completing under the rollout policy,"* not under optimal play. If the rollout policy is the greedy deficiency-reducer (§3.4), every probability inherits that policy's skill ceiling. This is fine **provided** (a) the rollout policy is at least as strong as the player you're advising, and (b) the policy used to *evaluate* a decision is the same one you'd *recommend* — otherwise the engine grades players against a standard it can't itself meet. Make the rollout policy an explicit, versioned object. When you upgrade the policy, re-baseline all stored evaluations.

### A.3 Variance must be quantified and surfaced — never show false precision — **[DERIV]** (verified numerically)

A rollout estimate of a probability `p` has standard error `√(p(1−p)/N)`. Concretely (computed, p≈0.25):

| Rollouts N | SE | 95% half-width |
|---|---|---|
| 500 | 1.94% | ±3.80% |
| 2,000 | 0.97% | ±1.90% |
| 10,000 | 0.43% | ±0.85% |
| 50,000 | 0.19% | ±0.38% |

**Implication for ranking:** to *separate two candidate hands or two passes* whose true completion rates differ by δ, with 95% confidence and independent sampling, you need roughly:

| δ (gap) | rollouts per option (independent) |
|---|---|
| 5.0% | ~770 |
| 2.0% | ~4,800 |
| 1.0% | ~19,000 |
| 0.5% | ~77,000 |

Many Charleston passes differ by **< 2%** in true value, so a flat N=2,000 will frequently rank noise. Two consequences: (1) use **variance reduction** (§B.3) — paired **Common Random Numbers** alone typically cut required N by 3–10× because the same shuffled walls evaluate every candidate; (2) **rank with confidence intervals, not point estimates** — if two options' CIs overlap, report them as tied ("statistical dead heat"), don't fabricate an order.

### A.4 Aggregate calibration ≠ conditional calibration — **[ACAD]/[DERIV]**

Matching the §6 anchors (overall win rate ≈22%, the joker curve, wall ≈35) proves the simulator is *globally* realistic. It does **not** prove that "this specific hand is 6%" is correct — a model can hit every marginal while being badly miscalibrated on the tails (rare hands, joker-rich racks). You must validate at the **conditional** level with **proper scoring rules**: bin predictions and plot **reliability curves** (predicted vs. observed completion), report **Brier score**, **log-loss**, and **Expected Calibration Error**. Also: at the tails, the normal interval breaks — for a rare hand (p≈0.0003, N=2,000) it returns an *invalid negative* lower bound `[−0.046%, 0.106%]`; the **Wilson interval** gives a valid `[0.004%, 0.248%]`. Use Wilson (or Jeffreys) for all binomial CIs, not the normal approximation.

> **Bottom line for Part A:** the architecture is sound and the data will be meaningful for ranking and advice **if** incoming tiles are modeled non-uniformly (ideally to a fixed point), estimates are CI-aware with variance reduction, the rollout policy is explicit and self-consistent, and calibration is checked conditionally with proper scoring rules. Skip any of these and the dataviews will look authoritative while being wrong in exactly the high-leverage cases.

---

## B. Statistical toolkit — data-backed suggestions & post-choice evaluation

Organized by build priority. Tier 1 is the minimum to ship credible "what to pass" advice and "how good was your pass" grading. Tiers 2–3 add depth and explanation.

The unifying idea: **grade the decision, not the outcome.** Because ~89% of games end in a win and the joker draw alone swings win probability from 5% to 51% (§6), realized win/loss is dominated by luck and is a *terrible* signal for whether a pass was good. Every tool below evaluates a choice against its **expected value at the moment of choosing**, which is the only statistically fair way to assess skill in a high-variance game. (This is exactly how chess engines and poker solvers work.)

### Tier 1 — core decision-quality engine

**B.1 Charleston EV-Loss / regret (the centerpiece)** — **[ACAD]-style, novel application**
Define a decision value for any legal 3-tile pass `a` from rack `R`:
```
V(a) = E[ best-portfolio strength after passing a ]      // via MC, §3.4
       (strength = max_P EV(P), or a blend of P_complete and EV)
V*   = max over all 286 legal passes of V(a)
EVLoss(a) = V* − V(a)              // "how much value the choice gave up"
percentile(a) = rank of V(a) within the distribution of all V(·)
```
Outputs the app can show: the recommended pass `argmax V(a)`, the player's actual pass with its **EV-loss** and **percentile** ("88th percentile; optimal kept the 2-Dot pair, costing 3.1% win probability"). EV-loss is the mahjong "centipawn loss." Aggregate per session → an average-EV-loss skill metric that is **luck-independent**.

**B.2 Best-arm identification for tractable, confidence-bounded recommendations** — **[ACAD]**
Evaluating 286 passes × thousands of rollouts each, ×6 passes, is wasteful if done flatly. Frame "which pass is best" as a **best-arm-identification bandit** and spend rollouts adaptively: cheap pre-rank all 286 by the closed-form scorer (§3.2), then run **Successive Halving / Hoeffding races / UCB-E** to pour samples into the contenders and eliminate clear losers early. Stop when the leader is separated from the runner-up at target confidence (or compute budget hits). This gives **provably-bounded** recommendations within the 16.7 s the data says players already spend per Charleston decision (§6), and naturally yields the "it's a close call" flag when no arm separates.

**B.3 Variance reduction (makes B.1–B.2 affordable)** — **[ACAD]/[DERIV]**
- **Common Random Numbers (CRN):** evaluate every candidate pass on the *same* set of shuffled walls/incoming sequences. Differences `V(a)−V(b)` then have far lower variance than the individual estimates → separates close passes with 3–10× fewer rollouts.
- **Control variates:** use the closed-form score as a control variate against the MC outcome (they're correlated) to shrink variance.
- **Stratified / antithetic sampling** over the dominant luck factor — **joker count** — since §6 shows it explains most win-rate variance. Stratify rollouts across joker draws so estimates aren't dominated by joker luck.

**B.4 Proper-scoring calibration harness (extends §6)** — **[ACAD]/[DERIV]**
Beyond matching marginals: reliability diagrams, **Brier score**, **log-loss**, **ECE**, computed on a held-out set of simulated (and later, real) games. Wilson/Jeffreys CIs everywhere. This is the test that lets the UI honestly print a probability. Re-run on every policy/model change as a regression gate (per §8 build order).

### Tier 2 — attribution, information, and trajectory

**B.5 Per-tile blame via Shapley values** — **[ACAD]/[DERIV]**
EV-loss tells you the *pass* was suboptimal; players want to know *which tile*. Treat the three passed tiles as players in a cooperative game and compute **Shapley values** (leave-one-out and pairwise swaps, evaluated with CRN) to fairly attribute the total EV-loss across them: "Passing 5-Bam cost 3.1%; the 8-Dot and North were optimal." Principled credit assignment, not heuristic.

**B.6 Value-of-Information for blind-pass / look and stop decisions** — **[XFER: decision theory]/[HEUR]**
Formalize §4.3/§4.5 of Part 1. The Charleston is an information channel; quantify:
- **Self-information:** expected reduction in the entropy of your own best-hand posterior from *seeing* incoming tiles → the value of *looking*. Blind-pass is rational when this VoI is below the tempo/secrecy value of keeping a dense hand.
- **Opponent-information:** **mutual information** between incoming tiles and each opponent's section posterior — measures how much each pass reveals about opponents, feeding B.10 and defensive dataviews.
This turns "blind vs look" and "stop vs continue" from folklore into expected-VoI comparisons with numbers attached.

**B.7 Win-Probability-Added (WPA) equity curve** — **[ACAD]-style, [EMP]-calibratable**
Track estimated win probability after every action across a game (sports-style win-probability chart). Each action's **WPA = Δ(win prob)**; each Charleston pass gets a WPA. Post-game, plot the equity curve and surface the biggest swings ("your largest mistake was the second-left pass, −4.2% WPA"). Compelling dataview *and* a rigorous per-decision metric. Anchor the curve's average to the §6 win rate.

**B.8 Luck vs. skill session decomposition** — **[EMP]/[ACAD]**
Decompose a player's result over a session into a **skill term** (cumulative EV-loss from their decisions) and a **luck term** (deal + draw + joker variance). Analogous to poker's all-in-EV-adjusted winnings. Lets the app tell a player "you played the 80th percentile but ran below expectation on jokers" — which is both true and motivating, and only possible because B.1 grades decisions independent of outcome.

### Tier 3 — learning from the simulation corpus

**B.9 Interpretable model fit on simulation logs (data-driven weights + explanations)** — **[ACAD]/[EMP]**
Once self-play generates a large labeled corpus (outcome per hand-state), fit **logistic regression / GAMs / gradient-boosted trees** predicting completion from features (deficiency, drawOnlySlots, jokers, minAccept, category). Yields: (1) the §3.2 scorer weights **by regression instead of hand-tuning** (closes Part 1 §8 step 4); (2) **SHAP / permutation importance** for human-readable "why this pass" explanations; (3) a fast surrogate for the expensive MC in live play. Cross-check the surrogate against MC and against the §6 empirical frequencies — three independent estimates of the same quantity is the strongest validity evidence you can get.

**B.10 Online Bayesian opponent model** — **[ACAD]/[HEUR]**
Maintain a **Dirichlet-categorical posterior** over each opponent's hand category, updated from Charleston passes, discards, and exposures. Feeds two things: the non-uniform incoming distribution that fixes A.1, and defensive discard-risk scoring for end-game dataviews. Start uniform; firm up as evidence accrues (matches the "hints not conclusions" caveat in Part 1 §4.3).

**B.11 Self-play policy A/B testing** — **[ACAD]/[DERIV]**
To prove the recommender actually helps (not just looks principled), run **paired self-play tournaments** (CRN seeds) between policy versions; report win-rate deltas with **bootstrap CIs** and significance tests. This is the offline evaluation that justifies every "the engine recommends…" claim, and it's the regression test for model changes.

---

## C. Metric catalog (quick reference)

| Metric | Answers | Formula / method | Tier | Conf |
|---|---|---|---|---|
| `P_complete` | How likely is this hand? | MC rollouts, Wilson CI | core | [ACAD] |
| `EV = P·V` | Best hand by value? | completion × points | core | [EMP] |
| `EVLoss(a)` | How bad was this pass? | `V* − V(a)` | T1 | [ACAD]-style |
| `percentile(a)` | Where does the pass rank? | rank in `V(·)` distribution | T1 | [DERIV] |
| Best-arm stop rule | When is the rec trustworthy? | Successive Halving / Hoeffding race | T1 | [ACAD] |
| Brier / log-loss / ECE | Are probabilities honest? | proper scoring on held-out set | T1 | [ACAD] |
| Shapley(tile) | Which tile was the error? | cooperative-game attribution | T2 | [ACAD] |
| VoI(look) | Blind-pass or look? | entropy reduction from incoming | T2 | [XFER] |
| MI(incoming; opp) | How much did the pass reveal? | mutual information | T2 | [ACAD] |
| WPA | Biggest swings this game? | Δ win-prob per action | T2 | [ACAD]-style |
| Skill/luck split | Skill vs. variance this session? | Σ EV-loss vs. residual | T2 | [EMP] |
| SHAP(feature) | Why this recommendation? | tree-model attribution on logs | T3 | [ACAD] |
| Opp posterior | What are opponents on? | Dirichlet update | T3 | [HEUR] |
| Policy Δ win% | Does the rec actually help? | paired self-play, bootstrap CI | T3 | [ACAD] |

---

## D. Compute budget — making 286-pass evaluation real-time

- **Two-stage funnel:** closed-form scorer (§3.2) ranks all 286 passes in microseconds → keep top ~10–20 → MC only on those. Cuts MC calls ~15×.
- **CRN + best-arm racing** on the survivors → typically a few thousand shared rollouts settles the winner within the empirical **16.7 s** Charleston budget; spend less when one pass dominates, more when it's close.
- **Surrogate model (B.9)** for instant live advice; reserve full MC for post-game analysis and offline calibration, where seconds-to-minutes is fine.
- Stratify rollouts by joker count (B.3) so a single lucky/unlucky joker draw doesn't dominate any estimate.

---

## E. Additions to the Part 1 build order

Insert after Part 1 §8 step 3 (calibration harness):
- **3a.** Proper-scoring calibration (B.4) + Wilson CIs — gate before trusting any probability.
- **3b.** CRN + best-arm sampling (B.2–B.3) — required before per-pass ranking is affordable or trustworthy.
- **3c.** Fixed-point / junk-biased incoming model (A.1) — required before Charleston numbers mean anything.

Then the decision-quality layer (B.1 EV-loss, B.5 Shapley, B.7 WPA) sits on top of the now-trustworthy simulator, and the learning layer (B.9–B.11) consumes its logs.

---

## F. Honest limits

- **No NMJL-specific academic ground truth exists** — all [ACAD] methods are imported from Riichi/general game-AI work and must be validated against this engine's own self-play and (ideally) logged real games. The methods are proven; their *parameters for NMJL* are not, until fit here.
- **The incoming-tile equilibrium (A.1) is the highest-risk assumption.** If real opponents pass very differently from the fixed-point model, Charleston EV-loss numbers will be biased. Prioritize logging real Charleston passes to validate or replace the model — this is the single most valuable dataset the project could collect.
- **Decision-quality metrics are only as good as the rollout policy (A.2).** Publish the policy version alongside every score so evaluations remain comparable across model upgrades.

---

## G. Sources (additional to Part 1)

Methods are standard; representative references:
- Monte-Carlo Tree Search & opponent models in mahjong — Mizukami & Tsuruoka, *Building a Computer Mahjong Player Based on Monte Carlo Simulation and Opponent Models*, IEEE CIG 2015.
- Reward shaping / forward search single-player mahjong — Chen, Lai & Lai, arXiv:2305.04145.
- Deficiency-number fast computation — Li et al., arXiv:2108.06832.
- Best-arm identification / racing — successive halving and Hoeffding-race literature (Maron & Moore; Karnin et al., *Almost Optimal Exploration in Multi-Armed Bandits*).
- Proper scoring rules & calibration — Brier (1950); Gneiting & Raftery, *Strictly Proper Scoring Rules* (2007); reliability diagrams / ECE (Guo et al., 2017).
- Binomial CIs — Wilson (1927); Brown, Cai & DasGupta, *Interval Estimation for a Binomial Proportion* (2001).
- Shapley attribution / SHAP — Lundberg & Lee, *A Unified Approach to Interpreting Model Predictions* (2017).
- Common Random Numbers & variance reduction — standard simulation methodology (Glasserman, *Monte Carlo Methods in Financial Engineering*, ch. on variance reduction).
- Win-probability / decision-quality framing — sports analytics WPA and poker EV-adjusted results (methodological analogs).
