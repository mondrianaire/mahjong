# Charleston Lab — Part 3 Control-Panel Implementation Plan

Maps the Part 3 control-panel / information design onto the **already-built** engine
(`dealer.js`, `score.js`, `charleston2.js`, `observer.js`, `divergence.js`, `stats.js`,
`calibrate.js`). The panel is the *consumer*; the producer engine exists and is verified.

---

## 0. Review verdict + the status correction

Part 3 is strong and well-aligned with the project's ethos — the fair-play information-set
boundary (§2.2), the certain/inferred/public epistemic split (§2), and the anti-overclaim rules
(§8) are exactly right. **But its premise is stale.** §1 lists every engine layer as not built;
all are built and tested:

| Part 3 §1 layer | Part 3 says | Reality |
|---|---|---|
| Deficiency + acceptance | ✗ | ✓ `kernel.js` (C1 verified) |
| MC `P_complete` + calibration | ✗ | ✓ `play.js` + `calibrate.js` (joker curve matches anchor) |
| Closed-form scorer + EV | ✗ | ✓ `score.js` / `charleston2.js` (objective modes) |
| Charleston pass / stop / courtesy | ✗ | ✓ `dealer.js` + `charleston2.js` |
| Decision quality (EV-loss…) | ✗ | ✓ `charleston2.choosePass` / `gradePass` (CRN, dead-heat) |
| Validity (incoming, proper scoring) | ✗ | ✓ junk-biased incoming + Brier/ECE/Wilson (`stats.js`) |

**Consequences for sequencing.** Part 3 §9 says Zones 2/4 must wait for the MC layer and should
"show rankings without probabilities" until then. The MC layer exists, so those zones can show
numbers **now** — with one honest hedge: the rollout policy wins 82% vs the 89% anchor and ECE is
~15%, so absolute `P_complete` is *uncalibrated*. Per §8 rule 1 that's already the prescribed
treatment: **show ranking + CI band, hedge the bare %**. Nothing in the panel is blocked on
un-built engine work; it is blocked only on UI work plus one architectural addition (§1 below).

---

## 1. The one genuine new build: an interactive Charleston SESSION

The current tool (`charleston-lab-v2.html`) analyzes a **static** hand. But the Information
Ledger (§7), the per-pass topicality map (§4.2), and belief decay (§7.2) only have meaning inside
an actual **session** that unfolds over T1…T7: you hold a hand, you *make* a pass, you *receive*
three tiles, the ledger fills, the panel re-prioritizes. That session is the spine of the panel.

It already exists at the engine level — `dealer.js` runs four seats over a conserved deal with
strict private views. The addition is a **session wrapper** that puts the human in seat 0 and
steps the Charleston one pass at a time, surfacing only seat 0's `PrivateView`:

```
session.js
  newSession({yourRack?, opponents:Policy[3], seed})   // sim mode: deal you + 3 agents
  newManualSession({yourRack})                          // live-table mode: you enter received tiles
  state(): { passIndex, direction, round, blindEligible, ownRack, observations, ledger }
  applyPass(threeTiles)         // routes via dealer; returns the 3 you receive
  applyReceived(threeTiles)     // live-table mode: human types what they got
  voteStop(bool) / offerCourtesy(k)
```

Two modes, same ledger: **sim mode** (opponents are policy agents — for practice/eval) and
**live-table mode** (the human enters the three tiles they actually received — usable at a real
game). Fair-play is automatic: the wrapper only ever exposes seat 0's information set, reusing the
Dealer's existing per-agent boundary. A test asserts the UI payload contains **no** opponent
hidden tiles.

---

## 2. Zone → engine-output map (every zone has a live producer)

| Zone | Produces from | New glue needed |
|---|---|---|
| **1 Direction Compass** | `charleston2.objScoreDedup` is already section-level → `W(S)` | `direction.js`: normalize + entropy/concentration |
| **2 Hand Portfolio** | `score.shortlist` (D, candidates), `calibrate.predictP`, Wilson CI, points `V` | hedge absolute % (§8) |
| **3 Tile Tray** | `charleston2.keepValueDedup` + best-target distance deltas | `tileAdvice.js`: action + immediate/long-term |
| **4 Pass Builder** | `charleston2.choosePass`/`gradePass` (EV-loss, percentile, dead-heat) | blind/stop/courtesy recs; VoI = deferred (P2 B.6) |
| **5 Information Ledger** | `session` observations + `observer.js` section-lean | `ledger.js`: certain records + decay |
| **6 Tempo & State** | `session.state` + `stats.ROLLOUT_POLICY` + §6 anchors | trivial |

---

## 3. New modules (small, on top of the engine)

- **`direction.js`** — `W(S)` from `objScoreDedup` per section; `concentration = 1 − H(W)/log|S|`;
  flexibility-premium weight by decision point. Drives Zone 1 and seeds the Tile Tray's leading sections.
- **`tileAdvice.js`** — per tile: `action ∈ {KEEP,PASS,FLEX,HOLD_AS_BAIT}` thresholded on
  `keepValueDedup`; `immediate` = Δ distance-to-best-concrete-target if removed now (≈0 ⇒ PASS);
  `longTerm` = Δ direction-concentration / portfolio option value (= the keepValue itself);
  `confidence` inherited from inputs. Emits the §5.1 `TileAdvice` record + the §5.3 sentences.
- **`ledger.js`** — `passedOut[seat][tile]=t`, `received[seat][tile]=t`, `notReturned`, `public[]`;
  derived `holds[seat][tile]` starting 1.0 and decaying `≈0.77^k` per the seat's later pass-outs
  (§7.2); `sectionLean[seat]` from `observer.js`. **Fair-play bounded** — only the player's own actions.
