# American Mahjong — Charleston & Starting-Hand Ranking
## Implementable Statistical / Game-Theory Specification

**Purpose.** A build spec for the analytical engine behind *American Mahjongg Expert*. It defines the math, formulas, weights, decision rules, and data structures for two coupled problems:

1. **Starting-hand ranking** — score and rank every candidate NMJL hand against a 13/14-tile rack from a game-theory standpoint.
2. **Charleston strategy** — quantify which tiles to pass/keep, blind-pass and courtesy-pass decisions, and the stop decision.

Every rule is tagged with a provenance/confidence flag so the app never presents folk wisdom as proven fact. Empirical anchors are given so the engine's outputs can be **calibrated against real game data**, not just asserted.

---

## 0. Provenance legend

| Tag | Meaning |
|-----|---------|
| **[EMP]** | Empirically measured from real game datasets (strongest). |
| **[ACAD]** | Established in peer-reviewed / academic mahjong-AI literature. |
| **[XFER]** | Rigorous theory from another mahjong variant (Riichi tile-efficiency) that transfers, with the transfer caveat stated. |
| **[DERIV]** | Directly derivable from NMJL rules + combinatorics (provable). |
| **[HEUR]** | Expert hobbyist heuristic — widely taught, broadly sound, not formally proven. |
| **[FOLK?]** | Folk belief that is disputed or contradicted by evidence — flag in UI, do not encode as truth. |

> **Design principle:** the engine's *ground truth* is Monte-Carlo simulation over the actual card and tile pool (§3.4, §4). The closed-form scores (§3.2) are a fast, explainable approximation that must be **calibrated to the simulation and to the empirical anchors in §6.** Never ship a heuristic weight that hasn't been fit against simulated or real outcomes.

---

## 1. Domain model & invariants

### 1.1 The tile pool (per NMJL set) — **[DERIV]**

| Tile class | Distinct | Copies | Total | Joker-substitutable? |
|---|---|---|---|---|
| Suits (Bam/Crak/Dot × 1–9) | 27 | 4 | 108 | Yes (in pung+ only) |
| Winds (N/E/W/S) | 4 | 4 | 16 | Yes (in pung+ only) |
| Dragons (Red/Green/White/"Soap") | 3 | 4 | 12 | Yes (in pung+ only) |
| Flowers | 1 (interchangeable) | 8 | 8 | Yes (in pung+ only) |
| **Jokers** | 1 | 8 | 8 | — |
| **Total** | | | **152** | |

Deal: 4 players × 13 tiles = 52; dealer (East) receives 14 → **53 dealt**, **wall = 99** at first pick. **[DERIV]**

### 1.2 The joker rule — the single most important quantitative asymmetry — **[DERIV]**

A joker may complete any group of **size ≥ 3** (pung, kong, quint, sextet). A joker may **never** be used for a **single (size 1) or a pair (size 2)**, and a paired/single tile can **never be claimed from a discard** except to declare Mahjong.

**Consequence the whole model turns on:** the *only* ways to fill a pair/single slot are (a) be dealt it, (b) be passed it in the Charleston, or (c) self-draw it. You cannot call it and you cannot joker it. Therefore pair/single slots have **drastically lower tile-acceptance** than pung+ slots and dominate hand difficulty. This is the formal reason "build around pairs" and "fewest pairs wins" are correct. (See §2.3, §6 — Singles & Pairs hands are empirically ~0.01–0.03 % of wins despite 50 points.)

### 1.3 Card data structure

```
HandPattern {
  id: string                 // e.g. "2025-CONSEC-5b"
  category: enum             // CONSEC_RUN | 2468 | 13579 | 369 | WINDS_DRAGONS
                             // | LIKE_NUMBERS | QUINTS | YEAR | ADD_MULT | SINGLES_PAIRS
  points: int                // face value V(P)
  concealed: bool            // concealed-only hand?
  suitFlex: enum             // FIXED | ANY_1_SUIT | ANY_2_SUIT | ANY_3_SUIT
  groups: [ Group ]          // exactly fills 14 tiles
}
Group {
  size: 1|2|3|4|5|6          // single|pair|pung|kong|quint|sextet
  jokerEligible: (size >= 3) // derived, never hand-set
  tileSpec: TileSpec         // concrete tile or a role bound at assignment
                             // (e.g. "the even number N in suit A", "Flower", "White Dragon as 0")
}
```

