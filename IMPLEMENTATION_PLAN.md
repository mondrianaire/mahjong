# Charleston Lab — Master Implementation Plan

**American Mahjongg starting-hand & Charleston analysis engine (2026 NMJL).**
This is the consolidated build plan. It folds together the original statistical/game-theory
spec, the design-review corrections (C1–C10), the two cross-cutting concepts (objective modes;
the four-seat simulator), and the existing code. The **four-instance Charleston simulator is the
architectural spine** — simultaneously the ground-truth engine, the fix for the weakest modeling
assumption, and the substrate for opponent characterization.

> ## ✅ BUILD STATUS — Phases 0–8 + Part 2 core implemented and verified
> | Module | Phase | Verified |
> |---|---|---|
> | `card-meta.js` | 0 — points/concealed/suitFlex (illustrative, flagged) | ✓ |
> | `kernel.js` | 1 — deficiency + acceptance, **C1 concealed-calling fix** | ✓ unit tests |
> | `dealer.js` | 2 — the spine | ✓ **10⁴ runs conserve tiles, 0 joker moves, 0 leaks** |
> | `score.js` `policies.js` | 3 — scorer + objective modes + policy zoo | ✓ |
> | `play.js` | 4 — multi-agent MC with calling (C1/C3) | ✓ **joker curve matches §6 anchor** |
> | `calibrate.js` | 5 + B.4 — normative gates + proper scoring | ✓ both gates pass |
> | `charleston2.js` | 6 + B.1 — keepValue dedup (C2), junk-biased incoming (A.1/C6), CRN, **EV-loss** | ✓ |
> | `observer.js` | 7 + B.10 — opponent posterior | ✓ **measured: weak full-section, real negative signal** |
> | `divergence.js` | 8 — game-type sensitivity | ✓ fires ~36% |
> | `stats.js` | Part 2 — Wilson/Jeffreys CIs, CRN, proper scoring, versioned policy | ✓ **matches Part 2 SE table exactly** |
> | `charleston-lab-v2.html` | 8 — integrated UI | ✓ jsdom end-to-end |
>
> **Key validation:** the simulator independently reproduced the real-world joker→win-rate curve
> (sim 8/13/22/39% vs anchor 4.6/13.2/27/41.1%) and the pair-hardness ordering, neither of which
> it was fit to. **Honest caveats:** rollout policy `0.1.0-greedy` wins 82% vs the 89% anchor, so
> absolute probabilities are *uncalibrated* (ECE 15%) pending a stronger, refit policy (A.2); point
> values are illustrative pending Phase-0 card verification. See "Part 2 integration" and "What's
> deferred" at the end.

---

## 0. Orientation

### 0.1 What already exists (≈55% of the single-seat kernel)
| Spec area | Status | Symbol in `engine.js` |
|---|---|---|
| Domain model (152 tiles, card-as-data) | Built | tile codes, `CARD[]`, `expandLine` |
| Deficiency `D(P)` | Built (over all targets) | `tilesNeeded`, `coverage`, `handPool` |
| Closed form calibrated to MC | Built in miniature | `reachMass` → `CALIB` (r=0.89 vs MC) |
| Single-player MC | Built (coarse) | `monteCarlo` |
| Charleston pass selection | Built (v1) | `charlestonSuggest`, `charlestonOptimize` |
| Verification harness | Partial | `study.js`, `analyze.js`, `results.csv` |

Everything built so far is **single-seat and value-blind** — i.e. it is already a *WINS-mode,
single-player* tool. This plan adds: correct calling, point/EV awareness, the full Charleston,
and — the spine — a conserved four-seat world that turns the solo approximations into a real
multi-agent simulation.

### 0.2 Guiding principles
1. **MC is ground truth; closed forms are calibrated approximations.** No weight ships unless
   it was fit against simulated (or real) outcomes. (Spec §0.)
2. **Rank by the active objective, never by face points:** `P(win)` in WINS, `EV = P·V` in
   POINTS. (§1.1.)
3. **Pair/single slots are the dominant difficulty axis** (no joker, no call) — a hard
   multiplier, not a nudge. (Spec §1.2/§2.3, `[DERIV]`.)
4. **Information hygiene is sacred.** Every seat's reasoning sees only its private rack plus
   legally observable events. Leaking god-view state silently invalidates every opponent-
   inference result. (New principle — load-bearing for the spine.)