- **`assertiveness.js`** — binds each output to its §3 strength class → UI voice (fact / number+CI /
  hedged-lean / recommendation+EV-loss), enforcing the §8 table and the two hard rules.

UI: **`charleston-lab-v3.html`** — the six-zone panel, adaptive expert/learner density with an
"explain" affordance per zone, re-prioritized per decision point (§4.2).

---

## 4. Phases

| Phase | Zone(s) | Depends on | Size |
|---|---|---|---|
| **P3.1 Direction engine** | 1 | `objScoreDedup` (built) | S |
| **P3.2 Tile Tray** | 3 | `keepValueDedup` (built) + P3.1 | M |
| **P3.3 Session + Information Ledger** | 5 | `dealer.js` (built) | **L — the centerpiece** |
| **P3.4 Pass Builder** | 4 | `choosePass`/`gradePass` (built); blind/stop/courtesy recs | M |
| **P3.5 Hand Portfolio** | 2 | `shortlist` + Wilson CIs (built) | M |
| **P3.6 Tempo & State** | 6 | `session.state` | S |
| **P3.7 Anti-overclaim + adaptive density** | all | `stats` CIs + measured opponent-signal | M (cross-cutting) |
| **P3.8 Replay/teaching mode** | 5 | full-state reveal post-session + EV-loss/WPA | M |

Dependency-light: P3.1, P3.3, P3.5, P3.6 can proceed in parallel once `session.js` exists; P3.2
and P3.4 build on P3.1/P3.3; P3.7 wraps all; P3.8 is last.

---

## 5. Anti-overclaim wiring (§8) — and where our measurements make it concrete

Part 3 §8 says match UI assertiveness to conclusion strength. We can wire this to *real numbers*:

- **Structural-certain** (`D`, acceptance, what-you-passed): stated as fact. The ledger's
  "you handed seat-2 the 5-Bam at R1" is confidence 1.0 — solid chip.
- **Probabilistic-calibrated** (`P_complete`, EV): number **with Wilson CI band** (from `stats`),
  "≈". When two passes' CRN paired CIs overlap, `charleston2` already flags **dead heat** → render
  as tied, never ordered (satisfies §8 hard rule 1 directly).
- **Inferential-tentative** (opponent leans): **our measurement sets the ceiling.** `observer.js`
  showed full-section prediction is ≈ chance during the Charleston, and only the *negative* read
  ("not collecting") carries signal (P 9.6%→6.7%). So Zone 5 must **lead with the "not collecting"
  strip**, render section-lean greyed/thin, and never assert a positive section. This isn't just a
  style choice — it's bound to a measured information ceiling, which is exactly the §8/§3.1 intent.
- **Prescriptive** (pass/direction): recommendation + the EV-loss of deviating (already produced),
  hedged voice on a close call (dead-heat).

---

## 6. Honest adjustments to Part 3's assumptions

1. **Absolute probabilities are uncalibrated (ECE ~15%).** Zone 2/4 show D + ranking + CI; the bare
   % is hedged until the closed-form weights are refit to the multi-agent MC (deferred B.9). Part 3
   §8 already prescribes this; we just confirm it applies *now*, not "until the MC exists."
2. **Opponent section-lean is empirically weak** — quantified, not assumed. Zone 5 leads with
   negative reads; positive section guesses stay greyed. (Strengthens Part 3 §3.1/§8.)
3. **Point values are illustrative** pending card verification → Points-mode EV carries a
   "values illustrative" tag.
4. **VoI for blind/look/stop (§4.2 widgets)** needs the entropy/incoming machinery (Part 2 B.6,
   deferred). Ship blind/stop/courtesy with the engine's current heuristics + a "heuristic" tag;
   upgrade to true VoI later.
5. **HOLD_AS_BAIT** is a wall-phase concept; include the action label but mark it out-of-core until
   the play-phase UI exists.

---

## 7. Decisions / open questions

1. **Session opponents** — support **both** sim-agent mode (practice/eval) and live-table manual
   entry (you type the 3 tiles you received)? *Recommended: both — the ledger is identical and
   manual mode makes the tool usable at a real game on day one.*
2. **v3 vs evolve v2** — build the six-zone panel as a new `charleston-lab-v3.html`, keeping v2 as
   the static analyzer? *Recommended: new file; v2 stays the quick single-hand tool.*
3. **Replay mode (P3.8)** now or later? It's where full-state reveal is legitimate and where the
   EV-loss/WPA teaching attaches — high learning value but not needed for live advice.
4. **Provenance badges in-panel** — surface the `[EMP]/[HEUR]/…` tags per output, or keep them in an
   "explain" expansion only?

---

## 8. First slice (Part 3 §9, upgraded by what's already built)

Part 3 proposes Direction + Tile Tray + Ledger on the closed-form scorer alone, no MC. We can ship
that **plus** the EV-loss pass ranking (already built) and **plus** live-table manual mode, so the
very first panel already delivers: a robust **direction** read, per-tile **keep/pass with immediate
+ long-term reasons**, perfect-recall **"you handed them this"** ledger, and **graded passes** —
the project's headline asks — on day one, with calibrated probabilities layered in once the weights
are refit (B.9).

**Start with:** `session.js` (manual + sim) → `ledger.js` + `direction.js` → `tileAdvice.js` →
`charleston-lab-v3.html` wiring Zones 1/3/5 + the existing Pass Builder, all under `assertiveness.js`.
