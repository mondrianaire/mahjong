# Part 3 — Decision-Support Analysis & Control-Panel Design
## Turning the engine's numbers into quick, topical, per-decision guidance

Companion to `charleston-and-hand-ranking-spec.md` (Part 1) and `charleston-eval-statistical-toolkit.md` (Part 2). Same provenance legend ([EMP]/[ACAD]/[XFER]/[DERIV]/[HEUR]/[FOLK?]).

This document answers four things the project now needs before any UI is built:
1. **Where the project stands** and what data actually exists at each decision point.
2. **What each researched method can and cannot conclude** — real-world implications, and the *type and amount* of conclusions extractable from the data.
3. **A control-panel design** that gives the user fast, topical access to exactly the relevant information at each step — with per-tile **immediate and long-term** effects and justification.
4. **An information-state model** that tracks what is private, what becomes public, and what the player may *legitimately* infer (e.g., "I passed the 5-Bam to my right, so that seat now holds it") — without ever crossing into illegitimate knowledge of hidden hands.

---

## 1. Current goals & honest implementation status

**Goal of the project:** an American Mahjong expert tool whose statistics and dataviews are grounded in real game-theory, not folklore — delivering data-backed *direction* and *Charleston* guidance, plus post-choice evaluation.

**Actual status: specification stage, no code yet.** What exists is three design documents and a memory of empirical anchors. The engine components they define, in dependency order:

| Layer | Component | Defined in | Built? |
|---|---|---|---|
| Kernel | Deficiency `D(P)` + tile-acceptance | P1 §2 | ✗ |
| Truth | Monte-Carlo `P_complete` + calibration | P1 §3.4, §6 | ✗ |
| Fast | Closed-form scorer + EV | P1 §3.2 | ✗ |
| Charleston | Pass / blind / stop / courtesy engine | P1 §4 | ✗ |
| Decision quality | EV-loss, best-arm, attribution, WPA | P2 §B | ✗ |
| Validity | Fixed-point incoming model, proper-scoring calibration | P2 §A | ✗ |

**Design consequence:** the control panel must be specified *against these components' outputs*, so the UI and the engine are co-designed and the panel never promises a number the engine can't yet defend (the §8 anti-overclaim rules enforce this). The control panel is the **consumer**; everything in Parts 1–2 is the **producer**.

---

## 2. Data inventory — what exists at each decision point

The Charleston is an information ramp: you start knowing only your own 13 tiles and end knowing your hand direction firmly plus weak-but-growing reads on three opponents. The data splits into three **epistemic classes** that the panel must keep visually distinct:

| Class | Definition | Examples during Charleston | Treat as |
|---|---|---|---|
| **Certain-private** | Facts only you hold, known with probability 1 | Your current rack; the exact tiles *you* passed to each specific seat and when; the exact tiles you received and from whom | **Fact** |
| **Inferred** | Probabilistic deductions from certain-private facts | Each opponent's likely section; what a seat is *not* collecting (from what they passed you); whether a tile you passed is *still* held | **Belief + confidence** |
| **Public** | Visible to all (mostly post-Charleston) | Exposures, discards, jokers on the table, dead-hand calls | **Fact, shared** |

### 2.1 The information timeline (what becomes knowable, when) — **[DERIV]**

```
Deal (T0)        : 13/14 own tiles [certain-private]. Opponents: nothing.
R1 Right (T1)    : you give 3 to RIGHT, get 3 from LEFT.
R1 Across (T2)   : exchange with ACROSS.
R1 Left  (T3*)   : give 3 to LEFT (blind-eligible).
R2 Left  (T4)    : ... optional second dance ...
R2 Across(T5)
R2 Right (T6*)   : (blind-eligible)
Courtesy (T7)    : 0–3 with ACROSS, by agreement.
--- wall play --- : discards & exposures begin → PUBLIC data starts.
```

