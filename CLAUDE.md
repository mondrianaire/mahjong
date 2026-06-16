# CLAUDE.md — Charleston Lab project context

> Onboarding for any new chat working in this folder. Read this first. It summarizes what the
> project is, what's built, where things live, and what's next. For depth, read the linked plans.

## What this is
An **American Mahjongg (2026 NMJL card) Charleston analysis engine + study tools.**
**It is a PRACTICE / STUDY GUIDE, not a live at-the-table tool** — design for teaching, not speed.
The product helps a learner choose a starting-hand *direction*, decide *which 3 tiles to pass* in
the Charleston, and *understand why*, with statistically honest numbers (never folklore-as-fact).

## Guiding principles (do not violate)
1. **Monte Carlo is ground truth; closed forms are calibrated approximations.** No weight ships
   unless fit against the multi-agent simulator.
2. **Rank by the active objective:** `P(win)` in WINS mode, `EV = P·V` in POINTS mode. Never raw points.
3. **Provenance discipline:** every claim carries a tag `[EMP]/[ACAD]/[XFER]/[DERIV]/[HEUR]/[FOLK?]`;
   weak inferences must look weak in the UI (anti-overclaim).
4. **Information hygiene / fair play:** advisory views use only the player's own information set +
   public data — never opponents' hidden tiles. Full state is for post-game replay only.
5. **Pairs/singles are the dominant difficulty axis** (no joker, no call) — confirmed: the B.9
   logistic learned `drawOnly` as its top predictor.

## Status — what is BUILT & VERIFIED
- **Engine (Phases 0–8):** tiles + full 2026 card (72 lines, ~1083 targets), deficiency/acceptance
  kernel (concealed-calling fix C1), the four-seat **Dealer** (conservation verified 10⁴ runs),
  scorer + objective modes, multi-agent **Monte Carlo with calling** (reproduces the §6 joker curve
  and pair-hardness), calibration harness, Charleston v2 (keepValue dedup C2, junk-biased incoming,
  EV-loss), opponent **observer** (measured: full-section signal ≈ chance, negative signal real),
  divergence detector.
- **Part 2 statistical toolkit (core):** `stats.js` Wilson/CRN/proper-scoring; **EV-loss** decision
  grading; proper-scoring calibration (ECE).
- **B.9 calibrated predictor:** logistic fit to 1,320 self-play samples → **ECE 15%→2.5%**
  (`calibrated.js`).
- **Part 3 control panel (all six zones):** Direction, Portfolio, Tile Tray, Pass Builder,
  Information Ledger (decay + fair-play), Tempo, + replay reveal.
- **Mobile M0–M1:** engine packaged (ESM + IIFE global + compute **Web Worker**, ~15KB gz);
  installable **offline PWA shell** (`app.mobile.html`).

## Honest caveats (keep visible)
- Absolute probabilities are calibrated to the current **rollout policy `0.1.0-greedy`** (wins 82%
  vs 89% anchor). A stronger policy would re-baseline `calibrated.js`.
- **Point values in `card-meta.js` are ILLUSTRATIVE/UNVERIFIED** — POINTS mode is directional only
  until a real 2026 card is encoded. WINS mode is unaffected.
- A handful of multi-suit card lines have inferred suit partitions (`~role-inferred` in `engine.js`).

## What's NEXT (open work)
- **Mobile M2** (build-a-hand keypad) → **M3** (six teaching cards, explanation-first) →
  **M4** (guided practice loop: sim + replay + EV-loss grade) → **M5** (drills/quiz/concepts) →
  **M6** (progress/persistence) → **M7** (polish). See `MOBILE_PLAN.md`.
- Deferred engine: stronger rollout policy (A.2); Tier-2/3 tools (Shapley, WPA, VoI, best-arm);
  live-data validation. See `IMPLEMENTATION_PLAN.md` §10.

## Where things live (all in this folder)
**Engine modules (CommonJS, Node + browser):** `engine.js` (tiles+card+distance), `kernel.js`
(acceptance/C1), `card-meta.js` (points/concealed — illustrative), `score.js`, `charleston2.js`
(EV-loss/keepValue), `divergence.js`, `observer.js`, `direction.js`, `tileAdvice.js`,
`calibrated.js` (B.9), `dealer.js` (the spine), `policies.js`, `ledger.js`, `session.js`,
`stats.js`, `play.js`.
**Packaging (M0):** `index.js` (API barrel), `compute.worker.js`, `engine-client.js`,
`package.json`, `dist/` (esbuild outputs: `charleston-engine.esm.js`, `.global.js`,
`compute.worker.js`).
**Desktop tools:** `charleston-lab.html` (v1 static rater), `charleston-lab-v2.html`
(decision-quality), `charleston-lab-v3.html` (six-zone control panel).
**Mobile PWA (M1):** `app.mobile.html`, `app.js`, `manifest.webmanifest`, `service-worker.js`,
`icon.svg`.
**Tests:** `testA.js` (Phases 0–2), `testB.js` (3–4), `testC.js` (6–8+B.1), `testD.js` (Part 3),
`testM0.js` (packaging). **Fitting:** `fit_corpus.js`, `fit_model.js`, `calibrated-weights.json`.
**Plans:** `IMPLEMENTATION_PLAN.md` (engine + Part 2), `PANEL_PLAN.md` (Part 3 panel),
`MOBILE_PLAN.md` (mobile, study-first). Source design specs are in this folder: `charleston-and-hand-ranking-spec.md` (Part 1), `charleston-eval-statistical-toolkit.md` (Part 2), `charleston-control-panel-and-information-design.md` (Part 3).

## How to run / test / build
```
node testA.js && node testB.js && node testC.js && node testD.js && node testM0.js   # all green
node calibrate.js 150        # calibration report (joker curve, ECE, gates)
npm install esbuild --no-save && npm run build   # rebuild dist/ (engine + worker + global)
```
Desktop tools: open any `charleston-lab*.html`. Mobile PWA: **serve the folder over http** (service
workers need a served origin) then open `app.mobile.html`; `file://` renders but won't install/offline.

## Conventions
- Keep modules CommonJS; the browser bundles are produced by esbuild (or the inline-concat pattern
  used by the v1–v3 HTML tools). Verify changes with the test files above before claiming done.
- Performance: only `choosePass`/`gradePass` are heavy (~440ms desktop) — they belong in the worker.
- Cross-session continuity lives in THIS file + the memory space; update this file when status changes.