`RackState { counts[34+flowers+jokers], jokers:int, isDealer:bool }`
`UnseenPool { counts = fullPool − seen(rack, discards, exposures, passedAway) }`

> Card size varies by year (~50–70 hands). Encode the **current** card as data; the engine is card-agnostic. **[DERIV]**

---

## 2. Core primitive — Deficiency & Tile-Acceptance

This is the foundation both problems are built on. In Riichi this is *shanten* (distance) and *ukeire* (acceptance); American mahjong is **structurally simpler and more exactly computable** because every hand is a **fixed target multiset**, not an open set of sequence shapes — there are no chows/runs to enumerate. **[XFER]** (concept) + **[DERIV]** (exact form).

### 2.1 Optimal assignment & deficiency — **[ACAD]/[DERIV]**

For a rack `R` and a candidate pattern `P`, find the assignment of rack tiles (and held jokers) to `P`'s groups that **maximizes tiles-in-place**, subject to: a joker may only occupy a slot in a group of size ≥ 3.

```
tilesInPlace(R, P) = max over legal assignments of
                     ( naturals matched + jokers legally placed )
deficiency  D(P)   = 14 − tilesInPlace(R, P)        // "tiles still needed"; 0 = complete
```

`D(P)` is the American-mahjong **deficiency number** (the NMJL analog of shanten). The assignment is a small bipartite/greedy match — for suit-flexible hands, evaluate each legal suit permutation and keep the best. The deficiency number is the standard hand-evaluation metric in mahjong AI, and fast exact algorithms exist. **[ACAD]** (Li et al., *A Fast Algorithm for Computing the Deficiency Number of a Mahjong Hand*, arXiv:2108.06832).

### 2.2 Per-slot acceptance — **[XFER]/[DERIV]**

For each still-empty slot `i` in `P`, compute its **acceptance** = count of unseen tiles that can fill it, and its **claimability**:

```
slot is in group size ≥ 3 (pung/kong/quint/sextet):
    acceptance(i) = unseen(targetTile)              // natural copies left
                  + unseen(JOKER)                    // jokers are legal here
    claimable(i)  = TRUE                             // may claim a discard

slot is a pair or single (size ≤ 2):
    acceptance(i) = unseen(targetTile)               // naturals ONLY — no jokers
    claimable(i)  = FALSE                            // self-draw or Charleston only
```

`Aᴴ(P)` (hard acceptance) = the multiset/aggregate of `acceptance(i)` over empty slots. Two scalars the scorer uses:

- `minAccept(P) = min_i acceptance(i)` — the bottleneck slot (a single tied-up pair can sink an otherwise-easy hand).
- `drawOnlySlots(P) = #{ i : claimable(i) = FALSE }` — pair/single slots, the expensive ones.

### 2.3 Why pairs are expensive — the explicit number — **[DERIV]**