At every pass you generate two certain-private records — *who you handed which tiles to*, and *who handed which tiles to you*. These are the raw material for opponent inference. Critically, **passes are private exchanges: nothing is public during the Charleston.** Any opponent read in this window is *inferred*, never *known*, with one exception — tiles **you personally passed** are known to be in that seat's hands at the moment of passing (§7).

### 2.2 The fair-play boundary (this governs the whole design) — **[DERIV]**

The training simulator (Part 1 §3.4) has full global state; that is correct and unbiased *for training agents*, because each agent still **acts only on its own information set**. The **advisory UI must obey the same restriction**: it may use only the *certain-private* and *public* data the human player could legitimately possess, plus *inferences* a sharp human could in principle make. It must **never** surface an opponent's hidden tiles, even though the simulator knows them. This is the standard imperfect-information-game formulation (agents reason over information sets), and it is also the ethics line that keeps the tool a *coach* rather than a *cheat*. Full global state is permitted in exactly one place: **post-game replay/teaching** (§7.4), where revealing who-held-what is a learning aid, not live assistance.

---

## 3. Methods → conclusions: real-world implications & how much you can actually extract

For each researched method, what it concludes, how strong that conclusion is in the real world, and the *type* and *amount* of conclusion it yields. This is the basis for the anti-overclaim rules (§8): the panel's assertiveness must match the conclusion strength.

| Method (source) | What it concludes | Conclusion type | Strength / real-world caveat |
|---|---|---|---|
| **Deficiency `D(P)`** [ACAD/DERIV] | Tiles still needed for hand P | Structural-certain (1 scalar/hand) | **Very high** — exact from rules. The single most trustworthy number. |
| **Tile acceptance / minAccept** [XFER/DERIV] | How reachable the missing tiles are; the bottleneck slot | Structural-certain | **High**, but ignores opponents competing for the same tiles → mild optimism. |
| **Pair/single penalty** [DERIV] | This hand is structurally hard (no jokers, no calls) | Structural-certain | **Very high** — provable from joker rule. |
| **Closed-form score / EV** [HEUR→EMP] | Ranking of hands; a rough probability | Prescriptive + probabilistic | **Medium** until weights are sim-fit; good for *ranking*, weak as a literal % early. |
| **Monte-Carlo `P_complete`** [ACAD] | Calibrated completion probability + CI | Probabilistic-calibrated | **High *iff* P2 §A conditions hold** (non-uniform incoming, variance control, conditional calibration). Policy-conditional. |
| **Direction weights** (§6 here) | Which *sections* to aim for | Prescriptive, aggregated | **High & robust** — aggregating over a portfolio cancels per-hand noise. The most valuable early output. |
| **EV-loss / percentile** [ACAD-style] | How good a specific pass was | Prescriptive, retrospective | **High for grading**, but relative to the engine's own policy version. |
| **Opponent posterior** [HEUR/ACAD] | Opponent likely on section S | Inferential-tentative | **Low early, rising** — during Charleston this is genuinely weak; must be shown as a lean, not a finding. |
| **VoI (blind/look/stop)** [XFER] | Decision under uncertainty | Prescriptive | **Medium** — depends on incoming model. |
| **WPA / equity curve** [ACAD-style] | Per-action value swings | Probabilistic, trajectory | **Medium**, inherits MC; best for post-game learning. |

### 3.1 Type and amount of conclusions, as a function of time — **[DERIV]**

The *amount* of trustworthy conclusion is wildly asymmetric and shifts over the Charleston:

- **At the deal:** you can extract a **large amount** about *yourself* — full hand portfolio, direction with confidence, per-tile value, the best pass — and **almost nothing reliable** about opponents. The panel should be self-focused and confident here.
- **Through the Charleston:** self-conclusions *sharpen* (direction firms, deficiency drops); opponent-conclusions *appear but stay noisy*. The panel's opponent zone should visibly fill in while explicitly signaling low confidence.
- **At wall play (out of core scope):** public data (exposures/discards) finally makes opponent conclusions **strong**, flipping the panel toward defense.