5. **Every shipped claim carries a provenance tag** `[EMP]/[ACAD]/[XFER]/[DERIV]/[HEUR]/[FOLK?]`,
   surfaced in the UI. Flag `[FOLK?]` items as myths, never as advice.
6. **Measure before you elaborate.** Build the simulator, then *measure* how much signal a
   channel (e.g. Charleston passes) actually carries before investing in modeling it.

### 0.3 Stack
Extend `engine.js` (Node + browser, one codebase, keeps the live tool). Node already runs the
MC and the OLS/correlation studies fast enough. **Python sidecar** is an optional escape hatch
only if the Phase 4 multi-agent MC can't hit calibration throughput — revisit then.

---

## 1. The two cross-cutting concepts

### 1.1 Objective modes — points vs wins  (`objective ∈ {WINS, POINTS, BLENDED}`)

Two legitimate games. Some tables play **games won** with no scoring; others play **points**
with a payout structure. Objective is a first-class parameter threaded through ranking, the
Charleston, and defense — not a UI toggle.

| | **WINS** (no points) | **POINTS** |
|---|---|---|
| Objective | maximize **P(reach mahjong first)** | maximize **expected net score** |
| Hand value `V(P)` | **irrelevant** | scales offense and defense |
| Formula | rank by `P_complete` (race-adjusted) | `EV = P_complete·V` − `E[paid when an opponent wins]` |
| Defense | deny **tempo**, value-blind: `Σ_opp P(opp wins on t)` | value-weighted: `Σ_opp P(opp wins on t)·payout(opp hand)` |
| Data needed | tile structure + `concealed` | also `points` + a configurable `ScoringRuleset` |

**Divergence is sparse, structured, and detectable.** Measured on the current engine with
illustrative point values: the recommended *hand* flips between modes in roughly **15–50%** of
decisions, the rate depending on (a) point-value spread and (b) the steepness of the true
probability-vs-distance curve (a Phase-4 output). ~70% of flips are points-mode reaching for
high-value/low-probability sections (Singles & Pairs, Quints, concealed). The mechanics
(jokers, proximity, junk-shedding) are identical in both modes; only the *target choice*
diverges, and only in that high-value/low-probability region.

**Crossover rule (displayable):** prefer higher-value hand B over higher-probability hand A iff
`V_B/V_A > P_A/P_B` — the value ratio beats the probability ratio.

**Divergence detector (deliverable, Phase 8).** Compute both objectives on every analysis
(nearly free — POINTS is just `×V(P)` on the same `P_complete`). Show **one** recommendation
when they agree; when they disagree, raise a **"⚖ depends on game type"** callout with both
options, their `P` and `EV`, the trade in plain words ("≈2.3× the points for ≈half the chance"),
and the crossover threshold. Suppressing the comparison on the ~majority of agreeing decisions
is the point — it keeps the signal clean.

### 1.2 The four-seat simulator — the architectural spine

One **`Dealer`** holds a single conserved 152-tile deal and runs four instances of the engine,
each restricted to its **private view**. Not four isolated engines — four *orchestrated* ones
over shared, conserved world state. This single build does three jobs at once:

- **It is the ground-truth engine** (Phase 4): run the Charleston, then play to wall exhaustion
  with draws + legal calls → real `P_complete` and win outcomes for calibration.
- **It fixes correction C6** (the weakest assumption): the tiles you *receive* in the Charleston
  stop being "uniform-random from the unseen pool" and become the **actual output of the other
  three seats' pass policies** — informative and non-uniform, exactly as in a real game.
- **It is the oracle for opponent characterization** (Phase 7): because the Dealer knows every
  seat's true hand and policy, you can *measure* how well inference from observed passes
  recovers them, instead of asserting heuristics.

Bonus: it generates the **realistic post-Charleston hand distribution** that earlier
calibration had to fake with synthetic sampling.