A pung/kong slot can be filled from **~4 sources per turn cycle** (your draw + 3 opponents' discards) and accepts jokers, so its effective acceptance is `naturalsLeft + jokersLeft` against **~16–17 of your own picks plus dozens of claimable discards**. A pair slot accepts only `naturalsLeft` (≤ 3 after you hold one) and **only from your own ~16–17 picks**. The probability a given draw-only pair completes over a game is therefore an order of magnitude lower than a callable pung. Encode this as a hard multiplier, not a soft nudge.

> **Transfer caveat for [XFER] items:** Riichi tile-efficiency reasoning about *isolated tiles, joints (ryanmen/kanchan), and five-block theory* assumes **runs/sequences exist**. NMJL hands (other than Consecutive Run, which still uses fixed copies not open runs) have **no chi/sequence mechanic**. Import the *acceptance / duplicate-acceptance / two-pairs* logic; **do not** import joint-shape valuation literally.

---

## 3. Starting-hand ranking model

Goal: given the rack, return a ranked list of candidate hands with a score, an expected-value, a completion probability, and a human-readable rationale. Run at deal time and re-run after every Charleston pass.

### 3.1 Candidate generation — **[HEUR]→[DERIV]**

Don't score against a fixed single hand; keep a **portfolio**. Generate candidates by:

1. Compute `D(P)` for **all** patterns on the card (cheap; ≤ ~70).
2. Keep the top-`K` (K ≈ 6–10) by a coarse pre-rank of low `D(P)`, then break out by **section** so the portfolio spans categories (matches expert practice of "pick a section, not a hand," and supports pivoting). **[HEUR]**

### 3.2 The closed-form score (fast, explainable)

For each candidate `P`, compute a completion-probability estimate then an EV. Use a **per-slot independent-completion approximation** (rank-stable and explainable; calibrate against §3.4 MC):

```
horizon H ≈ 16        // self-picks remaining for this player over a full game [EMP-derived, §6]
for each empty slot i:
    let a = acceptance(i), claim = claimable(i)
    # effective opportunities: own draws always; callable slots also see discards
    opp_i = H                       if claim = FALSE        # pair/single: draws only
          = H + γ · H               if claim = TRUE         # pung+: draws + claims, γ≈2.0 [EMP-tunable]
    # hypergeometric-style per-slot fill probability against the unseen pool U
    p_i = 1 − C(U − a, opp_i) / C(U, opp_i)        # prob ≥1 of the a useful tiles appears
P_complete(P) ≈ Π_i p_i · jokerAdj(P)             # independence approx — see caveat
```

`jokerAdj(P)` rewards a pattern that can **absorb the jokers you actually hold** (jokers idle in a pair-heavy hand are wasted):

```
usableJokerSlots(P) = # empty slots with size ≥ 3
jokerAdj(P) = 1 + β · min(heldJokers, usableJokerSlots(P)) / 4     // β ≈ 0.15, fit to §6 curve
```

**Score & expected value:**

```
EV(P)    = P_complete(P) · V(P)              // value-efficiency (point efficiency)
Score(P) = w_d ·  (−D(P))                    // distance      [ACAD]
         + w_a ·  log(1 + Σ acceptance(i))   // raw acceptance/flexibility [XFER]
         + w_b ·  log(minAccept(P)+1)        // bottleneck (don't get blocked) [XFER]
         − w_p ·  drawOnlySlots(P)           // pair/single penalty [DERIV]
         + w_j ·  (jokerAdj(P) − 1)          // joker leverage [EMP]
         + w_f ·  prior(P.category)          // base-rate prior, §6 [EMP]
```

Present **both** `Score` (speed-oriented ranking) and `EV` (value-oriented ranking) — they diverge exactly where the I Love Mahj data shows points are mis-calibrated to difficulty (§6). Let the user toggle "easiest to finish" vs "best expected value."

**Default weights (starting point — MUST be refit to §3.4 / §6):**
`w_d = 1.0, w_a = 0.6, w_b = 0.5, w_p = 0.8, w_j = 0.7, w_f = 0.4; β = 0.15, γ = 2.0`.

> **Caveat to surface in code comments:** the `Π p_i` independence assumption is wrong in two known directions — (a) jokers are a **shared** resource across pung+ slots (over-counts when several slots compete for the same few jokers); (b) tile depletion couples slots. Use the closed form for live ranking/explanation; use MC (§3.4) for the numbers shown as "probability" and for weight-fitting.

### 3.3 Tie-breakers / portfolio rules — **[HEUR]**

When scores are close, prefer the candidate that (in order): needs **fewer additional pairs**; is **non-concealed** (concealed hands win ≈10× less often for only +5 pts — bad EV, see §6); **shares the most tiles** with other top-portfolio hands (keeps pivot options, raises retained flexibility). These three are the I Love Mahj "narrow to two" rules, now ordered by EV impact.

### 3.4 Monte-Carlo ground truth (recommended primary engine) — **[ACAD]**

The literature's consensus for the early/closed phase: treat hand-building as **single-player Mahjong** — opponents barely affect optimal early policy — and only switch to opponent-modeling near end-game (Zhang et al.; Mizukami & Tsuruoka MCTS). This validates a fast single-player simulator for Charleston + starting-hand analysis. **[ACAD]**

```
estimateCompletion(P, rack, unseen, policy, N=2000):
  wins = 0
  for n in 1..N:
     simulate the remainder: deal Charleston incoming (or sample), then
     loop picks from a shuffled unseen wall, applying a greedy
     deficiency-reducing discard policy (maximize Σ ΔtilesInPlace),
     allowing legal calls on simulated discards;
     if reach D(P)=0 within horizon: wins++
  return wins / N
```

Use the **deficiency reduction** `Δ` as the per-step reward (this is exactly the *ShangTing distance differential* reward-shaping shown to drive a 100 % single-player completion rate in forward search; Chen et al., arXiv:2305.04145). MC gives the calibrated `P_complete` that the closed form approximates, and is what the dataviews should display as the headline probability. **[ACAD]**

---

## 4. Charleston engine

The Charleston is a 0-information-cost way to upgrade your hand (you choose what leaves; you can't lose net tiles) **plus** a noisy channel that leaks opponent intentions. Model it as repeated **portfolio-improving exchanges** under constraints.

Fixed sequence (NMJL): **R1**: right → across → left(*blind-eligible*); optional **R2**: left → across → right(*blind-eligible*); then optional **Courtesy** (0–3 across, by mutual agreement). Jokers may never be passed in any pass. **[DERIV]**

### 4.1 Keep-value of a tile (the quantity everything else uses) — **[XFER]/[DERIV]**

Define the marginal value of holding tile `t` as its contribution to the **portfolio**, not to one hand:

```
keepValue(t) = Σ over portfolio hands P of   Score(P) · contributes(t, P)
where contributes(t, P) = 1 if removing one copy of t raises D(P), else fractional
                          (weight by acceptance the tile satisfies)
```

Intuition: a tile that advances several high-scoring candidates is "load-bearing"; a tile no top candidate uses is freely passable. This formalizes "pass the 3 that fit the least" and "keep overlapping tiles." **[HEUR]→quantified**

### 4.2 Pass selection (each required pass) — **[HEUR]/[DERIV]**

Choose the 3 tiles minimizing keepValue, subject to **hard constraints** (these encode both legality and defense):

1. **Never** pass a joker (illegal). **[DERIV]**
2. **Never split a usable pair by passing into it**; if a pair must go, break it across two *different* recipients (don't hand one player a ready pair). **[HEUR]**
3. Avoid passing **flowers** and **White Dragons** (Soap) — high cross-hand utility (Soap doubles as "0" in year/addition hands). **[HEUR]**
4. Avoid passing a **coherent group to one opponent**: same number across suits (feeds Like Numbers), consecutive/near numbers (feeds Consec Run), all-same-suit, or a wind set. **[HEUR]** (defensive — minimizes information *and* material handed over.)

Among tiles passing the constraints, pass the lowest-keepValue 3. If fewer than 3 tiles are "junk," you are near the **stop/blind region** (§4.4–4.5).

### 4.3 Reading incoming tiles (cheap Bayesian signal) — **[HEUR]/[ACAD]**

You learn nothing new about your own hand from what you pass, but **incoming tiles are evidence about opponents**. Maintain a coarse posterior over each opponent's section:

```
P(opp = section S | evidence) ∝ P(evidence | S) · prior(S)
evidence = tiles received from that seat + tiles you passed that did NOT return
heuristic likelihood: a seat that passes you an entire class (all winds, all craks)
                      is evidence-AGAINST playing that class — downweight S that needs it.
```

Treat as **hints, not conclusions** — early-Charleston direction is tentative and players pivot (a seat dumping winds may later swing wind-heavy). Decay the signal; only firm it up with later passes, discards, and exposures. **[HEUR]** This is the lightweight front half of the opponent model that becomes load-bearing at end-game (§5).

### 4.4 Stop decision (R2) — **[HEUR]/[DERIV]**

Stopping is legal for any single player after R1's last left; the courtesy pass still happens. **[DERIV]** Evidence (Sloper) is that R2 usually recirculates "the same junk," so the **default is mild**: continue if it costs little.

Decision via expected portfolio score:

```
ΔStay = E[ best portfolio Score after 3 more incoming ] − currentBestScore
ΔGive = E[ loss from surrendering your 3 lowest-keepValue tiles ]
CONTINUE R2  iff  ΔStay > ΔGive
Practical reduction: CONTINUE iff (#tiles with keepValue ≈ 0) ≥ 3.
STOP iff you hold a near-made hand OR two strong contenders AND < 3 junk tiles
     (giving away load-bearing tiles outweighs the thin R2 upside).
```

This matches both Sloper's "continue if you have ≥3 clearly passable tiles; stop only with a strong/committed hand" and the worked 369 example (5 pairs → lock a 4-pair hand with 2 jokers, 4 junk to pass → **do not stop**). **[HEUR]** Flag in UI: habitual early stopping is **[FOLK?]** — believed to help, contradicted by available observational data (Dunning–Kruger note in Sloper FAQ 28); do not bias the recommender toward stopping.

### 4.5 Blind pass (last pass of each round) — **[DERIV]/[HEUR]**

On R1-left and R2-right you may pass on incoming tiles **without looking**, substituting from incoming for tiles you'd rather keep.

```
blindPass is correct iff  min keepValue over your 3 candidate-pass tiles  is HIGH
   (your hand is dense — every tile is load-bearing — so you'd rather gamble the
    unseen incoming through than break a real combination).
Equivalently: E[value(3 unknown incoming)] < value(your 3 least-bad keepers).
```

When your hand is weak (many low-keepValue tiles), **look** — you want the information and the chance to keep a useful incoming tile. **[HEUR]**

### 4.6 Courtesy pass (0–3 across) — **[HEUR]/[DERIV]**

Optional, mutually-agreed count. Pure EV trade:

```
offer k = max k in {0..3} such that  E[Δscore from passing k worst, receiving k unknown] > 0,
          AND k ≤ (your count of keepValue≈0 tiles).
```

Empirically thin upside (Sloper: occasionally a useful tile appears) but **costless when you have ≥k junk tiles**, so default to offering your junk count. Add a **defensive override**: if an opponent is read as near-ready (§4.3/§5), reduce `k` toward 0 to avoid feeding them. **[HEUR]**

### 4.7 The "evil second across" edge case — **[HEUR]**

If you had exactly 3 passables and an incoming tile improves you on R2-across, you're forced to pass a wanted tile. Rule: **never break a pair**; surrender from an existing pung/kong instead (replaceable via draw, claim, or joker). Model this by passing the wanted-but-most-**re-acquirable** tile = highest `acceptance(i)` among callable slots. **[HEUR]**

---

## 5. Opponent / defensive model (end-game; lighter scope)

Out of the core Charleston/starting-hand scope but needed for a complete dataview. Switch from single-player (§3.4) to opponent-aware near end-game (consensus: MCTS with opponent models late, single-player early — Mizukami & Tsuruoka; Zhang et al.). **[ACAD]**

- **Exposure inference:** one exposure → narrow to a candidate set; two exposures → usually a unique hand. Maintain `P(hand | exposures, discards, Charleston signal)`. **[HEUR]**
- **Discard safety:** a tile with ≥2 copies already discarded is low-risk; a fresh tile a read-opponent needs is high-risk. Rank discards by `Σ_opp P(opp needs t) · P(opp can claim/win on t)`. **[HEUR]**
- **Tempo signals:** exposure tile-count reveals concealed-hand size; a discarded joker signals an opponent is single-tile/pair away — raise discard caution. **[HEUR]**

---

## 6. Calibration & validation targets (empirical anchors)

These are the **acceptance tests** for the whole engine. A model that violates them is wrong regardless of how elegant its math is. Source: I Love Mahj analysis of all games on their platform, 2022 NMJL card (mixed human + bot). **[EMP]**

| Quantity | Empirical value | Use in engine |
|---|---|---|
| Games ending in Mahjong vs wall | **89.3 % / 10.7 %** | Simulator win-or-wall rate must reproduce ~this under equal play. |
| Expected win rate, equal opponents | **≈ 22.3 %** (= 89.3 %/4 rounded; ~25 % naive) | A player-strength model should center here. |
| Avg tiles left in wall (wins) | **≈ 35** (≈ **31** incl. wall games) | Sets the **self-pick horizon H ≈ 16** used in §3.2. |
| Jokers received / game | **≈ 1.6** (8 jokers × ~80 % of wall drawn ÷ 4) | Prior over `heldJokers`; sanity-check `jokerAdj`. |
| Swapped jokers / game | **≈ 0.5** | Models joker re-acquisition from exposures. |
| Charleston think-time | **16.7 s/decision** (vs 3.5 s in play) | UX: Charleston is where deep compute is worth spending. |

**Joker → win-rate curve (the headline calibration target for `jokerAdj`/`β`):** **[EMP]**

| Jokers held | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Win % | 4.6 | 13.2 | 27.0 | 41.1 | 51.4 | 55.7 |

Roughly **+12 pts of win probability per joker up to ~4**, then saturating. The engine's predicted win-rate as a function of held jokers must track this curve; fit `β` (and validate MC) against it. (6+ jokers is rare and noisy — don't over-fit the tail.)

**Hand-frequency prior `prior(category)`** — completion-probability proxy, from win-share (bot games approximate objective difficulty since bots have no hand bias): **[EMP]**

| Tier | Categories (2022 card) | Approx win-share | Prior |
|---|---|---|---|
| Easiest / most flexible | **Consecutive Run** (esp. line 5) | single hand up to ~12 %, category dominant | High |
| Common | Like Numbers, Winds & Dragons, 2468, 13579, 369 | few % each | Mid |
| Hard | Year/2022, Quints | < 1 % | Low |
| Rare | **Singles & Pairs** (no jokers), Concealed | **~0.01–0.03 %** despite 50 pts | Very low |

> **Key EMP finding to encode as a feature, not a bug:** point value is **poorly correlated with difficulty**. Two 25-pt hands differ ~19 % vs ~0.7 % in frequency; Singles & Pairs is ~1000× rarer than Consec Run for 2× the points. ⇒ Rank by **EV = P_complete · V**, never by points. This is the central justification for the whole probabilistic engine and should be a visible dataview ("points vs. real difficulty"). **[EMP]**

---

## 7. Confidence ledger — proven vs. folk

| Claim encoded | Confidence | Basis |
|---|---|---|
| Deficiency number is the right distance metric | **High** | [ACAD] arXiv:2108.06832; standard in mahjong AI |
| Deficiency-differential reward drives correct greedy play | **High** | [ACAD] arXiv:2305.04145 (100 % single-player completion) |
| Single-player simulation valid for early/Charleston phase | **High** | [ACAD] Zhang et al.; Mizukami & Tsuruoka |
| Pair/single slots are ~order-of-magnitude harder (no joker, no call) | **High** | [DERIV] from NMJL rules; corroborated by [EMP] frequency |
| More jokers ⇒ ~linear ↑ win prob to ~4 | **High** | [EMP] I Love Mahj |
| Points mis-calibrated to difficulty ⇒ rank by EV | **High** | [EMP] I Love Mahj |
| Acceptance / duplicate-acceptance / two-pairs valuation | **Medium** | [XFER] Riichi tile-efficiency; transfer caveat (no sequences) |
| "Pass the least-useful 3; keep overlap; pick a section not a hand" | **Medium** | [HEUR] I Love Mahj, Mahj Mind, Sloper — consistent across experts |
| Blind-pass when hand is dense; look when weak | **Medium** | [HEUR] |
| Continue R2 if ≥3 junk; stop only with strong/2-strong hand | **Medium** | [HEUR] Sloper |
| Habitually stopping the Charleston helps you win | **[FOLK?]** | Contradicted by Sloper's observational data; surface as myth |
| "Same junk goes around" in R2 (R2 rarely helps) | **Low-Med** | [HEUR] strong expert consensus, not formally measured |
| Body-language / "tells" reads | **Low** | [HEUR] anecdotal; do not encode in core math |

---

## 8. Build order (suggested)

1. **§1 domain model + §2 deficiency/acceptance** — the kernel; unit-test against hand-crafted racks.
2. **§3.4 Monte-Carlo simulator** with deficiency-differential policy — this is your source of truth.
3. **§6 calibration harness** — reproduce the empirical anchors (win rate ~22 %, joker curve, wall ~35, category frequency). Do not proceed until the simulator matches.
4. **§3.2 closed-form scorer**, with weights **fit by regression against the simulator's `P_complete`** — now it's fast *and* grounded.
5. **§4 Charleston engine** on top of the portfolio scorer.
6. **§5 opponent model** last (end-game dataviews).

---

## 9. Sources

**Empirical / data**
- I Love Mahj — *American Mah Jongg Statistics* (full-platform 2022-card analysis): https://ilovemahj.com/mah-jongg-statistics
- I Love Mahj — *The Complete Guide to American Mah Jongg Strategy*: https://ilovemahj.com/american-mahjong-strategy

**Academic**
- Li et al., *A Fast Algorithm for Computing the Deficiency Number of a Mahjong Hand*, arXiv:2108.06832 — https://arxiv.org/pdf/2108.06832
- Chen, Lai & Lai (Stanford), *A Novel Reward Shaping Function for Single-Player Mahjong* (ShangTing distance, forward search), arXiv:2305.04145 — https://arxiv.org/pdf/2305.04145
- Cheng, Li & Li, *Mathematical aspects of the combinatorial game "Mahjong"*, arXiv:1707.07345 — https://arxiv.org/pdf/1707.07345
- Mizukami & Tsuruoka, *Building a Computer Mahjong Player Based on Monte Carlo Simulation and Opponent Models* (CIG 2015) — single-player-as-building-block, late-game MCTS
- Li et al., *Suphx: Mastering Mahjong with Deep Reinforcement Learning*, arXiv:2003.13590

**Tile-efficiency theory (transfer)**
- Japanese Mahjong Wiki — *Tile efficiency* (shanten, ukeire, five-block, duplicate acceptance, two-pairs): https://riichi.wiki/Tile_efficiency

**Expert hobbyist**
- Tom Sloper — *Sloperama* Mah-Jongg FAQs & strategy columns; FAQ 28 *Stopping the Charleston*: https://sloperama.com/mjfaq/mjfaq28.html
- Mahj Mind — *Mastering Charleston Decision-Making*: https://mahjmindaz.com/2025/08/20/mastering-charleston-decision-making-in-american-mahjong/
- Mahjong Playbook, Southern Sparrow, MahjongCompare — corroborating strategy guides (see notes).

> **Scope honesty:** No public dataset isolates *Charleston-pass-level* outcomes, and no peer-reviewed work models NMJL specifically (the academic corpus is Riichi/Chinese/HK). The strongest American-specific evidence is the I Love Mahj platform analysis [EMP]; everything labeled [XFER]/[HEUR] should be treated as a calibratable prior, not ground truth, and re-fit against this engine's own simulation logs as they accumulate.