**Design takeaway:** the control panel's confidence must be *time-aware*. Early defensive advice rests on weak inference and can make a player "play scared on bad information" — a real failure mode. Down-weight opponent-driven advice until evidence accumulates (§8).

---

## 4. The control panel — six zones, re-prioritized per decision point

Design goal stated by the project: **quick, easy access to relevant, usable, topical information at each point in the decision process.** The panel is a fixed set of six zones; what each zone *contains* and how prominent it is **re-renders per decision point** so the player always sees the few things that matter *now*, never an undifferentiated dump.

Density is **adaptive**: the default is expert-dense (numbers, rankings, CIs); every zone has an **"explain" affordance** that expands the plain-language *why* for learners. Same panel, two reading depths.

### 4.1 The zones

| # | Zone | Always answers | Primary engine input |
|---|---|---|---|
| **1** | **Direction Compass** | "Which sections am I aiming for, and how settled is that?" | direction weights §6 |
| **2** | **Hand Portfolio** | "What are my live hands, how close, how likely, how valuable?" | `D(P)`, `P_complete`±CI, EV |
| **3** | **Tile Tray** | "For each tile in my rack: keep, pass, or flex — and why?" | keepValue, constraints, per-tile effects §5 |
| **4** | **Pass Builder** | "Is the pass I'm assembling optimal? Should I blind/stop/courtesy?" | EV-loss, percentile, VoI |
| **5** | **Opponent Intelligence / Information Ledger** | "What do I know and legitimately infer about each seat?" | info ledger §7 |
| **6** | **Tempo & State** | "Which pass is this, how many jokers, how much should I deliberate?" | game state, §6 anchors |

### 4.2 Topicality map — what's emphasized when — **[HEUR]**

| Decision point | Lead zones | Muted | Special widget |
|---|---|---|---|
| **Deal / initial analysis** | 1 (direction), 2 (portfolio), 3 (tile tray) | 5 (empty) | "Pick a section, not a hand" framing |
| **R1 passes** | 3 (tile tray), 4 (pass builder) | 1 (still forming) | Pass-builder EV-loss live |
| **R1 Left / R2 Right (blind-eligible)** | 4 (blind rec) | — | **Blind-pass VoI gauge** |
| **R2 stop decision** | 4 (stop rec), 1 (is direction settled?) | — | **Stop-vs-continue meter** |
| **Courtesy** | 4 (courtesy *k* rec), 5 (defensive override) | 2 | **Courtesy size dial** |
| **Wall play** (future) | 5 (defense), 2 (committed hand) | 1, 3 | Discard-safety overlay |

The result: at any instant the player's eye lands on at most **two or three live zones**, each carrying only this-step-relevant content. That is the "quick and easy access" requirement made concrete.

---

## 5. The Tile Tray — per-tile action, justification, immediate & long-term effect

This is the heart of the request: *for each tile, justify the suggestion and describe both the immediate and long-term desired effect.* Each rack tile renders as a chip carrying a small, fixed data model.

### 5.1 Per-tile data model — **[DERIV]/[HEUR]**

```
TileAdvice {
  tile
  action      : KEEP | PASS | FLEX | HOLD_AS_BAIT     // FLEX = keep one more pass, then re-decide
  keepValue   : float        // §4.1 of Part 1 — portfolio contribution
  constraints : [ JOKER_NEVER_PASS | DONT_SPLIT_PAIR | HIGH_UTILITY(Flower/Soap)
                 | COHERENT_GROUP_WARN | DEFENSIVE_FLAG ]
  immediate   : string       // marginal effect on your CURRENT best hand if you act now
  longTerm    : string       // effect on your TRAJECTORY / option value
  confidence  : low|med|high // inherited from the inputs behind the call
}
```

### 5.2 Action taxonomy and its two-horizon logic — **[HEUR]/[DERIV]**

The split the project asked for — *immediate vs long-term* — is exactly the tension between **current hand strength** and **option value**. Define both explicitly per action:

| Action | When | **Immediate** desired effect | **Long-term** desired effect |
|---|---|---|---|
| **KEEP** | high keepValue; serves top candidate(s) | Holds your current best hand's deficiency where it is | Preserves the live direction; nothing to rebuild later |
| **PASS** | keepValue ≈ 0; serves no top candidate | Frees a pass slot at no cost to your best hand | Sheds a dead pivot so your tiles, picks, and attention concentrate on the live direction; denies a useless tile to the table |
| **FLEX** | medium keepValue; serves a *backup* section | No change now (don't commit) | Buys one more pass of information; keep the pivot alive only while it's cheap — converts to KEEP or PASS at the next pass |
| **HOLD_AS_BAIT** | a pair you can't use | Costs you a near-zero-value slot | Later joker-bait: discard one in the mid-game to reclaim a joker (Part 1 §Jokers) |

The **immediate** effect is computed as the marginal change in your single best hand's score if you act this instant (mostly "no change" for PASS — that's the point). The **long-term** effect is the change in **portfolio option value** and **direction concentration** — which is where the real cost/benefit lives, and what novices systematically misjudge (they over-keep pretty tiles, breaking the §6 direction logic).

### 5.3 Worked example tray (illustrative) — **[DERIV]**

Example deal (advised player, pre-pass). The portfolio scorer returns a **strong 369 direction** (you hold 3-3-3, 6-6-6, 9-9-9 spread across suits), with a faint evens backup.

Rack: `🃏 🃏 (2 jokers) · Flower · 3B 6B 9B · 3C 6C · 4B · 2D 5D · N E`

