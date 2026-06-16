# Charleston Lab

A **practice & study guide for the American Mahjongg Charleston** (2026 NMJL card). It scores
starting hands, recommends which 3 tiles to pass, explains *why*, and grades your choices — with
statistically honest numbers grounded in a calibrated multi-agent simulator, not folklore.

> **New here (or a fresh chat)? Read [`CLAUDE.md`](./CLAUDE.md) first** — it's the full project
> orientation: architecture, status, caveats, file map, and how to run everything.

## Highlights
- **Verified engine** — full 2026 card (72 lines), four-seat Charleston simulator (tile-conservation
  proven over 10⁴ runs) that independently reproduces the real-world joker→win-rate curve.
- **Decision-quality grading** — EV-loss per pass (the mahjong "centipawn loss"), with CRN variance
  reduction and Wilson confidence intervals; "dead heat" when two passes are statistically tied.
- **Calibrated probabilities** — a logistic predictor fit to self-play cut calibration error (ECE)
  from 15% to **2.5%**; its top learned feature is pair/single hardness — the theory, from data.
- **Six-zone control panel** (`charleston-lab-v3.html`) with an information ledger that respects
  fair-play (only what you legitimately know), plus a replay/teaching reveal.
- **Offline PWA** (`app.mobile.html`) — installable, ~15KB-gzipped engine, runs with no network.

## Quickstart
```bash
# run the full verified test suite
node testA.js && node testB.js && node testC.js && node testD.js && node testM0.js

# calibration report (joker curve, ECE, normative gates)
node calibrate.js 150

# rebuild the browser/PWA bundles
npm install esbuild --no-save && npm run build
```
- **Desktop tools:** open `charleston-lab.html` (rater), `-v2` (decision quality), `-v3` (panel).
- **Mobile PWA:** serve the folder over http (service workers need a served origin), open
  `app.mobile.html`. `file://` renders but won't install/offline.

## Layout
Engine modules are CommonJS (Node + browser). See `CLAUDE.md` for the full file map. Plans:
`IMPLEMENTATION_PLAN.md` (engine + stats), `PANEL_PLAN.md` (control panel), `MOBILE_PLAN.md` (mobile).

## Status
Engine (Phases 0–8), statistical toolkit core, the six-zone panel, the B.9 calibrated predictor,
and mobile M0–M1 (packaging + PWA shell) are built and verified. Next: mobile M2–M7 (the study UI).

## Honest caveats
Absolute probabilities are calibrated to the current greedy rollout policy (wins 82% vs 89%
anchor). **Point values are illustrative/unverified** — POINTS mode is directional until a real
2026 card is encoded; WINS mode is unaffected.