**Mechanics the Dealer enforces.** Deal 4×13 racks (+ dealer's extra and the wall set aside).
Charleston is **simultaneous and blind**: collect four pass decisions on four private views,
then execute the swap **atomically**, conserving tiles. Sequence: R1 right→across→left(blind-
eligible); optional R2 left→across→right(blind-eligible), proceeding only by group agreement
(any seat may stop); then courtesy (0–3 across, mutual). **Jokers never move between racks.**

**Information hygiene (principle 4 in force).** A seat's policy is called with
`{ ownRack, observations[], publicState }` only — never the Dealer's full state. Each
`Observation = { fromSeat, direction, passIndex, tiles[3], blind }`; a seat sees only the three
tiles it *receives* on each pass, from one specific neighbor — never what opponents pass to each
other.

**Pluggable policies are a requirement, not a frill.** If all four seats play identically there
is nothing to characterize. Ship a small zoo of `Policy` implementations (wins-flexible,
points-chaser that protects high-value concealed hands, naive singleton-passer, random) so the
inference layer has distinguishable strategies to detect.

**Signal-first caution (principle 6).** Charleston observations are sparse, partly blind, and
players pivot (`[HEUR]`). Build the simulator, then **measure how much opponent signal the
Charleston actually carries before building elaborate inference** — the honest answer may be
"little until exposures and discards arrive in play," and learning that cheaply is a win.

---

## 2. Architecture & module layout

```
src/
  tiles.js        // pool, codes, suit/dragon maps                 (extract from engine.js)
  card.js         // HandPattern[], expander, points + C/X data    (extend; Phase 0)
  kernel.js       // deficiency D(P), per-slot acceptance, claimable(concealed)  (Phase 1)
  score.js        // Score, EV, objective modes, fitted weights    (generalize reachMass/CALIB)
  policy/
    index.js      // Policy interface
    winsFlexible.js, pointsChaser.js, naive.js, random.js          (the strategy zoo)
  sim/
    dealer.js     // conserved world, pass routing, private views  (THE SPINE; Phase 2)
    agent.js      // PlayerAgent = wraps score/policy               (Phase 3)
    play.js       // post-Charleston play: draws + legal calls      (Phase 4)
    conservation.test.js                                            (invariant gate)
  charleston.js   // keepValue (dedup), 6 passes, blind/courtesy/stop (Phase 6)
  observer.js     // per-seat posterior over opponents               (Phase 7)
  divergence.js   // game-type sensitivity detector                  (Phase 8)
  provenance.js   // tag registry surfaced in UI
calibrate/
  harness.js      // reproduce §6 anchors, fit weights               (Phase 5)
build.js          // bundle src/* -> charleston-lab.html
```

---

## 3. Data model

```js
HandPattern { id, category, points/*V(P)*/, concealed, suitFlex, groups:[{size, jokerEligible:(size>=3), tileSpec}] }
ScoringRuleset { base:V(P), discarderPaysDouble, selfPickBonus, jokerlessBonus, concealedBonus }   // POINTS only
RackState  { counts, jokers, isDealer }
WorldState { racks[4], wall, dealerExtra, passLog[] }              // Dealer-private; conserved == fullPool
PrivateView{ ownRack, observations:[Observation], publicState }    // ALL a policy ever sees
Observation{ fromSeat, direction, passIndex, tiles[3], blind }
Policy     { selectPass(view)->3, blindDecision(view)->bool, stopVote(view)->bool,
             courtesyOffer(view)->int, discard(view)->tile, callDecision(view,discard)->bool }
```

---

## 4. Phased plan

> Reordered so the **spine (Phase 2) starts immediately** — it depends only on tiles + the card,
> not on the scorer — and so nothing downstream rests on unverified data.

### Phase 0 — Card integrity & data model · size **M** · blocks EV/POINTS, not WINS
Reconcile all 72 lines against a **physical 2026 card / second source**: fix the ~15
`~role-inferred` suit partitions; add `points`, `concealed`, exact `suitFlex`. Migrate
`CARD[]` → `HandPattern`.
- **Objective split:** `points` + `ScoringRuleset` are needed **only for POINTS**. WINS needs
  only structure + `concealed`, so WINS work proceeds on existing card data in parallel.
- **Acceptance:** every line round-trips to 14 tiles; per-section counts match the card; human
  spot-checks 10 random expansions against the card image. **Provenance:** `[DERIV]` + manual gate (C8).

### Phase 1 — Deficiency & acceptance kernel · size **S–M**
Promote `tilesNeeded` → `D(P)`; add per-slot `acceptance(i)`, `minAccept(P)`, `drawOnlySlots(P)`.
- **C1 (rules bug):** `claimable(i) = (size ≥ 3) AND NOT P.concealed`. A concealed hand makes no
  exposures → every slot is draw-only while building. Not a tie-breaker; a kernel fact. `[DERIV]`
- **Acceptance:** unit tests — an exposed 1-away kong reports high acceptance + claimable; the
  same hand marked concealed reports `claimable=FALSE` everywhere.

### Phase 2 — Dealer / world-state / conservation  · size **M** · ★ the spine, start now
Build `sim/dealer.js`: deal 4×13 + wall + dealer-extra from one conserved 152-multiset; route
the full Charleston (R1, R2 w/ stop-vote, courtesy); hand each seat only its `PrivateView`;
deliver received tiles as `Observation`s.
- **C4-adjacent invariant:** after every transition, `multiset(racks ∪ wall ∪ dealerExtra) ==
  fullPool` and joker positions are unchanged. This test is what keeps every later inference
  result trustworthy (principle 4).
- Depends only on Phase 0 tiles/card — **buildable today, before the scorer exists.**
- **Acceptance:** 10⁴ random Charleston runs conserve tiles and never move a joker; each seat's
  observation stream contains only its received tiles.

### Phase 3 — PlayerAgent + scorer + objective modes · size **M**
- `score.js`: generalize `reachMass`/`CALIB` to the full Spec §3.2 `Score` and `EV`, with
  `objective` parameter (C10). Default weights are starting values; fit in Phase 5.
- `agent.js` + `policy/*`: wrap the scorer as the **wins-flexible** policy; add **points-chaser**,
  **naive**, **random** so the strategy zoo exists for Phase 7.
- **Acceptance:** an agent plugged into the Dealer completes a legal Charleston; the four policy
  types produce visibly different pass behavior on the same deal.

### Phase 4 — Multi-agent Monte Carlo (ground truth) · size **L**
`sim/play.js`: after the Charleston, play to wall exhaustion — greedy deficiency-reducing
discard policy (ShangTing-style reward, Spec §3.4 `[ACAD]`) with **legal calls** subject to C1,
modeling **discard contention / commitment** (C3, so calling isn't over-credited). Horizon `H`
**falls out as a distribution** — never assumed.
- **Acceptance:** win-or-wall rate, picks-per-game (H≈16), and joker-redemption (~0.5/game)
  emerge near the §6 anchors under symmetric play.

### Phase 5 — Calibration harness · size **M**
Generalize `study.js`/`analyze.js` → `calibrate/harness.js`. Fit `Score` weights, `β`, `γ` by
**regression against the Phase-4 `P_complete`** (exactly how `CALIB` was fit to the v1 MC).
- **C4 — reframe §6:** *gate* only on **normative** anchors (joker-curve shape; pair-hardness
  ordering S&P ≪ Consec). *Do not gate* on category win-share or the ~22.3% mean (the latter is
  `89.3%/4` by symmetry — near-vacuous; the former is a population's policy, which an optimal
  engine should beat, not imitate). Use them as priors/smoke tests.
- **C5 — joker-curve endogeneity:** fit the *shape*, don't claim the causal slope (you hold more
  jokers in games you survive into). **Re-source §6 for the 2026 card** or label as 2022 priors.
- **By mode:** joker-curve + pair-hardness validate WINS; the points-vs-difficulty view is POINTS-only.
- **Acceptance:** harness reproduces the two normative gates within tolerance before Phase 6.

### Phase 6 — Charleston engine v2 · size **L**
- **`keepValue(t)`** = Σ over top-K candidates of `objScore(P)·contributes(t,P)`, with
  `objScore` = `P_complete` (WINS) or `EV` (POINTS).
  - **C2 (verified risk):** **de-duplicate correlated candidates** before summing. In the v1, a
    "count nearby lines" flexibility metric had ~0 correlation with win prob because near-identical
    lines inflate the count — cluster by strategic direction or weight by marginal distinct value.
- Full six-pass logic with constraints (never a joker; don't hand a coherent group to one seat;
  protect flowers/Soap; don't split a usable pair into one recipient), blind-pass rule, courtesy,
  and the stop decision (flag habitual early stopping as `[FOLK?]`).
- **C6 fixed by the spine:** the incoming-tile distribution for pass-EV is now produced by the
  other seats' real policies in the Dealer, not sampled uniformly.
- **Acceptance:** on scripted racks, the recommended pass keeps load-bearing structure (the v1
  Bam-run case); stop/continue matches the worked 369 example; blind-pass fires only on dense hands.

### Phase 7 — Observer / opponent characterization · size **L** · the stated goal
`observer.js`: per-seat posterior `P(opp section/strategy | observed passes)`, updated from each
`Observation` (Spec §4.3). The Dealer's known ground truth labels each game, so **inference
accuracy is measured, not asserted** ("did belief concentrate on the true section by pass k? what
does a wrong read cost?").
- **Signal-first (principle 6):** first deliverable is a *measurement* — the information content
  of Charleston passes — before any elaborate model.
- **C7 (provenance):** tag "single-player valid for the early phase" as **[XFER] w/ caveat**, not
  [ACAD]; the Charleston is a 3-way material transfer with live calling, so opponents matter
  earlier in NMJL than in Riichi.
- **Acceptance:** against the simulator, the posterior beats a uniform prior at predicting each
  opponent's section by the end of R1 (or we report, with evidence, that it does not — itself a finding).

### Phase 8 — Divergence detector + UI + provenance · size **M**
- `divergence.js`: on every analysis compute both objectives; emit the **"⚖ depends on game
  type"** callout only when the argmaxes disagree, with both options, `P`/`EV`, the trade, and
  the crossover threshold (§1.1).
- UI: objective-mode selector; EV/Score views; per-tile `keepValue` heatmap on the rack; the
  six-pass walkthrough; an opponent-read panel fed by the Observer; and a **provenance badge** on
  every recommendation.

---

## 5. Review-corrections index

| ID | Correction | Lands in | Tag |
|---|---|---|---|
| C1 | Concealed hands can't call — `claimable` depends on `concealed` | Phase 1 (used Ph 4) | `[DERIV]` |
| C2 | De-duplicate correlated candidates in `keepValue`/flexibility | Phase 6 (+ Ph 3) | `[EMP]`-warned |
| C3 | Discard contention/commitment — don't over-credit calling (`γ`) | Phase 4 | `[DERIV]` |
| C4 | §6 = normative gates vs descriptive priors; don't gate on category freq / 22% | Phase 5 | `[EMP]` |
| C5 | Joker curve is partly endogenous — fit shape, not causal slope | Phase 5 | `[EMP]` |
| C6 | Received Charleston tiles come from real opponent policies, not uniform | Phase 2 → 6 | `[HEUR]` |
| C7 | "Single-player valid early" is `[XFER]` for NMJL, not `[ACAD]` | Phase 7 / provenance | tag fix |
| C8 | Card-encoding integrity is a first-class manual gate (points, C/X, partitions) | Phase 0 | manual |
| C9 | Deficiency is plain `[DERIV]` here (fixed multiset, no sequences) | Phase 1 / provenance | tag fix |
| C10 | Objective mode `{WINS, POINTS}` parameterizes ranking, Charleston, defense | Ph 3/6/8 | `[DERIV]` |

---

## 6. Testing & provenance discipline
- **Regression suite** (extend `test.js`): tile-pool invariants; per-line 14-tile round-trip;
  deficiency on known racks; concealed-vs-exposed acceptance (C1); `keepValue` dedup (C2); the
  **conservation invariant** (Phase 2, the most important test); calibration gates (Phase 5).
- **Provenance registry** (`provenance.js`): every recommendation returns `{value, tag, basis}`;
  UI renders the badge; `[FOLK?]` items render as flagged myths.
- **No weight ships unfit** against the Phase-4 MC (principle 1).

---

## 7. Decisions / open questions for you
0. **Default objective mode** — ship **WINS-first** (data-light; the current engine already
   targets it) and layer POINTS in at Phases 3/6/8? *Recommended: yes.*
1. **Points + C/X data source** — physical 2026 card, owned digital copy, or vetted transcription?
   Needed only for POINTS, so it does **not** block the spine. Specify your table's `ScoringRuleset`.
2. **Points objective = net EV or self-EV?** Net (subtract what you pay when others win) is what
   actually makes points players defend differently; the plan assumes **net EV** — confirm.
3. **§6 anchors** — re-pull fresh 2026-card platform stats, or proceed using 2022 numbers as
   priors only (per C4/C5)?
4. **Opponent inference depth** — stop at the *measurement* (how much signal the Charleston
   carries) and a simple posterior, or commit to a richer model regardless of the measured ceiling?
5. **Performance** — accept JS/Node throughout, or pre-authorize the Python sidecar if Phase 4
   calibration MC is too slow?

---

## 8. Critical path & sequencing

```
Phase 0 (card integrity) ─┬─► Phase 1 (kernel + C1) ─┐
                          └─► Phase 2 (DEALER/spine) ─┴─► Phase 3 (agent + scorer + modes)
                                                            └─► Phase 4 (multi-agent MC, C3) 
                                                                  ├─► Phase 5 (calibrate, C4/C5)
                                                                  │     └─► Phase 6 (Charleston v2, C2/C6)
                                                                  └─► Phase 7 (Observer / opponents, C7)
                                                                        └─► Phase 8 (divergence + UI)
```

**Start now (no blockers, highest leverage):** **Phase 2 — the `Dealer` + conservation invariant.**
It depends only on the existing tile model and card, it is the load-bearing piece every later
phase hangs off, and the conservation test it ships is what makes all downstream opponent-
inference results trustworthy. Phases 0 and 1 proceed in parallel; POINTS-mode data (Phase 0's
point values) is the only thing on the critical path that can be deferred without stalling the spine.

---

## 9. Part 2 integration (validation analysis & statistical toolkit)

Part 2's four validity conditions and decision-quality toolkit are folded in as follows.

**A — validity conditions.**
- **A.1 non-uniform incoming — DONE (first order).** `charleston2.sampleIncoming` draws incoming
  from a naive neighbor's *policy* (it sheds isolated tiles), so incoming is junk-biased, not
  uniform; the full Dealer path uses the other seats' real policies. *Deferred:* the fixed-point /
  fictitious-play equilibrium (iterate opponents-vs-you until pass policies stop changing).
- **A.2 policy-conditional estimates — DONE.** `stats.ROLLOUT_POLICY` is an explicit versioned
  object stamped on every result; current `0.1.0-greedy` is honest about its 82% vs 89% ceiling.
- **A.3 variance surfaced — DONE.** `stats.wilson`/`pairedDiffCI`/`nToSeparate`; pass ranking
  flags a **dead heat** when the CRN paired CI overlaps zero. (SE table matches Part 2 exactly.)
- **A.4 conditional calibration — DONE.** `calibrate.js` reports Brier / log-loss / **ECE** +
  reliability curve, and uses **Wilson** (not normal) CIs so tails stay valid. Current ECE ≈ 15%
  correctly flags that the closed-form weights need **refitting to the multi-agent ground truth**.

**B — toolkit, implemented:** B.1 EV-loss / percentile / dead-heat (`charleston2.choosePass`,
`gradePass`); B.3 Common Random Numbers (`stats.crnSeeds` + shared incoming bank); B.4 proper
scoring (`stats` + `calibrate`); B.10 Dirichlet-style opponent posterior (`observer.js`), whose
**measured** result is the honest headline: full-section prediction is no better than chance, but
shedding a section's theme is real *negative* signal (P drops 9.6%→6.7%).

## 10. What's deferred (Part 2 extensions roadmap — specced, not built)

Each is sound but a self-contained build; implement on the now-trustworthy simulator:
- **B.2 best-arm bandits** (Successive Halving / Hoeffding races) — adaptive rollout budget so the
  286-pass search is provably-bounded within the ~16.7 s players already spend.
- **B.5 Shapley per-tile blame** — attribute a pass's EV-loss across its 3 tiles via CRN-paired swaps.
- **B.6 Value-of-Information** for blind-pass / look / stop (entropy reduction; mutual information).
- **B.7 Win-Probability-Added** equity curve; **B.8 luck/skill session decomposition.**
- **B.9 interpretable surrogate** (logistic/GAM/GBM + SHAP) fit on self-play logs → **refit the
  `Score` weights by regression** (closes the ECE gap from A.4) + fast live advice.
- **B.11 paired self-play A/B** with bootstrap CIs — proves a recommender change actually helps.
- **A.1 full fixed-point incoming** + the play-phase refinements (joker redemption, blind-pass
  execution in the Dealer, a stronger rollout policy to close the 82%→89% gap).

**B.9 — DONE.** `fit_corpus.js` → `fit_model.js` → `calibrated.js`: a logistic predictor fit to
1,320 self-play samples cut held-out **ECE from 15% to 2.5%** (Brier 0.180→0.156). The dominant
learned feature is **`drawOnly` (pair/single slots, β=−0.35)** — the pair-hardness [DERIV] emerging
from data. Wired into the v3 panel as Zone 2 (calibrated `P(reach mahjong)`).

**Remaining highest-leverage:** a stronger rollout policy (A.2) to close the 82%→89% gap (which
would re-baseline `calibrated.js`), then the deferred Tier-2/3 tools (Shapley, WPA, VoI, best-arm).