| Tile | Action | Immediate effect | Long-term effect | Why (justification) |
|---|---|---|---|---|
| Joker ×2 | **KEEP** | Illegal to pass; fills your 369 kongs now | Each joker ≈ **+12 % win prob** (§6); 369 is pung/kong-heavy → ideal joker home | Joker rule + EMP joker curve |
| 3B / 6B / 9B | **KEEP** | Core of the live 369 hand; deficiency rests on these | Anchors the highest-confidence direction; irreplaceable as a set | Top-candidate members, high keepValue |
| 3C / 6C | **KEEP** | Builds the second-suit 369 requirement | Keeps the 2-suit and 3-suit 369 lines both open | Serve multiple 369 lines |
| Flower | **KEEP** | Feeds 369-with-flower lines + joker-bait value | Scarce, cross-useful; holding preserves several lines at once | HIGH_UTILITY |
| 4B | **PASS** | No effect on the 369 hand (4 isn't a 369 number) | Sheds a weak evens/consec pivot you're unlikely to need given a strong 369 core | keepValue ≈ 0 vs live direction |
| 2D | **PASS** | Isolated; serves no top candidate | Concentrates draws on 369 instead of a dead evens hope | Isolated, lowest utility |
| 5D | **PASS** | Isolated; no current use | Same — declutters toward the committed direction | Isolated |
| North | **PASS** | Lone wind, no 369 use | Minimal option value; passing leaks least (single honor) | Lowest keepValue; safe to release |
| East | **FLEX** | No current 369 use | If a 2nd wind arrives, opens a Winds&Dragons fallback — but option value is low against a strong 369 lean; **pass next** if no wind comes | medium keepValue, decays fast |

Recommended pass this step: **{2D, 5D, North}** (three lowest-keepValue, none forming a coherent group for an opponent). East and 4B are the visible "tension" tiles where immediate (no use) and long-term (thin pivot) both point weakly toward passing soon — the panel shows that reasoning rather than hiding it.

> Adaptive note: expert mode shows the action chips + keepValue; "explain" expands the immediate/long-term columns into the sentences above.

---

## 6. The Direction engine — the "general direction" output

The project's central early ask: *identify a general direction of which sets to aim for, from statistical analysis and current state.* This is computed by aggregating the portfolio up to the **section** level, which is both more **robust** (noise cancels) and more **actionable** early than any single-hand pick.

### 6.1 Direction weight — **[HEUR→EMP]**

```
for each section S on the card:
    W(S) = Σ over candidate hands P in S of   Score(P) · presence(P)
           where presence(P) = (tiles you already hold toward P) / (size of P)
    blend in the empirical base-rate prior(S)  (§6 of Part 1: Consec Run high, etc.)
normalize W(·) → a probability-like distribution over sections
```

Show the **top 2–3 sections** with a strength bar. Two derived indicators drive the "commit vs stay flexible" guidance:

- **Concentration** = 1 − normalized entropy of W(·). High concentration → a clear single direction → start committing tiles. Flat W(·) → stay flexible, pass only obvious junk.
- **Flexibility premium** decays as the Charleston ends: early, keeping two sections alive is cheap and wise; by R2/courtesy, indecision is expensive. The panel weights the same concentration number differently by decision point.

### 6.2 What the Direction Compass shows — **[HEUR]**

> **Lean: 369 ▰▰▰▰▱ strong · 2468 ▰▱▱▱▱ faint backup** — *Confidence rising. Commit your passes to 369; hold one evens pivot (4B) for one more round.*

**Immediate effect:** orients *this* pass — the tile tray's KEEP/PASS calls are derived from the leading section(s). **Long-term effect:** as concentration climbs over successive passes, FLEX tiles resolve to KEEP/PASS and the player converges on a single hand by the time the wall opens — which is exactly the expert "narrow, don't commit early; but do converge" arc, now quantified and visible.

---

## 7. The Information Ledger — tracking public, private, and legitimately-inferred knowledge

This addresses the project's specific insight: *as the Charleston continues, every step gives more information about opponents; when we give a tile to another player, we can indicate that they have it.* The ledger is the data structure behind Zone 5, and it is strictly bounded by the fair-play rule (§2.2).

### 7.1 What the ledger records — **[DERIV]**

```
ledger.passedOut[seat][tile] = t      // CERTAIN: you handed seat this tile at pass t
ledger.received[seat][tile]  = t      // CERTAIN provenance: this tile came FROM seat at t
ledger.notReturned[tile]              // tiles you passed that you never saw again
ledger.public[]                       // exposures, discards, table jokers (wall phase)
```

From these certain records the ledger derives **beliefs**, each carried with explicit confidence:

- **`holds[seat][tile]`** — starts at **1.0 the instant you pass it** (the user's point: you *know* you just handed it over), then **decays** as that seat makes subsequent passes and may forward it (§7.2).
- **`section_lean[seat]`** — a posterior over what that seat is collecting, from positive evidence (kept your tiles / passed you nothing of a type) and negative evidence (dumped a whole class on you). Tentative; see §3.1.

### 7.2 Belief decay — why "they have it" fades — **[DERIV]**

A tile you pass to a seat is certainly theirs at that moment, but they pass ~3 of their ~13 tiles on each subsequent pass-out, so the tile can move on. Model the survival probability:

```
P(seat still holds tile after k of their later pass-outs)
     ≈ Π over those passes of (1 − 3/handSize)        // ~ (1 − 3/13) per pass ≈ 0.77^k
```

So a tile you passed on R1 that the seat keeps through two more of their passes is ~0.77² ≈ **0.59** likely still theirs by courtesy — the ledger should render it as **fading**, not solid. (A seat that keeps slotting it deep in their rack is *positive evidence* it fits their hand, which the section-lean posterior picks up separately.) This keeps the panel honest: it distinguishes "I handed them this 30 seconds ago" (solid) from "they probably still have it" (faded).

### 7.3 Visual encoding (Zone 5) — **[HEUR]**

Per opponent seat, a card showing:
- **Solid chips:** tiles certainly given to them *this pass* (confidence 1.0).
- **Faded chips:** previously-given tiles, opacity = `holds` probability (§7.2).
- **A section-lean bar** with a confidence band — explicitly thin/greyed early to signal "tentative."
- **A "not collecting" strip:** classes they dumped on you (the cleanest early read).

The visual grammar must make **certain vs inferred unmistakable** — a player should never confuse "I know they hold the 5-Bam" with "they probably want craks." Solid = fact; faded/banded = belief.

### 7.4 Live vs replay — the two information regimes — **[DERIV]**

- **Live advice:** ledger is restricted to the advised player's information set (§2.2). This is the only legitimate mode during play.
- **Post-game replay / training review:** the simulator's **full global state** may be revealed — show every seat's actual hand, overlay it on what the ledger *believed*, and score the player's inferences ("you read seat-3 as winds; they were on 369 the whole time"). This is where full state is a teaching asset, not a cheat, and where the EV-loss/WPA tools (Part 2) attach their explanations.

**Immediate effect of the ledger:** during the Charleston it mostly enforces discipline — *don't pass a coherent group to one seat*, and *don't hand a seat a tile it's visibly collecting* (Zone 3 raises COHERENT_GROUP_WARN / DEFENSIVE_FLAG straight from the ledger). **Long-term effect:** it seeds the wall-phase opponent model (Part 2 §B.10) with a head start, and in replay it trains the player's own reading skill — the durable benefit.

---

## 8. Anti-overclaim rules — matching UI assertiveness to conclusion strength

The panel must never present a weak inference with the visual authority of a fact. Bind each output's presentation to its §3 strength class:

| Conclusion class | Allowed UI voice | Forbidden |
|---|---|---|
| Structural-certain (`D`, acceptance, what-you-passed) | Stated as fact; hard numbers | — |
| Probabilistic-calibrated (`P_complete`, EV) | Number **with CI**; "≈" and a band | Bare point estimate implying precision |
| Inferential-tentative (opponent leans, early) | Hedged lean, greyed, "tentative" | "Player 3 IS playing winds" |
| Prescriptive (pass rec, direction) | Recommendation + the EV-loss it would cost to deviate | Commanding tone on a close call |

Two hard rules: **(1)** when two options' CIs overlap, present them as tied — never fabricate an order (Part 2 §A.3). **(2)** Suppress or heavily hedge opponent-driven advice early, when §3.1 says the data can't support it; surfacing scary low-confidence reads makes players misplay good hands.

---

## 9. How this maps onto the engine (build notes)

- Zone 1 (Direction) needs only the **closed-form scorer** (P1 §3.2) — buildable first, cheap, high user value.
- Zone 2/4 probabilities need the **MC truth layer + calibration** (P1 §3.4/§6, P2 §A) before they may show numbers; until then, show **rankings without probabilities**.
- Zone 3 (Tile Tray) needs **keepValue** (P1 §4.1) — closed-form, available early.
- Zone 5 (Ledger) is **independent of the MC engine** — it's pure bookkeeping over the player's own actions, so it can ship early and deliver value (perfect recall of what-you-passed) before the heavy stats exist.
- The whole panel honors the **information-set restriction** (§2.2): wire it to the advised agent's information set, not global state, reusing the exact boundary the training simulator already enforces per-agent.

**Suggested first slice:** Direction Compass + Tile Tray + Information Ledger, all driven by the closed-form scorer and the player's own action log — no Monte-Carlo required. That delivers the project's headline asks (direction, per-tile keep/pass with reasons, "they now hold this tile") on the cheapest possible engine, with the calibrated probabilities and EV-loss grading layered on once the MC truth layer and its four validity conditions are in place.

---

## 10. Summary of recommendations

1. **Co-design panel and engine**; never show a number the engine can't defend (§8).
2. **Six fixed zones, re-prioritized per decision point** (§4) — at most 2–3 live at once = "quick, topical access."
3. **Per-tile chips carry action + justification + immediate + long-term effect** (§5); the long-term/option-value column is where the real teaching is.
4. **Lead with Direction, not a single hand** (§6) — robust, actionable, and the cheapest high-value output.
5. **An Information Ledger that separates certain / decaying / inferred** (§7), strictly inside the fair-play boundary (§2.2), with full-state reveal reserved for replay.
6. **Time-aware confidence** (§3.1, §8) — be bold about your own hand early, humble about opponents until the evidence arrives.
